const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  fmt, validateBet, getUser, saveUser, bumpStat,
  brandedEmbed, gifEmbed, winEmbed, loseEmbed, tieEmbed,
  balanceFooter, safeReply, errorEmbed, CURRENCY
} = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const ATTACKS = [
  { name: 'ضربة سيف',    emoji: '⚔️', dmg: [12, 22], crit: 0.15 },
  { name: 'سهم سامّ',     emoji: '🏹', dmg: [8, 18],  crit: 0.25 },
  { name: 'كرة نارية',    emoji: '🔥', dmg: [15, 28], crit: 0.10 },
  { name: 'صاعقة',        emoji: '⚡', dmg: [18, 32], crit: 0.05 },
];

function pickAttack() { return ATTACKS[Math.floor(Math.random() * ATTACKS.length)]; }

function bar(hp, max, size = 16) {
  const pct = Math.max(0, Math.min(1, hp / max));
  const filled = Math.round(pct * size);
  return '🟥'.repeat(filled) + '⬛'.repeat(size - filled) + ` ${Math.max(0, hp)}/${max}`;
}

module.exports = {
  aliases: ['تحدي', 'challenge'],
  data: new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('⚔️ تحدّى لاعباً في معركة ملحمية')
    .addUserOption(o => o.setName('opponent').setDescription('الخصم').setRequired(true))
    .addIntegerOption(o => o.setName('bet').setDescription('الرهان').setMinValue(50)),

  async execute(interaction) {
    const opponent = interaction.options.getUser('opponent');
    const bet = interaction.options.getInteger('bet') || 100;
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    if (opponent.id === userId) return safeReply(interaction, { embeds: [errorEmbed('غير مسموح', 'لا يمكنك تحدي نفسك.')], ephemeral: true });
    if (opponent.bot) return safeReply(interaction, { embeds: [errorEmbed('غير مسموح', 'لا يمكنك تحدي البوتات.')], ephemeral: true });

    const u1 = getUser(guildId, userId).u;
    const u2 = getUser(guildId, opponent.id).u;
    if (u1.balance < bet) return safeReply(interaction, { embeds: [errorEmbed('رصيد غير كافٍ', `تحتاج ${fmt(bet)} ${CURRENCY}.`)], ephemeral: true });
    if (u2.balance < bet) return safeReply(interaction, { embeds: [errorEmbed('رصيد الخصم غير كافٍ', `الخصم لا يملك ${fmt(bet)}.`)], ephemeral: true });

    const invite = gifEmbed(interaction, '⚔️ دعوة معركة', '', 'challenge', 'play', COLORS.warning)
      .setDescription(`<@${userId}> يتحدى <@${opponent.id}> في معركة!\n\n💰 الرهان: **${fmt(bet)}** ${CURRENCY}\n⏱️ 60 ثانية للقبول.`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ch_accept').setLabel('قبول ⚔️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ch_decline').setLabel('رفض ❌').setStyle(ButtonStyle.Danger)
    );
    const msg = await safeReply(interaction, { content: `<@${opponent.id}>`, embeds: [invite], components: [row] });

    const accept = msg.createMessageComponentCollector({ filter: i => i.user.id === opponent.id, time: 60000, max: 1 });
    accept.on('collect', async i => {
      if (i.customId === 'ch_decline') return i.update({ content: null, embeds: [tieEmbed(interaction, 'رُفض التحدي', `<@${opponent.id}> رفض المعركة.`, 'challenge')], components: [] });

      let p1 = { id: userId, name: interaction.member?.displayName || interaction.user.username, hp: 100 };
      let p2 = { id: opponent.id, name: opponent.username, hp: 100 };
      let turn = Math.random() < 0.5 ? 0 : 1;
      const log = [];

      const renderEmbed = (status = '') => gifEmbed(interaction, '⚔️ ساحة المعركة', '', 'challenge', 'play', COLORS.primary)
        .setDescription(
          `**${p1.name}**\n${bar(p1.hp, 100)}\n\n**${p2.name}**\n${bar(p2.hp, 100)}\n\n` +
          (log.length ? `📜 سجل المعركة:\n${log.slice(-4).map(x => `• ${x}`).join('\n')}` : '') +
          (status ? `\n\n${status}` : '')
        );

      const fightRow = (current) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ch_attack').setLabel(`⚔️ هجوم — دور ${current.name}`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ch_defend').setLabel('🛡️ دفاع').setStyle(ButtonStyle.Primary)
      );

      await i.update({ content: null, embeds: [renderEmbed('🎲 بدأت المعركة!')], components: [fightRow(turn === 0 ? p1 : p2)] });

      const fightCol = msg.createMessageComponentCollector({
        filter: c => [userId, opponent.id].includes(c.user.id) && (c.customId === 'ch_attack' || c.customId === 'ch_defend'),
        time: 5 * 60 * 1000
      });

      let defending = { 0: false, 1: false };

      fightCol.on('collect', async c => {
        const current = turn === 0 ? p1 : p2;
        if (c.user.id !== current.id) return c.reply({ content: 'ليس دورك ⏳', ephemeral: true });

        const target = turn === 0 ? p2 : p1;
        if (c.customId === 'ch_defend') {
          defending[turn] = true;
          log.push(`🛡️ ${current.name} يتحصّن!`);
        } else {
          const atk = pickAttack();
          let dmg = atk.dmg[0] + Math.floor(Math.random() * (atk.dmg[1] - atk.dmg[0] + 1));
          let crit = Math.random() < atk.crit;
          if (crit) dmg = Math.floor(dmg * 1.8);
          const targetIdx = turn === 0 ? 1 : 0;
          if (defending[targetIdx]) { dmg = Math.floor(dmg / 2); defending[targetIdx] = false; log.push(`🛡️ ${target.name} تصدّى! نصف الضرر.`); }
          target.hp -= dmg;
          log.push(`${atk.emoji} ${current.name} استخدم **${atk.name}** ${crit ? '💥 ضربة قاتلة!' : ''} — **-${dmg}** HP`);
        }

        // Check end
        if (p1.hp <= 0 || p2.hp <= 0) {
          fightCol.stop('done');
          const winnerObj = p1.hp <= 0 ? p2 : p1;
          const loserObj  = p1.hp <= 0 ? p1 : p2;
          const fg = getUser(guildId, userId).g;
          fg.users[winnerObj.id] = fg.users[winnerObj.id] || {};
          fg.users[loserObj.id]  = fg.users[loserObj.id]  || {};
          fg.users[winnerObj.id].balance = (fg.users[winnerObj.id].balance || 0) + bet;
          fg.users[loserObj.id].balance  = Math.max(0, (fg.users[loserObj.id].balance || 0) - bet);
          bumpStat(fg.users[winnerObj.id], 'challenge_wins');
          bumpStat(fg.users[winnerObj.id], 'challenge_count');
          bumpStat(fg.users[loserObj.id], 'challenge_count');
          saveUser(guildId, fg);

          const final = winEmbed(interaction, 'انتهت المعركة',
            `🏆 الفائز: <@${winnerObj.id}>\n💰 +${fmt(bet)} ${CURRENCY}\n\n📜 آخر اللحظات:\n${log.slice(-5).map(x=>`• ${x}`).join('\n')}`
          , 'challenge');
          return c.update({ embeds: [final], components: [] });
        }

        turn = turn === 0 ? 1 : 0;
        await c.update({ embeds: [renderEmbed()], components: [fightRow(turn === 0 ? p1 : p2)] });
      });

      fightCol.on('end', (_x, reason) => {
        if (reason !== 'done') interaction.editReply({ embeds: [tieEmbed(interaction, 'انتهى الوقت', 'المعركة انتهت بالتعادل.', 'challenge')], components: [] }).catch(()=>{});
      });
    });
  }
};
