// سباق الكتابة — اكتب الجملة بأسرع وقت
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { fmt, getUser, saveUser, bumpStat, brandedEmbed, winEmbed, balanceFooter, safeReply, CURRENCY } = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const SENTENCES = [
  'العلم نور والجهل ظلام يهدي صاحبه إلى الهلاك',
  'من جدّ وجد ومن زرع حصد ومن سار على الدرب وصل',
  'لا تؤجل عمل اليوم إلى الغد فالوقت كالسيف',
  'الكتاب خير جليس في الزمان فاقرأ ولا تتوقف',
  'في النظام بقاء وفي الفوضى فناء وفي الصبر مفتاح الفرج',
  'البرمجة فن وعلم ومنطق يبني العقل ويفتح آفاق المستقبل',
  'الصداقة كنز لا يُقدّر بثمن فاحرص على من يُقدّرك',
  'العمل الجاد يفتح أبواب النجاح ويصنع المعجزات يومياً'
];

module.exports = {
  aliases: ['سباق_كتابة', 'type'],
  data: new SlashCommandBuilder().setName('typerace').setDescription('⌨️ سباق الكتابة — اكتب الجملة بأسرع ما يمكن'),

  async execute(interaction) {
    const sentence = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
    const userId = interaction.user.id, guildId = interaction.guild.id;

    const embed = brandedEmbed(interaction, '⌨️ سباق الكتابة', COLORS.cyan).setDescription(
      `📜 الجملة:\n\`\`\`\n${sentence}\n\`\`\`\n\n` +
      `⏱️ السرعة + الدقة = الجائزة\n🎯 اضغط الزر وانسخ الجملة بأسرع وقت`
    );
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tr_start').setLabel('🚀 بدء').setStyle(ButtonStyle.Success)
    );
    const msg = await safeReply(interaction, { embeds: [embed], components: [row] });

    const col = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000, max: 1 });
    col.on('collect', async i => {
      const start = Date.now();
      const modal = new ModalBuilder().setCustomId('tr_m').setTitle('اكتب الجملة');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('t').setLabel('الجملة').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300)
      ));
      await i.showModal(modal);
      try {
        const sub = await i.awaitModalSubmit({ time: 120000, filter: m => m.user.id === userId });
        const elapsed = (Date.now() - start) / 1000;
        const typed = sub.fields.getTextInputValue('t');
        // accuracy via Levenshtein
        const lev = (a,b) => { const d = Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]); for (let j=0;j<=b.length;j++) d[0][j]=j; for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[a.length][b.length]; };
        const dist = lev(typed.trim(), sentence);
        const acc = Math.max(0, 1 - dist / sentence.length);
        const wpm = (sentence.split(' ').length / (elapsed / 60));
        const reward = Math.floor(acc * (1500 - elapsed * 10));
        const { g, u } = getUser(guildId, userId);
        u.balance += Math.max(0, reward); u.xp += 25;
        bumpStat(u, 'typerace_count'); saveUser(guildId, g);
        await sub.deferUpdate();
        await interaction.editReply({
          embeds: [winEmbed(interaction, 'انتهى السباق', `⏱️ الوقت: **${elapsed.toFixed(1)}s**\n🎯 الدقة: **${(acc*100).toFixed(1)}%**\n⌨️ السرعة: **${wpm.toFixed(0)} WPM**\n\n💰 +${fmt(Math.max(0,reward))} ${CURRENCY} • ✨ +25 XP`).setFooter(balanceFooter(u))],
          components: []
        }).catch(()=>{});
      } catch {}
    });
  }
};
