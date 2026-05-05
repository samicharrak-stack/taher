const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { brandedEmbed, tieEmbed, safeReply } = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');
const { truth, dare } = require('../../data/tod');

module.exports = {
  aliases: ['tod', 'صراحة', 'حقيقة', 'جرأة'],
  data: new SlashCommandBuilder()
    .setName('tod')
    .setDescription('🎲 حقيقة أم جرأة')
    .addUserOption(o => o.setName('target').setDescription('تحدّى شخصاً معيّناً')),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const player = target || interaction.user;

    const intro = brandedEmbed(interaction, '🎲 حقيقة أم جرأة؟', COLORS.royal || COLORS.info)
      .setDescription(`الدور على: <@${player.id}>\n\n• **حقيقة** — سؤال صريح\n• **جرأة** — تحدٍّ مثير\n• **عشوائي** — اختر الحظ\n\n⏱️ لديك 30 ثانية.`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tod_truth').setLabel('🗣️ حقيقة').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('tod_dare').setLabel('🔥 جرأة').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('tod_random').setLabel('❓ عشوائي').setStyle(ButtonStyle.Secondary)
    );
    const msg = await safeReply(interaction, { content: target ? `<@${target.id}>` : null, embeds: [intro], components: [row] });

    const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
    col.on('collect', async i => {
      if (i.user.id !== player.id) return i.reply({ content: `هذا الدور لـ ${player.username} فقط.`, ephemeral: true });
      if (i.customId === 'tod_back') return i.update({ embeds: [intro], components: [row] });
      let type = i.customId === 'tod_random' ? (Math.random() < 0.5 ? 'tod_truth' : 'tod_dare') : i.customId;
      const isTruth = type === 'tod_truth';
      const list = isTruth ? truth : dare;
      const q = list[Math.floor(Math.random() * list.length)];
      const e = brandedEmbed(interaction, isTruth ? '🗣️ حقيقة' : '🔥 جرأة', isTruth ? COLORS.info : COLORS.error)
        .setDescription(`المطلوب من <@${player.id}>:\n\n> ${q}`);
      const back = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tod_back').setLabel('🔙 رجوع').setStyle(ButtonStyle.Secondary)
      );
      await i.update({ content: null, embeds: [e], components: [back] });
    });
    col.on('end', (c, r) => { if (r === 'time') interaction.editReply({ embeds: [tieEmbed(interaction, 'انتهى الوقت', `${player.username} لم يختر.`, 'generic')], components: [] }).catch(()=>{}); });
  }
};
