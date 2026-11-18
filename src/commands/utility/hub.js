// 🕸️ /hub — لوحة الشبكة: كل أنظمتك (رصيد، مستوى، ستريك، دانجون، مزرعة، ألعاب) في بطاقة واحدة مترابطة
const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { readGuild } = require('../../utils/guildStorage');
const { xpForLevel } = require('../../systems/levels');
const { levelSnapshot } = require('../../systems/levelInfo');
const streak = require('../../systems/streak');

function rows() {
  const { LABELS } = require('../../systems/network');
  const pick = ['daily', 'streak', 'balance', 'work', 'bank', 'rank', 'leaderboard', 'dungeon', 'farm', 'gamesinfo', 'quests', 'shop'];
  const menu = new StringSelectMenuBuilder().setCustomId('net:menu').setPlaceholder('✦  افتح نظاماً من لوحتك')
    .addOptions(pick.filter((n) => LABELS[n]).map((n) => ({ label: LABELS[n][0], value: n, emoji: LABELS[n][1] })));
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('net:daily').setEmoji('🎁').setLabel('المكافأة اليومية').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('net:dungeon').setEmoji('⚔️').setLabel('الدانجون').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('net:farm').setEmoji('🌾').setLabel('المزرعة').setStyle(ButtonStyle.Secondary)),
    new ActionRowBuilder().addComponents(menu),
  ];
}

module.exports = {
  aliases: ['لوحة', 'لوحتي', 'شبكة', 'هب', 'الكل', 'hub'],
  cooldown: 4,
  data: new SlashCommandBuilder()
    .setName('hub')
    .setDescription('🕸️ لوحة الشبكة — كل أنظمتك مترابطة في بطاقة واحدة متحركة')
    .addUserOption((o) => o.setName('user').setDescription('عرض لوحة عضو آخر')),

  async execute(interaction) {
    if (typeof interaction.deferReply === 'function') await interaction.deferReply().catch(() => {});
    const target = interaction.options?.getUser?.('user') || interaction.user;
    const g = readGuild(interaction.guildId);
    const snap = levelSnapshot(g, interaction.guild, target.id, xpForLevel);
    const u = snap.u || {};
    const s = streak.status(u);
    let hunterRank = 'E';
    try { hunterRank = require('../../data/rpg').getHunterRank(u.dungeon_wins || 0, u.level || 1)?.rank || 'E'; } catch {}
    const st = u.stats || {};
    const games = st.games_played ?? ((st.slots_count || 0) + (st.bj_count || 0) + (st.roulette_count || 0) + (st.coinflip_count || 0) + (st.rps_count || 0));
    const member = interaction.guild?.members?.cache?.get(target.id);
    const name = member?.displayName || target.globalName || target.username;
    const bank = Math.max(0, (u.bank || 0) - (u.loan || 0));
    const card = await require('../../utils/networkCards').hubCard({
      username: name, avatarURL: target.displayAvatarURL({ extension: 'png', size: 256 }),
      level: snap.level, ratio: snap.xp / Math.max(1, snap.nextXP), balance: u.balance || 0, bank,
      streak: s.count, mult: s.mult, dungeonWins: u.dungeon_wins || 0, hunterRank,
      farmLevel: u.farm?.level || 1, harvested: u.farm?.totalHarvested || 0, rank: snap.rank, totalUsers: snap.totalUsers, games,
    }).catch(() => null);
    const embed = new EmbedBuilder().setColor(0x4FA3FF).setAuthor({ name: `🕸️ لوحة ${name}`, iconURL: target.displayAvatarURL() });
    const files = [];
    if (card?.buffer) { files.push(new AttachmentBuilder(card.buffer, { name: card.name })); embed.setImage(`attachment://${card.name}`); }
    else embed.setDescription(`⭐ مستوى **${snap.level}** • 💎 **${(u.balance || 0).toLocaleString()}** • 🔥 **${s.count}** يوم • ⚔️ ${hunterRank}`);
    const payload = { embeds: [embed], files, components: rows() };
    return interaction.deferred ? interaction.editReply(payload) : interaction.reply(payload);
  },
};
