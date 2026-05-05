const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  fmt, validateBet, saveUser, bumpStat,
  brandedEmbed, winEmbed, loseEmbed, tieEmbed,
  balanceFooter, playAgainRow, safeReply, CURRENCY
} = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');
const { setEmbedMedia } = require('../../utils/mediaRegistry');

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const VAL   = { A:11, J:10, Q:10, K:10 };

const draw  = () => ({ r: RANKS[Math.floor(Math.random()*RANKS.length)], s: SUITS[Math.floor(Math.random()*SUITS.length)] });
const v     = c => VAL[c.r] || parseInt(c.r);

function total(hand) {
  let t = hand.reduce((a, c) => a + v(c), 0);
  let aces = hand.filter(c => c.r === 'A').length;
  while (t > 21 && aces) { t -= 10; aces--; }
  return t;
}

function fmtHand(h) { return h.map(c => `\`${c.r}${c.s}\``).join(' '); }

function scoreBar(n) {
  if (n === 21) return '🌟 **21!**';
  if (n > 21)  return `💥 **${n}** — تجاوز!`;
  if (n >= 18) return `✅ **${n}** — قوي`;
  if (n >= 12) return `⚠️ **${n}** — خطر`;
  return `🟢 **${n}**`;
}

module.exports = {
  aliases: ['بلاك', 'بلاك_جاك', 'bj', 'blackjack'],
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 بلاك جاك — تحدّى الموزع للوصول إلى 21')
    .addIntegerOption(o => o.setName('bet').setDescription('مبلغ الرهان').setRequired(false).setMinValue(10)),

  async execute(interaction) {
    const val = validateBet(interaction, { min: 10, defaultBet: 100 });
    if (!val.ok) return safeReply(interaction, { embeds: [val.errorEmbed], ephemeral: true });
    const { bet, g, u, guildId, userId } = val;

    u.balance -= bet;
    saveUser(guildId, g);

    const player = [draw(), draw()];
    const dealer = [draw(), draw()];

    const renderEmbed = (revealDealer = false, status = '') => {
      const dealerView  = revealDealer ? fmtHand(dealer) : `${fmtHand([dealer[0]])} \`🂠\``;
      const dealerScore = revealDealer ? scoreBar(total(dealer)) : '`?`';
      const playerScore = scoreBar(total(player));

      const embed = brandedEmbed(interaction, '🃏 طاولة البلاك جاك', COLORS.primary)
        .setDescription(
          `**🤵 الموزّع** ${dealerScore}\n${dealerView}\n\n` +
          `**👤 يدك** ${playerScore}\n${fmtHand(player)}\n\n` +
          (status ? `${status}\n\n` : '') +
          `💰 الرهان: **${fmt(bet)}** ${CURRENCY}`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter(balanceFooter(u));
      setEmbedMedia(embed, 'blackjack', 'deal');
      return embed;
    };

    const controls = (canDouble) => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bj_hit').setLabel('سحب ✋').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('bj_stand').setLabel('وقوف 🛑').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('bj_double').setLabel('مضاعفة ✖️2').setStyle(ButtonStyle.Primary).setDisabled(!canDouble)
    );

    // Natural blackjack
    if (total(player) === 21) {
      const win = Math.floor(bet * 2.5);
      u.balance += win;
      bumpStat(u, 'bj_wins'); bumpStat(u, 'bj_count');
      saveUser(guildId, g);
      const e = winEmbed(interaction, '⭐ بلاك جاك طبيعي!',
        `🤵 الموزع: ${fmtHand(dealer)} **(${total(dealer)})**\n` +
        `👤 أنت: ${fmtHand(player)} **(21)**\n\n` +
        `💰 ربحت: **+${fmt(win - bet)}** ${CURRENCY} *(×2.5)*`
      );
      setEmbedMedia(e, 'slots', 'jackpot');
      e.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true })).setFooter(balanceFooter(u));
      return safeReply(interaction, { embeds: [e], components: [playAgainRow(`bj_again_${bet}`, '🃏 جولة أخرى')] });
    }

    const msg = await safeReply(interaction, { embeds: [renderEmbed(false)], components: [controls(u.balance >= bet)] });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 90000 });
    let currentBet = bet, doubled = false;

    collector.on('collect', async i => {
      if (i.customId === 'bj_hit') {
        player.push(draw());
        if (total(player) > 21) {
          collector.stop('bust');
          return i.update({ embeds: [renderEmbed(true, '💥 **تجاوزت 21!**')], components: [] });
        }
        return i.update({ embeds: [renderEmbed(false)], components: [controls(false)] });
      }
      if (i.customId === 'bj_double') {
        if (u.balance < currentBet) return i.reply({ content: '❌ رصيد غير كافٍ للمضاعفة.', ephemeral: true });
        u.balance -= currentBet; currentBet *= 2; doubled = true;
        saveUser(guildId, g);
        player.push(draw());
        collector.stop(total(player) > 21 ? 'bust' : 'stand');
        return i.update({ embeds: [renderEmbed(true, '✖️2 **مضاعفة!**')], components: [] });
      }
      if (i.customId === 'bj_stand') {
        collector.stop('stand');
        return i.deferUpdate();
      }
    });

    collector.on('end', async (_c, reason) => {
      if (reason === 'time') {
        return interaction.editReply({ embeds: [renderEmbed(true, '⏰ انتهى الوقت — توقف تلقائي')], components: [] }).catch(() => {});
      }
      if (reason !== 'bust') {
        while (total(dealer) < 17) dealer.push(draw());
      }
      const pT = total(player), dT = total(dealer);
      let result, payout = 0;
      if (pT > 21)             { result = 'bust'; }
      else if (dT > 21 || pT > dT) { result = 'win'; payout = currentBet * 2; }
      else if (pT === dT)      { result = 'tie'; payout = currentBet; }
      else                     { result = 'lose'; }

      u.balance += payout;
      bumpStat(u, 'bj_count');
      if (result === 'win') bumpStat(u, 'bj_wins');
      saveUser(guildId, g);

      const dealerFinal = `🤵 الموزّع **(${dT})**\n${fmtHand(dealer)}\n\n👤 أنت **(${pT})**\n${fmtHand(player)}`;

      let finalEmbed;
      if (result === 'win') {
        finalEmbed = winEmbed(interaction, 'فوز!', `${dealerFinal}\n\n💰 **+${fmt(payout - currentBet)}** ${CURRENCY}`);
        setEmbedMedia(finalEmbed, 'blackjack', 'win');
      } else if (result === 'tie') {
        finalEmbed = tieEmbed(interaction, 'تعادل', `${dealerFinal}\n\n🤝 استرجعت رهانك.`);
        setEmbedMedia(finalEmbed, 'general', 'loading');
      } else {
        const title = pT > 21 ? 'تجاوزت 21!' : 'الموزع فاز';
        finalEmbed = loseEmbed(interaction, title, `${dealerFinal}\n\n💸 **-${fmt(currentBet)}** ${CURRENCY}${doubled ? '\n*✖️2 كان لعب مضاعفة*' : ''}`);
        setEmbedMedia(finalEmbed, 'blackjack', 'bust');
      }

      finalEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true })).setFooter(balanceFooter(u));
      await interaction.editReply({ embeds: [finalEmbed], components: [playAgainRow(`bj_again_${bet}`, '🃏 جولة أخرى')] }).catch(() => {});
    });
  }
};
