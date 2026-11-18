// اختبار تخزين Gist بخادم وهمي (بدون إنترنت)
const os = require('os'), fs = require('fs'), path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gist-'));
process.env.DATA_DIR = dir; process.env.GIST_TOKEN = 'x'; process.env.GIST_ID = 'abc123'; process.env.GIST_SYNC_INTERVAL = '5';
const remote = { 'guild_111.json': JSON.stringify({ prefix: '!', users: { 5: { balance: 777 } } }), 'users.json': JSON.stringify({ 42: { id: '42', balance: 9 } }) };
const patches = [];
global.fetch = async (url, o = {}) => {
  const ok = (b) => ({ ok: true, status: 200, headers: new Map(), json: async () => b, text: async () => JSON.stringify(b) });
  if (o.method === 'PATCH') { const b = JSON.parse(o.body); patches.push(b); for (const [n, f] of Object.entries(b.files)) remote[n] = f.content; return ok({}); }
  return ok({ files: Object.fromEntries(Object.entries(remote).map(([n, c]) => [n, { content: c }])) });
};
let pass = 0, fail = 0; const check = (n, c) => { c ? pass++ : fail++; console.log(`${c ? '✅' : '❌'} ${n}`); };
(async () => {
  const cfg = require('../src/config');
  const st = require('../src/utils/guildStorage');
  const gist = require('../src/db/gistStore');
  const r = await st.cloudRestoreAll();
  check('restore reads servers and users from Gist', r.ok && r.guilds === 1 && r.users === 1);
  check('restored server data is used by the bot', st.readGuild('111').users[5].balance === 777);
  const g = st.readGuild('111'); g.users[5].balance = 1000; st.writeGuild('111', g);
  const u = st.readUser('42'); u.balance = 50; st.writeUser('42', u);
  await new Promise((res) => setTimeout(res, 1200));
  check('changes wait in the queue', gist.status().pending === 2);
  await gist.flush();
  check('one batched save sent to Gist', patches.length === 1);
  check('server change saved', JSON.parse(remote['guild_111.json']).users[5].balance === 1000);
  check('user change saved in users.json', JSON.parse(remote['users.json'])['42'].balance === 50);
  check('queue empty after save', gist.status().pending === 0);
  console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
})();
