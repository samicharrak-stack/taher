const { SlashCommandBuilder } = require('discord.js');
const {
  fmt, getUser, saveUser, bumpStat,
  brandedEmbed, winEmbed, loseEmbed, balanceFooter, safeReply, errorEmbed, CURRENCY
} = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const COOLDOWN_MS = 15 * 60 * 1000;

module.exports = {
  aliases: ['سرقة', 'اسرق', 'rob'],
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('🕵️ حاول سرقة لاعب — قد تكسب أو تُغرَّم')
    .addUserOption(o => o.setName('target').setDescription('اللاعب المستهدف').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    if (target.id === userId) return safeReply(interaction, { embeds: [errorEmbed('غير مسموح', 'لا يمكنك سرقة نفسك.')], ephemeral: true });
    if (target.bot) return safeReply(interaction, { embeds: [errorEmbed('غير مسموح', 'لا يمكنك سرقة بوت.')], ephemeral: true });

    const { g, u } = getUser(guildId, userId);
    const t = (getUser(guildId, target.id)).u;

    const now = Date.now();
    if (now - (u.last_rob || 0) < COOLDOWN_MS) {
      const left = Math.ceil((COOLDOWN_MS - (now - (u.last_rob || 0))) / 60000);
      return safeReply(interaction, { embeds: [errorEmbed('فترة انتظار', `حاول مجدداً بعد **${left}** دقيقة.`)], ephemeral: true });
    }
    if (t.balance < 100) {
      return safeReply(interaction, { embeds: [errorEmbed('هدف فقير', 'الهدف لا يملك ما يستحق السرقة.')], ephemeral: true });
    }

    u.last_rob = now;
    bumpStat(u, 'rob_count');

    const success = Math.random() < 0.45;
    let final;
    if (success) {
      const steal = Math.max(50, Math.floor(Math.min(t.balance * 0.25, 200 + Math.random() * 600)));
      t.balance -= steal;
      u.balance += steal;
      u.xp += Math.floor(steal / 4);
      bumpStat(u, 'rob_wins');
      final = winEmbed(interaction, 'سرقة ناجحة!', `🎭 سرقت **+${fmt(steal)}** ${CURRENCY} من <@${target.id}>`, 'rob').setFooter(balanceFooter(u));
    } else {
      const fine = Math.floor(100 + Math.random() * 300);
      u.balance = Math.max(0, u.balance - fine);
      final = loseEmbed(interaction, 'تم القبض عليك!', `🚔 الشرطة فرضت غرامة **-${fmt(fine)}** ${CURRENCY}`, 'rob').setFooter(balanceFooter(u));
    }
    saveUser(guildId, g);
    await safeReply(interaction, { embeds: [final] });
  }
};
