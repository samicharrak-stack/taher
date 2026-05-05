const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  fmt, getUser, saveUser, bumpStat,
  brandedEmbed, gifEmbed, winEmbed, loseEmbed, tieEmbed,
  balanceFooter, playAgainRow, safeReply, errorEmbed, CURRENCY
} = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const ENTRY_FEE = 50;
const MAX_ATTEMPTS = 6;
const MAX_NUM = 100;

module.exports = {
  aliases: ['خمن', 'تخمين', 'guess'],
  data: new SlashCommandBuilder()
    .setName('guess')
    .setDescription('🔢 خمّن رقماً من 1 إلى 100 خلال 6 محاولات'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const { g, u } = getUser(guildId, userId);

    if (u.balance < ENTRY_FEE) return safeReply(interaction, { embeds: [errorEmbed('رصيد غير كافٍ', `تحتاج ${fmt(ENTRY_FEE)} ${CURRENCY} للمشاركة.`)], ephemeral: true });
    u.balance -= ENTRY_FEE;
    saveUser(guildId, g);

    const secret = Math.floor(Math.random() * MAX_NUM) + 1;
    let attempts = MAX_ATTEMPTS;
    let lo = 1, hi = MAX_NUM;
    const guesses = [];

    const render = (status = '') => gifEmbed(interaction, '🔢 لعبة التخمين', '', 'guess', 'think', COLORS.info)
      .setDescription(
        `🎯 خمّن رقماً بين **${lo}** و **${hi}**\n` +
        `🎟️ المحاولات: **${attempts}/${MAX_ATTEMPTS}**\n\n` +
        (guesses.length ? `📜 محاولاتك: ${guesses.map(x => `\`${x}\``).join(' • ')}\n\n` : '') +
        (status || '✏️ اكتب رقمك في الشات الآن.')
      ).setFooter(balanceFooter(u));

    const msg = await safeReply(interaction, { embeds: [render()] });

    const collector = interaction.channel.createMessageCollector({
      filter: m => m.author.id === userId && /^\d+$/.test(m.content) && +m.content >= 1 && +m.content <= MAX_NUM,
      time: 90000
    });

    collector.on('collect', async m => {
      const guess = parseInt(m.content);
      attempts--;
      guesses.push(guess);
      try { await m.delete(); } catch {}

      if (guess === secret) return collector.stop('win');
      if (attempts <= 0) return collector.stop('out');

      if (guess < secret) lo = Math.max(lo, guess + 1);
      else hi = Math.min(hi, guess - 1);

      const hint = guess < secret ? '⬆️ الرقم **أكبر**' : '⬇️ الرقم **أصغر**';
      await interaction.editReply({ embeds: [render(`❌ ${guess} خاطئ — ${hint}`)] }).catch(()=>{});
    });

    collector.on('end', async (_c, reason) => {
      const { g: fg, u: fu } = getUser(guildId, userId);
      bumpStat(fu, 'guess_count');
      let final;
      if (reason === 'win') {
        const reward = Math.max(200, 1500 - (MAX_ATTEMPTS - attempts) * 200);
        fu.balance += reward;
        fu.xp += 80;
        bumpStat(fu, 'guess_wins');
        final = winEmbed(interaction, 'إجابة صحيحة!', `🎯 الرقم كان **${secret}**\n📜 محاولاتك: ${guesses.map(x=>`\`${x}\``, 'guess').join(' • ')}\n\n💰 +${fmt(reward)} ${CURRENCY}\n✨ +80 XP`).setFooter(balanceFooter(fu));
      } else if (reason === 'out') {
        final = loseEmbed(interaction, 'انتهت المحاولات', `🎯 الرقم كان **${secret}**\n📜 محاولاتك: ${guesses.map(x=>`\`${x}\``, 'guess').join(' • ')}`).setFooter(balanceFooter(fu));
      } else {
        final = tieEmbed(interaction, 'انتهى الوقت', `🎯 الرقم كان **${secret}**`, 'guess').setFooter(balanceFooter(fu));
      }
      saveUser(guildId, fg);
      await interaction.editReply({ embeds: [final] }).catch(()=>{});
    });
  }
};
