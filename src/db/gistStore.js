// ☁️ gistStore v29 — مصدر البيانات والتخزين من GitHub Gist
// - عند التشغيل: يسحب كل البيانات من الـGist قبل دخول البوت (لا تضيع البيانات بعد إعادة النشر)
// - عند الحفظ: يجمع التغييرات ويرفعها دفعة واحدة كل GIST_SYNC_INTERVAL ثانية
// - السيرفرات: ملف لكل سيرفر guild_<id>.json ، المستخدمون: ملف مجمّع users.json (يتجنب حد 300 ملف)
// - يدعم الملفات الكبيرة (truncated → raw_url)، وإعادة المحاولة عند حد الطلبات، والحفظ الأخير عند الإيقاف
// المتغيرات: GIST_TOKEN (صلاحية gist) ، GIST_ID ، GIST_SYNC_INTERVAL (افتراضي 15) ، GIST_BACKUP_ID (اختياري)
const logger = require('../utils/logger');

const API = 'https://api.github.com/gists';
const TOKEN = process.env.GIST_TOKEN || process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const INTERVAL = Math.max(5, Number(process.env.GIST_SYNC_INTERVAL) || 15) * 1000;
const enabled = () => !!(TOKEN && GIST_ID);

const headers = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'sami-bot',
});

const state = { lastPull: null, lastPush: null, pushes: 0, errors: 0, lastError: null, files: 0, pausedUntil: 0 };
const queue = new Map();          // filename -> content (سيرفرات)
const users = new Map();          // userId -> data (للملف المجمّع)
let usersDirty = false;
let pushing = false;
let timer = null;
let ready = false;          // 🔒 لا رفع للـGist قبل نجاح تحميل البيانات السابقة (يمنع مسح قاعدة البيانات)
let retryTimer = null;
let hooks = null;

async function request(url, opts = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    let res;
    try { res = await fetch(url, { ...opts, headers: { ...headers(), ...(opts.headers || {}) }, signal: AbortSignal.timeout(20000) }); }
    catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); continue; }
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const retry = Number(res.headers.get('retry-after')) * 1000;
      const wait = retry || (reset ? Math.max(0, reset - Date.now()) : 60000);
      state.pausedUntil = Date.now() + Math.min(wait, 15 * 60000);
      throw new Error(`GitHub rate limit (${res.status}) — paused ${Math.round(wait / 1000)}s`);
    }
    if (res.status >= 500 && i < tries - 1) { await sleep(1500 * (i + 1)); continue; }
    return res;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** يسحب كل ملفات الـGist: { filename: contentString } */
async function pullAll(id = GIST_ID) {
  if (!TOKEN || !id) return null;
  if (Date.now() < state.pausedUntil) throw new Error('rate limited — waiting');
  const res = await request(`${API}/${id}`);
  if (!res.ok) throw new Error(`Gist fetch ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = {};
  for (const [name, meta] of Object.entries(data.files || {})) {
    let content = meta?.content ?? null;
    if ((meta?.truncated || content == null) && meta?.raw_url) {
      const raw = await request(meta.raw_url);
      if (raw.ok) content = await raw.text();
    }
    if (content != null) out[name] = content;
  }
  state.lastPull = new Date(); state.files = Object.keys(out).length;
  return out;
}

/** يجهّز الحزمة الدورية ويرفعها */
async function flush() {
  if (!enabled() || pushing || Date.now() < state.pausedUntil) return false;
  if (!ready) { logger.warn('☁️ Gist: save skipped — previous data not loaded yet (protecting database)'); return false; }
  if (!queue.size && !usersDirty) return true;
  pushing = true;
  const files = {};
  for (const [name, content] of queue) files[name] = { content };
  const sentNames = [...queue.keys()];
  queue.clear();
  const sentUsers = usersDirty;
  if (usersDirty) { files['users.json'] = { content: JSON.stringify(Object.fromEntries(users)) }; usersDirty = false; }
  try {
    const res = await request(`${API}/${GIST_ID}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) });
    if (!res.ok) throw new Error(`Gist update ${res.status}: ${(await res.text()).slice(0, 200)}`);
    state.lastPush = new Date(); state.pushes++;
    logger.info(`☁️ Gist: saved ${Object.keys(files).length} file(s)`);
    return true;
  } catch (e) {
    state.errors++; state.lastError = e.message;
    logger.error({ err: e.message }, '❌ Gist save failed — will retry');
    for (const n of sentNames) if (!queue.has(n)) queue.set(n, files[n].content);
    if (sentUsers) usersDirty = true;
    return false;
  } finally { pushing = false; }
}

function queueGuild(guildId, json) { if (enabled()) queue.set(`guild_${guildId}.json`, json); }
function queueUser(userId, data) { if (enabled()) { users.set(String(userId), data); usersDirty = true; } }

/**
 * يستعيد البيانات إلى القرص قبل تشغيل البوت.
 * writeGuildFile(gid, json) / writeUserFile(uid, json) من guildStorage
 */
async function loadOnce({ writeGuildFile, writeUserFile }) {
  const files = await pullAll();
  if (!files) throw new Error('empty gist response');
  let g = 0, u = 0;
  for (const [name, content] of Object.entries(files)) {
    try {
      if (/^guild_\d+\.json$/.test(name)) { JSON.parse(content); writeGuildFile(name.slice(6, -5), content); queue.delete(name); g++; }
      else if (/^user_\d+\.json$/.test(name)) { const d = JSON.parse(content); users.set(name.slice(5, -5), d); writeUserFile(name.slice(5, -5), content); u++; }
    } catch (e) { logger.warn(`Gist: skipped broken file ${name}`); }
  }
  // الملف المجمّع يتفوق على ملفات user_ القديمة
  if (files['users.json']) {
    let all;
    try { all = JSON.parse(files['users.json'] || '{}'); }
    catch { throw new Error('users.json is not valid JSON — refusing to overwrite it'); }
    for (const [uid, d] of Object.entries(all)) { users.set(uid, d); writeUserFile(uid, JSON.stringify(d, null, 2)); u++; }
  }
  return { g, u };
}

/**
 * يستعيد البيانات السابقة من الـGist قبل تشغيل البوت — يبدأ دائماً من آخر نسخة محفوظة.
 * إذا فشل التحميل: لا يرفع أي شيء للـGist (حتى لا تُمسح البيانات) ويعيد المحاولة تلقائياً.
 */
async function restore(fns) {
  if (!enabled()) { logger.info('☁️ Gist storage disabled (set GIST_TOKEN + GIST_ID to enable)'); return { ok: false, reason: 'disabled' }; }
  hooks = fns;
  logger.info('☁️ Gist: loading previous data...');
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try {
      const { g, u } = await loadOnce(fns);
      ready = true;
      if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
      logger.info(`✅ Gist: restored ${g} server(s), ${u} user record(s)`);
      return { ok: true, guilds: g, users: u };
    } catch (e) {
      lastErr = e; state.errors++; state.lastError = e.message;
      logger.warn(`Gist load attempt ${i + 1}/5 failed: ${e.message}`);
      await sleep(Math.min(3000 * (i + 1), 15000));
    }
  }
  logger.error({ err: lastErr?.message }, '❌ Gist restore failed — saving to Gist is PAUSED until previous data loads (retrying every 60s)');
  if (!retryTimer) {
    retryTimer = setInterval(async () => {
      if (ready || Date.now() < state.pausedUntil) return;
      try {
        // البيانات السابقة في الـGist هي الأساس — نتجاهل أي تغييرات بُنيت على بيانات فارغة
        const { g, u } = await loadOnce(hooks);
        ready = true; clearInterval(retryTimer); retryTimer = null;
        logger.info(`✅ Gist: late restore ${g} server(s), ${u} user record(s) — saving resumed`);
      } catch (e) { state.lastError = e.message; }
    }, 60000);
    retryTimer.unref?.();
  }
  return { ok: false, reason: lastErr?.message || 'unknown' };
}

/** نسخة احتياطية: Gist جديد سري أو GIST_BACKUP_ID */
async function backup(allFiles) {
  if (!TOKEN) throw new Error('GIST_TOKEN missing');
  const files = {};
  for (const [n, c] of Object.entries(allFiles)) files[n] = { content: c };
  files['_backup_info.json'] = { content: JSON.stringify({ at: new Date().toISOString(), count: Object.keys(allFiles).length }) };
  const id = process.env.GIST_BACKUP_ID;
  const res = await request(id ? `${API}/${id}` : API, {
    method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(id ? { files } : { description: `Sami Bot backup ${new Date().toISOString()}`, public: false, files }),
  });
  if (!res.ok) throw new Error(`Backup ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  return { id: d.id, url: d.html_url };
}

function start() {
  if (!enabled() || timer) return;
  timer = setInterval(() => flush().catch(() => {}), INTERVAL);
  timer.unref?.();
  const final = async (sig) => { logger.info(`☁️ Gist: final save before ${sig}`); await flush().catch(() => {}); process.exit(0); };
  process.once('SIGTERM', () => final('SIGTERM'));
  process.once('SIGINT', () => final('SIGINT'));
  logger.info(`☁️ Gist storage on — syncing every ${INTERVAL / 1000}s`);
}

const status = () => ({ enabled: enabled(), ready, gistId: GIST_ID ? `${GIST_ID.slice(0, 6)}…` : null, pending: queue.size + (usersDirty ? 1 : 0), interval: INTERVAL / 1000, ...state });

module.exports = { enabled, start, restore, flush, pullAll, backup, queueGuild, queueUser, status };
