// تشغيل كل أمر بدون مدخلات للتأكد أنه لا ينهار
process.env.DATA_DIR = require('path').join(require('os').tmpdir(), 'taher-smoke-' + Date.now());
const fs = require('fs'), path = require('path');
const { createTextInteraction } = require('../src/utils/textShim');
const files = []; (function walk(d){ for (const f of fs.readdirSync(d)) { const p = path.join(d,f); fs.statSync(p).isDirectory()?walk(p):f.endsWith('.js')&&files.push(p);} })(path.join(__dirname,'../src/commands'));
const coll = () => { const m = new Map(); m.first = () => null; return m; };
(async () => {
  let ok = 0, bad = [];
  for (const f of files) {
    const cmd = require(f); const name = cmd.data?.name || path.basename(f,'.js');
    const sent = [];
    const reply = async (p) => { sent.push(p); return { edit: async q => sent.push(q), delete: async()=>{}, createMessageComponentCollector: () => ({ on(){}, stop(){} }), awaitMessageComponent: () => new Promise(()=>{}) }; };
    const message = { author: { id: 'u1', username: 'sami', bot:false, displayAvatarURL: () => null, avatarURL:()=>null }, member: { id:'u1', permissions:{ has:()=>true }, roles:{ cache:new Map() }, displayName:'sami' },
      guild: { id: 'g1', name:'g', iconURL:()=>null, memberCount: 5, members: { cache: new Map(), me:{ permissions:{has:()=>true} } }, channels:{ cache:new Map() }, roles:{ cache:new Map() } },
      channel: { id: 'c1', send: reply, createMessageCollector: () => ({ on(){}, stop(){} }) }, mentions: { users: coll(), channels: coll(), roles: coll(), members: coll() }, attachments: coll(), createdTimestamp: Date.now(), reply, content: name };
    const client = { user: { id: 'bot', username:'bot', displayAvatarURL:()=>null }, users: { cache: new Map() }, guilds:{ cache:new Map() }, commands: new Map(), ws:{ping:1}, uptime:1 };
    try {
      const shim = createTextInteraction({ message, client, commandName: name, args: [], isPrefixCommand: false, cmd });
      await Promise.race([cmd.execute(shim), new Promise(r => setTimeout(r, 4000))]);
      const errTxt = JSON.stringify(sent).match(/حدث خطأ|Error:|TypeError/);
      if (errTxt) bad.push(`${name}: reply shows error`); else ok++;
    } catch (e) { bad.push(`${name}: ${String(e.message).slice(0,140)}`); }
  }
  console.log(`OK ${ok} / ${files.length}`); bad.forEach(b => console.log('❌', b)); process.exit(0);
})();
