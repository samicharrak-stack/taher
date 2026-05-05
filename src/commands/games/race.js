const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  fmt, getUser, saveUser, bumpStat, validateBet,
  brandedEmbed, winEmbed, loseEmbed, tieEmbed,
  balanceFooter, safeReply, CURRENCY
} = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');
const { setEmbedMedia } = require('../../utils/mediaRegistry');

const ANIMALS = [
  { name: 'الحصان العربي', emoji: '🐎', speed: 1.0, color: '🟤' },
  { name: 'الفهد',          emoji: '🐆', speed: 1.1, color: '🟡' },
  { name: 'الأرنب',         emoji: '🐇', speed: 0.9, color: '⚪' },
  { name: 'الكلب السلوقي',  emoji: '🐕', speed: 1.0, color: '🟠' },
  { name: 'الكنغر',         emoji: '🦘', speed: 1.05, color: '🔴' }
];
const TRACK = 20;

function trackLine(pos, emoji, isLeader = false) {
  const i = Math.min(Math.floor(pos), TRACK - 1);
  const lane = Array(TRACK).fill('·');
  lane[i] = emoji;
  return `${isLeader ? '⭐' : '  '}\`${lane.join('')}\`🏁`;
}

function raceBoard(racers, pickedIndex, label = '') {
  const leader = racers.reduce((a, b) => a.pos > b.pos ? a : b);
  return racers
    .map((r, idx) => {
      const isLead = r === leader;
      const isPicked = idx === pickedIndex;
      return `${isPicked ? '🎯' : '  '} **#${idx+1}** ${r.emoji} ${r.name} ${isPicked ? '*(رهانك)*' : ''}\n${trackLine(r.pos, r.emoji, isLead)}`;
    }).join('\n') + (label ? `\n\n${label}` : '');
}

module.exports = {
  aliases: ['سباق', 'race'],
  data: new SlashCommandBuilder()
    .setName('race')
    .setDescription('🏇 سباق الحيوانات — راهن على الفائز واربح 3.5×!')
    .addIntegerOption(o => o.setName('bet').setDescription('مبلغ الرهان').setRequired(true).setMinValue(50)),

  async execute(interaction) {
    const v = validateBet(interaction, { min: 50, defaultBet: 100 });
    if (!v.ok) return safeReply(interaction, { embeds: [v.errorEmbed], ephemeral: true });
    const { bet, g, u, guildId, userId } = v;

    const racers = ANIMALS.slice().sort(() => Math.random() - 0.5).slice(0, 4)
      .map(a => ({ ...a, pos: 0 }));

    const choose = brandedEmbed(interaction, '🏇 ميدان السباق', COLORS.info)
      .setDescription(
        `💰 الرهان: **${fmt(bet)}** ${CURRENCY}\n\n` +
        `**المتسابقون:**\n` +
        racers.map((r, i) => `${r.color} **${i+1}.** ${r.emoji} ${r.name}`).join('\n') +
        `\n\n👇 **اختر الفائز خلال 20 ثانية!**\n🏆 الربح عند الفوز: **${fmt(Math.floor(bet*3.5))}** ${CURRENCY} *(×3.5)*`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
    setEmbedMedia(choose, 'race', 'start');

    const row = new ActionRowBuilder().addComponents(
      racers.map((_, i) => new ButtonBuilder().setCustomId(`race_pick_${i}`).setLabel(`${racers[i].emoji} #${i+1}`).setStyle(ButtonStyle.Primary))
    );
    const msg = await safeReply(interaction, { embeds: [choose], components: [row] });

    const pickCol = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 20000, max: 1 });

    pickCol.on('collect', async i => {
      const pickedIndex = parseInt(i.customId.split('_').pop(), 10);
      u.balance -= bet;
      saveUser(guildId, g);

      const renderEmbed = (label = '') => {
        const embed = brandedEmbed(interaction, '🏇 السباق منطلق!', COLORS.primary)
          .setDescription(raceBoard(racers, pickedIndex, label))
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
        setEmbedMedia(embed, 'race', 'running');
        return embed;
      };

      await i.update({ embeds: [renderEmbed('🟢 **استعد...**')], components: [] });
      await new Promise(r => setTimeout(r, 800));

      let winner = -1, tick = 0;
      while (winner === -1) {
        await new Promise(r => setTimeout(r, 1000));
        tick++;
        racers.forEach(r => {
          const burst = Math.random() < 0.2 ? 1.5 : 1.0;
          r.pos += (0.8 + Math.random() * 2.0) * r.speed * burst;
        });
        const leader = racers.findIndex(r => r.pos >= TRACK);
        if (leader >= 0) winner = leader;
        const leadName = racers.reduce((a, b) => a.pos > b.pos ? a : b).name;
        await interaction.editReply({ embeds: [renderEmbed(`${tick % 2 === 0 ? '🔴' : '🟡'} يتقدّم: **${leadName}**`)] }).catch(() => {});
        if (tick > 25) { winner = racers.reduce((mi, r, i, a) => r.pos > a[mi].pos ? i : mi, 0); break; }
      }

      bumpStat(u, 'race_count');
      let final;
      if (winner === pickedIndex) {
        const winAmt = Math.floor(bet * 3.5);
        u.balance += winAmt; u.xp += 100;
        bumpStat(u, 'race_wins');
        final = winEmbed(interaction, `🏆 فوز! ${racers[winner].emoji} فاز!`,
          `🏆 الفائز: **${racers[winner].emoji} ${racers[winner].name}**\n` +
          `🎯 رهانك كان صحيحاً!\n💰 **+${fmt(winAmt)}** ${CURRENCY} *(×3.5)*`
        );
        setEmbedMedia(final, 'race', 'win');
      } else {
        final = loseEmbed(interaction, `خسارة — ${racers[winner].emoji} فاز!`,
          `🏆 الفائز: **${racers[winner].emoji} ${racers[winner].name}**\n` +
          `😔 اخترت: **${racers[pickedIndex].emoji} ${racers[pickedIndex].name}**\n💸 **-${fmt(bet)}** ${CURRENCY}`
        );
        setEmbedMedia(final, 'race', 'lose');
      }
      saveUser(guildId, g);
      final.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true })).setFooter(balanceFooter(u));
      await interaction.editReply({ embeds: [final], components: [] }).catch(() => {});
    });

    pickCol.on('end', c => {
      if (c.size === 0) {
        const t = tieEmbed(interaction, 'انتهى الوقت', 'لم تختر متسابقاً.');
        setEmbedMedia(t, 'race', 'lose');
        interaction.editReply({ embeds: [t], components: [] }).catch(() => {});
      }
    });
  }
};
