// 🕸️ networkCards v27 — بطاقات الستريك + لوحة الشبكة (Hub) + البطاقة التلقائية لأي أمر
const { THEMES, INK, compact, _kit } = require('./cardKit');
const { txt, panel, pill, bar, ring, avatar, stat, footer, emoji, iconTile, hexBadge, title, rays, sparkle, rr, grad, base, th, wrap, withReady } = _kit;
const C = () => _kit.C();
const animate = (canvas, name, preset) => require('./motion').animateCanvas(canvas, name, { preset });

/** 🔥 بطاقة الستريك */
async function streakCard({ username, avatarURL, status: s }) {
  if (!C()) return null;
  const W = 1000, H = 520;
  const theme = s.tier.theme;
  const { canvas, ctx, t } = base(W, H, theme, { bg: 'levelup', dim: 0.66, seed: 9 });
  rays(ctx, 210, 230, 300, t, 20, 0.12);
  // اللهب والرقم الكبير
  emoji(ctx, s.count ? '🔥' : '🕯️', 210, 190, 170, { glow: t.glow });
  txt(ctx, String(s.count), 210, 380, { size: 92, align: 'center', color: INK.text, glow: t.glow, shadow: true });
  txt(ctx, s.count === 1 ? 'يوم' : 'يوم متتالي', 210, 420, { size: 20, weight: 'normal', align: 'center', color: t.a });
  // الاسم + الرتبة
  const AS = 92;
  await avatar(ctx, avatarURL, W - 60 - AS, 44, AS, t, username);
  title(ctx, username || 'Player', W - 60 - AS - 22, 86, t, { size: 38, maxW: 420 });
  txt(ctx, `${s.tier.emoji} ستريك ${s.tier.name}${s.title ? ` • لقب: ${s.title}` : ''}`, W - 60 - AS - 22, 120, { size: 17, weight: 'normal', color: t.a, align: 'right', maxW: 460 });
  // أيام الأسبوع
  panel(ctx, 420, 160, 530, 100, 20);
  txt(ctx, 'آخر 7 أيام', 926, 186, { size: 15, weight: 'normal', color: INK.sub, align: 'right' });
  const days = ['س', 'ج', 'خ', 'ر', 'ث', 'ن', 'ح'];
  s.week.forEach((on, i) => {
    const cx = 900 - i * 72, cy = 226; const idx = 6 - i; const active = s.week[idx];
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = active ? grad(ctx, cx - 22, cy - 22, cx + 22, cy + 22, t) : 'rgba(255,255,255,0.06)';
    if (active) { ctx.shadowColor = t.glow; ctx.shadowBlur = 16; }
    ctx.fill(); ctx.restore();
    if (active) emoji(ctx, '🔥', cx, cy, 24); else txt(ctx, days[i] || '•', cx, cy + 6, { size: 15, align: 'center', color: INK.dim });
  });
  // إحصائيات
  const cw = 165;
  stat(ctx, 950 - cw, 278, cw, 78, 'المضاعف', `x${s.mult.toFixed(2)}`, t, '⚡');
  stat(ctx, 950 - cw * 2 - 17, 278, cw, 78, 'أفضل سلسلة', String(s.best), t, '🏆');
  stat(ctx, 950 - cw * 3 - 34, 278, cw, 78, 'الدروع', `${s.shields}/3`, t, '🛡️');
  // المحطة القادمة
  panel(ctx, 420, 372, 530, 92, 20);
  if (s.next) {
    const from = [0, 3, 7, 14, 30, 60, 100, 365].filter((d) => d <= s.count).pop() || 0;
    const ratio = (s.count - from) / Math.max(1, s.next.days - from);
    txt(ctx, `${s.next.emoji} المحطة القادمة: ${s.next.title} • ${s.next.days} يوم`, 926, 400, { size: 16, align: 'right', maxW: 380 });
    txt(ctx, `+${compact(s.next.reward)} 💎`, 446, 400, { size: 16, color: t.a });
    bar(ctx, 446, 420, 480, 18, ratio, t, { ticks: true });
  } else txt(ctx, '🌌 وصلت لكل المحطات — أنت أسطورة!', 685, 425, { size: 20, align: 'center', color: t.a });
  const state = s.activeToday ? '✅ سلسلتك محفوظة اليوم' : s.atRisk ? `⚠️ سلسلتك مهددة! باقي ${Math.floor(s.msLeft / 3600000)} ساعة` : '💤 ابدأ سلسلة جديدة اليوم';
  footer(ctx, W, H, `${state} • كل يوم = +1% على كل المكافآت (حتى +50%)`);
  return animate(canvas, 'streak.png', 'flame');
}

/** 🕸️ لوحة الشبكة: كل أنظمتك مربوطة حولك */
async function hubCard({ username, avatarURL, level, ratio, balance, bank, streak, mult, dungeonWins, hunterRank, farmLevel, harvested, rank, totalUsers, games }) {
  if (!C()) return null;
  const W = 1000, H = 600;
  const { canvas, ctx, t } = base(W, H, 'azure', { bg: 'rank', dim: 0.7, seed: 4 });
  const cx = W / 2, cy = 340;
  const P = [[830, 210], [830, 340], [830, 470], [170, 210], [170, 340], [170, 470]];
  const nodes = [
    { e: '💎', l: 'الرصيد', v: compact((balance || 0) + (bank || 0)), th: 'gold' },
    { e: '⭐', l: 'المستوى', v: String(level), th: 'violet' },
    { e: '🔥', l: 'الستريك', v: `${streak} • x${mult.toFixed(2)}`, th: 'amber' },
    { e: '⚔️', l: 'الدانجون', v: `${hunterRank || 'E'} • ${compact(dungeonWins)}`, th: 'crimson' },
    { e: '🌾', l: 'المزرعة', v: `Lv.${farmLevel} • ${compact(harvested)}`, th: 'emerald' },
    { e: '🎮', l: 'الألعاب', v: compact(games), th: 'azure' },
  ].map((n, i) => ({ ...n, x: P[i][0], y: P[i][1] }));
  // خطوط الشبكة
  ctx.save(); ctx.lineWidth = 2;
  nodes.forEach((n, i) => {
    const tt = THEMES[n.th]; const g = ctx.createLinearGradient(cx, cy, n.x, n.y); g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(1, tt.a);
    ctx.strokeStyle = g; ctx.shadowColor = tt.glow; ctx.shadowBlur = 10; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(n.x, n.y); ctx.stroke();
    const m = nodes[(i + 1) % nodes.length]; ctx.globalAlpha = 0.18; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke(); ctx.globalAlpha = 1;
  });
  ctx.restore();
  // المركز: العضو
  const AS = 150;
  ring(ctx, cx, cy, AS / 2 + 16, 8, ratio, t);
  await avatar(ctx, avatarURL, cx - AS / 2, cy - AS / 2, AS, t, username);
  hexBadge(ctx, cx, cy + AS / 2 + 14, 26, t, String(level), { size: 20 });
  // العقد
  for (const n of nodes) {
    const tt = THEMES[n.th]; const w = 210, h = 74;
    panel(ctx, n.x - w / 2, n.y - h / 2, w, h, 18, 'rgba(8,12,22,0.82)', { glow: tt.glow });
    iconTile(ctx, n.e, n.x + w / 2 - 38, n.y, 48, tt, { solid: true });
    txt(ctx, n.l, n.x + w / 2 - 72, n.y - 8, { size: 14, weight: 'normal', color: INK.sub, align: 'right' });
    txt(ctx, n.v, n.x + w / 2 - 72, n.y + 22, { size: 21, color: tt.a, align: 'right', maxW: 120 });
  }
  title(ctx, username || 'Player', W - 50, 64, t, { size: 34, maxW: 420 });
  txt(ctx, '🕸️ لوحة الشبكة — كل أنظمتك متصلة', W - 50, 96, { size: 16, weight: 'normal', color: t.a, align: 'right' });
  if (rank) pill(ctx, `#${rank} من ${totalUsers}`, 50, 40, t, { icon: '🏆' });
  footer(ctx, W, H, 'اضغط أي زر بالأسفل للانتقال مباشرة • الستريك يضاعف أرباحك في كل الأنظمة');
  return animate(canvas, 'hub.png', 'network');
}

// ── البطاقة التلقائية: تحوّل أي إمبد إلى بطاقة مصمّمة متحركة
const COLOR_THEME = [
  ['gold', 0xFFD76A], ['amber', 0xFF9F43], ['emerald', 0x2FD69B], ['crimson', 0xE8455F], ['azure', 0x4FA3FF],
  ['violet', 0x8E6CFF], ['rose', 0xFF7BB5], ['frost', 0x9BE7FF], ['toxic', 0x8FE03C], ['slate', 0x99A3B5],
];
function themeFromColor(c) {
  if (c == null) return 'gold';
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  let best = 'gold', bd = Infinity;
  for (const [n, v] of COLOR_THEME) { const d = (r - ((v >> 16) & 255)) ** 2 + (g - ((v >> 8) & 255)) ** 2 + (b - (v & 255)) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}
const BG_FOR = { embers: 'arena', nature: 'farm', coins: 'wealth', ascend: 'levelup', flame: 'levelup', neon: 'casino', network: 'rank', hearts: 'room', scan: 'rank', calm: 'room', dust: 'rank' };
const ICON_FOR = { embers: '⚔️', nature: '🌾', coins: '💰', ascend: '⭐', flame: '🔥', neon: '🎮', network: '🕸️', hearts: '💖', scan: '🛡️', calm: '🌙', dust: '✨' };

function clean(s, resolve) {
  return String(s || '')
    .replace(/<a?:(\w+):\d+>/g, '')
    .replace(/<@!?(\d+)>/g, (_, id) => '@' + (resolve?.(id) || 'عضو'))
    .replace(/<#\d+>/g, '#قناة').replace(/<@&\d+>/g, '@رتبة')
    .replace(/<t:\d+(:\w)?>/g, '⏱️')
    .replace(/\*\*|__|~~|`{1,3}|\|\||\*/g, '').replace(/^>\s?/gm, '').replace(/^#+\s/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[ \t]+/g, ' ').trim();
}

/**
 * @param {{embed:object, command:string, username:string, avatarURL:string, resolve?:(id)=>string}} p
 */
async function autoCard({ embed, command, username, avatarURL, resolve }) {
  if (!C()) return null;
  const preset = require('./motion').presetFor(command);
  const theme = themeFromColor(embed.color);
  const fields = (embed.fields || []).filter((f) => f && f.name && f.value && f.name !== '\u200b').slice(0, 6);
  const W = 1000;
  const desc = clean(embed.description, resolve);
  // قياس مبدئي للوصف
  const tmp = C().createCanvas(10, 10).getContext('2d');
  const lines = desc ? desc.split('\n').filter(Boolean).flatMap((l) => wrap(tmp, l, W - 140, 20, 'normal', 3)).slice(0, 7) : [];
  const rows = Math.ceil(fields.length / 3);
  const H = Math.max(300, 150 + lines.length * 32 + (lines.length ? 20 : 0) + rows * 96 + 50);
  const { canvas, ctx, t } = base(W, H, theme, { bg: BG_FOR[preset], dim: 0.72, seed: command.length });
  // الرأس
  iconTile(ctx, ICON_FOR[preset], W - 80, 78, 72, t, { solid: true });
  const head = clean(embed.title || embed.author?.name || command, resolve) || command;
  title(ctx, head, W - 136, 80, t, { size: 34, maxW: W - 380 });
  txt(ctx, `/${command}`, W - 136, 112, { size: 15, weight: 'normal', color: t.a, align: 'right' });
  if (avatarURL) await avatar(ctx, avatarURL, 50, 40, 76, t, username);
  if (username) txt(ctx, username, 140, 84, { size: 18, color: INK.text, maxW: 240 });
  // الوصف
  let y = 160;
  if (lines.length) {
    panel(ctx, 50, y - 18, W - 100, lines.length * 32 + 26, 18);
    lines.forEach((l, i) => txt(ctx, l, W - 74, y + 12 + i * 32, { size: 20, weight: 'normal', color: INK.text, align: 'right', maxW: W - 150 }));
    y += lines.length * 32 + 32;
  }
  // الحقول
  const cw = (W - 100 - 40) / 3;
  fields.forEach((f, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const name = clean(f.name, resolve); const val = clean(f.value, resolve).split('\n')[0];
    const em = (name.match(/\p{Extended_Pictographic}/u) || [null])[0];
    stat(ctx, 50 + (2 - col) * (cw + 20), y + row * 96, cw, 82, name.replace(/\p{Extended_Pictographic}\uFE0F?/gu, '').trim() || name, val || '—', t, em);
  });
  footer(ctx, W, H, clean(embed.footer?.text, resolve) || 'Sami Bot • كل الأوامر مربوطة — استخدم /hub');
  return animate(canvas, `${command}-card.png`, preset);
}

module.exports = { ...withReady({ streakCard, hubCard, autoCard }), themeFromColor };
