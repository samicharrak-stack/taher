const { SlashCommandBuilder } = require('discord.js');
const {
  fmt, getUser, saveUser, bumpStat,
  brandedEmbed, gifEmbed, winEmbed, loseEmbed, tieEmbed,
  balanceFooter, safeReply, CURRENCY
} = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const WORDS = [
  { w: 'DRAGON', hint: 'وحش أسطوري ينفث النار' },
  { w: 'FOREST', hint: 'مساحة كثيفة من الأشجار' },
  { w: 'VOLCANO', hint: 'جبل ناري' },
  { w: 'EMPIRE', hint: 'مملكة كبرى' },
  { w: 'SWORD', hint: 'سلاح حدّ' },
  { w: 'SHIELD', hint: 'وسيلة دفاع' },
  { w: 'POTION', hint: 'شراب سحري' },
  { w: 'KNIGHT', hint: 'فارس' },
  { w: 'CASTLE', hint: 'حصن منيع' },
  { w: 'WIZARD', hint: 'ساحر حكيم' }
];

function shuffle(s) {
  const a = s.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const out = a.join('');
  return out === s ? shuffle(s) : out;
}

module.exports = {
  aliases: ['ترتيب', 'sort'],
  data: new SlashCommandBuilder()
    .setName('sort')
    .setDescription('🔤 رتّب الأحرف لتكوين الكلمة الصحيحة'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const pick = WORDS[Math.floor(Math.random() * WORDS.length)];
    const scrambled = shuffle(pick.w);

    const reward = 150 + Math.floor(Math.random() * 250);
    const embed = gifEmbed(interaction, '🔤 لعبة الترتيب', '', 'sort', 'play', COLORS.info)
      .setDescription(
        `🧩 الأحرف المبعثرة:\n# \`${scrambled.split('').join(' ')}\`\n\n` +
        `💡 تلميح: *${pick.hint}*\n` +
        `🏆 الجائزة: **${fmt(reward)}** ${CURRENCY}\n\n` +
        `⏱️ لديك **30 ثانية** — اكتب الإجابة في الشات.`
      );
    await safeReply(interaction, { embeds: [embed] });

    const filter = m => m.author.id === userId && m.content.trim().length > 0;
    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 6 });

    let attempts = 0;
    collector.on('collect', async m => {
      attempts++;
      try { await m.delete(); } catch {}
      if (m.content.trim().toUpperCase() === pick.w) return collector.stop('win');
      if (attempts >= 6) return collector.stop('out');
    });

    collector.on('end', async (_c, reason) => {
      const { g, u } = getUser(guildId, userId);
      bumpStat(u, 'sort_count');
      let final;
      if (reason === 'win') {
        u.balance += reward; u.xp += 50;
        bumpStat(u, 'sort_wins');
        final = winEmbed(interaction, 'إجابة صحيحة!', `الكلمة هي **${pick.w}**\n💰 +${fmt(reward)} ${CURRENCY} • ✨ +50 XP`, 'sort').setFooter(balanceFooter(u));
      } else if (reason === 'out') {
        final = loseEmbed(interaction, 'استنفدت محاولاتك', `الإجابة كانت: **${pick.w}**`, 'sort').setFooter(balanceFooter(u));
      } else {
        final = tieEmbed(interaction, 'انتهى الوقت', `الإجابة كانت: **${pick.w}**`, 'sort').setFooter(balanceFooter(u));
      }
      saveUser(guildId, g);
      await interaction.editReply({ embeds: [final] }).catch(()=>{});
    });
  }
};
