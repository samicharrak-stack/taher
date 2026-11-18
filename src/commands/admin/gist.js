// ☁️ /gist — إدارة التخزين في GitHub Gist (لمالك البوت)
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const gist = require('../../db/gistStore');
const { snapshotAll, cloudRestoreAll } = require('../../utils/guildStorage');

const t = (d) => (d ? `<t:${Math.floor(new Date(d).getTime() / 1000)}:R>` : '—');

module.exports = {
  ownerOnly: true,
  aliases: ['جيست', 'التخزين', 'نسخة_احتياطية'],
  data: new SlashCommandBuilder()
    .setName('gist')
    .setDescription('☁️ التخزين في GitHub Gist: الحالة، حفظ فوري، استعادة، نسخة احتياطية')
    .addSubcommand((s) => s.setName('status').setDescription('حالة الاتصال والمزامنة'))
    .addSubcommand((s) => s.setName('save').setDescription('حفظ كل التغييرات الآن'))
    .addSubcommand((s) => s.setName('restore').setDescription('إعادة تحميل البيانات من الـGist'))
    .addSubcommand((s) => s.setName('backup').setDescription('نسخة احتياطية كاملة في Gist سري')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand?.() || 'status';
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const e = new EmbedBuilder().setColor(0x6d4aff).setTitle('☁️ تخزين GitHub Gist');
    if (!gist.enabled()) {
      e.setColor(0xe8455f).setDescription('غير مفعّل. أضف المتغيرين `GIST_TOKEN` و`GIST_ID` في إعدادات الاستضافة ثم أعد تشغيل البوت.');
      return interaction.editReply({ embeds: [e] });
    }
    try {
      if (sub === 'save') { const ok = await gist.flush(); e.setDescription(ok ? '✅ تم حفظ كل التغييرات في الـGist.' : '⚠️ تعذّر الحفظ الآن، سيعيد المحاولة تلقائياً.'); }
      else if (sub === 'restore') { await gist.flush(); const r = await cloudRestoreAll(); e.setDescription(r.ok ? `✅ تمت الاستعادة: ${r.guilds} سيرفر، ${r.users} مستخدم.` : `❌ فشلت الاستعادة: ${r.reason}`); }
      else if (sub === 'backup') { await gist.flush(); const b = await gist.backup(snapshotAll()); e.setDescription(`✅ تم إنشاء نسخة احتياطية سرية.\n${b.url}`); }
      else {
        const s = gist.status();
        e.addFields(
          { name: 'الـGist', value: `\`${s.gistId}\``, inline: true },
          { name: 'المزامنة', value: `كل ${s.interval} ثانية`, inline: true },
          { name: 'بانتظار الحفظ', value: String(s.pending), inline: true },
          { name: 'آخر تحميل', value: t(s.lastPull), inline: true },
          { name: 'آخر حفظ', value: t(s.lastPush), inline: true },
          { name: 'الأخطاء', value: s.errors ? `${s.errors} — ${String(s.lastError).slice(0, 150)}` : '0', inline: false },
        );
      }
    } catch (err) { e.setColor(0xe8455f).setDescription(`❌ ${err.message}`); }
    return interaction.editReply({ embeds: [e] });
  },
};
