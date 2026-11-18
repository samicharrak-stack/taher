// 🔥 /streak — بطاقة الستريك المتحركة + متجر دروع الحماية
const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { readGuild, writeGuild } = require('../../utils/guildStorage');
const streak = require('../../systems/streak');
const config = require('../../config');

async function render(interaction, target) {
  const g = readGuild(interaction.guildId);
  const u = g.users?.[target.id] || {};
  const s = streak.status(u);
  const member = interaction.guild?.members?.cache?.get(target.id);
  const name = member?.displayName || target.globalName || target.username;
  const card = await require('../../utils/networkCards').streakCard({
    username: name, avatarURL: target.displayAvatarURL({ extension: 'png', size: 256 }), status: s,
  }).catch(() => null);
  const mine = target.id === interaction.user.id;
  const price = streak.shieldPrice(u);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('streak:shield').setEmoji('🛡️').setLabel(s.shields >= streak.MAX_SHIELDS ? 'الدروع ممتلئة' : `شراء درع (${price.toLocaleString()})`)
      .setStyle(ButtonStyle.Success).setDisabled(!mine || s.shields >= streak.MAX_SHIELDS),
    new ButtonBuilder().setCustomId('streak:info').setEmoji('📖').setLabel('كيف يعمل؟').setStyle(ButtonStyle.Secondary),
  );
  const color = s.count >= 30 ? 0xFFD76A : s.count >= 7 ? 0xFF9F43 : 0x99A3B5;
  const embed = new EmbedBuilder().setColor(color)
    .setAuthor({ name: `🔥 ستريك ${name}`, iconURL: target.displayAvatarURL() });
  const files = [];
  if (card?.buffer) { files.push(new AttachmentBuilder(card.buffer, { name: card.name })); embed.setImage(`attachment://${card.name}`); }
  else embed.setDescription(`🔥 **${s.count}** يوم • أفضل: **${s.best}** • المضاعف **x${s.mult.toFixed(2)}** • 🛡️ ${s.shields}/3`);
  return { embeds: [embed], files, components: [row, require('../../systems/network').navMenu('streak')].filter(Boolean) };
}

module.exports = {
  aliases: ['ستريك', 'سلسلة', 'سلسلتي', 'streak'],
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('🔥 سلسلة نشاطك اليومي — مضاعف المكافآت والدروع والمحطات')
    .addUserOption((o) => o.setName('user').setDescription('عرض ستريك عضو آخر')),

  async execute(interaction) {
    if (typeof interaction.deferReply === 'function') await interaction.deferReply().catch(() => {});
    const target = interaction.options?.getUser?.('user') || interaction.user;
    const payload = await render(interaction, target);
    return interaction.deferred ? interaction.editReply(payload) : interaction.reply(payload);
  },

  async button(interaction) {
    const action = interaction.customId.split(':')[1];
    if (action === 'info') {
      const lines = streak.MILESTONES.map((m) => `${m.emoji} **${m.days} يوم** — ${m.title} • +${m.reward.toLocaleString()} ${config.CURRENCY || '💎'}`);
      return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0xFF9F43).setTitle('🔥 نظام الستريك').setDescription(
        '• أي نشاط يومي (رسالة أو أمر) يزيد سلسلتك يوماً.\n' +
        '• كل يوم = **+5%** خبرة رسائل و **+1%** على اليومي، العمل، الدانجون والمزرعة (كلاهما حتى **+50%**).\n' +
        '• فوّت يوماً واحداً؟ **الدرع 🛡️** ينقذ سلسلتك تلقائياً (حتى 3 دروع).\n\n**المحطات:**\n' + lines.join('\n'))] });
    }
    if (action === 'shield') {
      const g = readGuild(interaction.guildId);
      g.users = g.users || {};
      const u = g.users[interaction.user.id] = g.users[interaction.user.id] || { balance: config.DEFAULT_BALANCE || 1000, xp: 0, level: 1 };
      const r = streak.buyShield(u);
      if (!r.ok) return interaction.reply({ ephemeral: true, content: r.reason === 'max' ? '🛡️ عندك الحد الأقصى من الدروع (3).' : `💸 تحتاج **${r.price.toLocaleString()}** 💎 لشراء درع.` });
      writeGuild(interaction.guildId, g);
      await interaction.update(await render(interaction, interaction.user)).catch(() => {});
      return interaction.followUp({ ephemeral: true, content: `🛡️ اشتريت درعاً بـ **${r.price.toLocaleString()}** 💎 — عندك الآن **${r.shields}** دروع.` });
    }
  },
};
