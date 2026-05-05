// مبارزة رياضيات — أجب على 5 أسئلة بسرعة
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { fmt, getUser, saveUser, bumpStat, brandedEmbed, winEmbed, balanceFooter, safeReply, CURRENCY } = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

function gen(diff) {
  const r = (lo,hi) => Math.floor(Math.random()*(hi-lo+1))+lo;
  let a, b, op, ans;
  if (diff === 'easy') { a = r(2,20); b = r(2,20); op = ['+','-'][r(0,1)]; }
  else if (diff === 'normal') { a = r(5,50); b = r(2,20); op = ['+','-','×','÷'][r(0,3)]; if (op==='÷') a = a*b; }
  else { a = r(10,99); b = r(2,30); op = ['+','-','×','÷'][r(0,3)]; if (op==='÷') a = a*b; }
  ans = op==='+'?a+b:op==='-'?a-b:op==='×'?a*b:a/b;
  const choices = new Set([ans]);
  while (choices.size < 4) choices.add(ans + r(-10,10) || ans+1);
  return { q: `${a} ${op} ${b}`, ans, choices: [...choices].sort(()=>Math.random()-0.5) };
}

module.exports = {
  aliases: ['رياضيات','math'],
  data: new SlashCommandBuilder().setName('mathduel').setDescription('➗ مبارزة رياضيات — 5 أسئلة سريعة')
    .addStringOption(o => o.setName('difficulty').addChoices({name:'سهل',value:'easy'},{name:'متوسط',value:'normal'},{name:'صعب',value:'hard'}).setDescription('الصعوبة')),

  async execute(interaction) {
    const diff = interaction.options.getString('difficulty') || 'normal';
    const userId = interaction.user.id, guildId = interaction.guild.id;
    let score = 0, qIdx = 0; const total = 5;
    const askNext = async (msg) => {
      if (qIdx >= total) return finish(msg);
      const { q, ans, choices } = gen(diff);
      const row = new ActionRowBuilder().addComponents(
        ...choices.map(c => new ButtonBuilder().setCustomId(`md_${c}_${ans}`).setLabel(`${c}`).setStyle(ButtonStyle.Primary))
      );
      const e = brandedEmbed(interaction, `➗ السؤال ${qIdx+1}/${total}`, COLORS.info)
        .setDescription(`# ${q} = ?\n\n✅ نقاط: **${score}**\n⏱️ 10 ثواني للإجابة`);
      const m = msg ? await interaction.editReply({ embeds:[e], components:[row] }) : await safeReply(interaction, { embeds:[e], components:[row] });
      const col = m.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 10000, max: 1 });
      col.on('collect', async i => {
        const [_, picked, correct] = i.customId.split('_');
        if (picked === correct) score++;
        qIdx++;
        await i.deferUpdate();
        askNext(m);
      });
      col.on('end', async (c, reason) => { if (reason === 'time' && c.size === 0) { qIdx++; askNext(m); } });
    };
    const finish = async () => {
      const { g, u } = getUser(guildId, userId);
      const reward = score * 150 * (diff==='hard'?2:diff==='normal'?1.5:1);
      u.balance += Math.floor(reward); u.xp += score * 15;
      bumpStat(u, 'math_count'); saveUser(guildId, g);
      await interaction.editReply({
        embeds: [winEmbed(interaction, 'انتهت المبارزة', `🏆 النتيجة: **${score}/${total}**\n💰 +${fmt(Math.floor(reward))} ${CURRENCY} • ✨ +${score*15} XP`).setFooter(balanceFooter(u))],
        components: []
      }).catch(()=>{});
    };
    askNext(null);
  }
};
