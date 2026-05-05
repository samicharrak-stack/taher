const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { readGuild, writeGuild } = require('../../utils/guildStorage');
const { COLORS } = require('../../utils/embeds');

module.exports = {
  aliases: ['levelsettings', 'اعدادات_المستويات', 'إعدادات_المستويات', 'ls'],
  data: new SlashCommandBuilder()
    .setName('levelsettings')
    .setDescription('⭐ إعدادات نظام المستويات والـ XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('status').setDescription('عرض إعدادات المستويات الحالية'))
    .addSubcommand(s => s.setName('toggle').setDescription('تفعيل أو تعطيل نظام الـ XP'))
    .addSubcommand(s => s.setName('message').setDescription('تخصيص رسالة الترقية').addStringOption(o => o.setName('text').setDescription('نص الرسالة').setRequired(true)))
    .addSubcommand(s => s.setName('channel').setDescription('تحديد قناة الترقية').addChannelOption(o => o.setName('channel').setDescription('القناة').setRequired(true)))
    .addSubcommand(s => s.setName('reset').setDescription('إعادة ضبط الإعدادات')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const g = readGuild(guildId);

    if (!g.xp) g.xp = { enabled: true, min: 5, max: 15, cooldown: 5000 };
    if (!g.channels) g.channels = { levels: null };

    const embed = new EmbedBuilder().setTimestamp();

    if (sub === 'status') {
      embed.setColor(COLORS.primary)
        .setTitle('⭐ إعدادات نظام المستويات')
        .addFields(
          { name: 'الحالة', value: g.xp.enabled ? '✅ مفعل' : '❌ معطل', inline: true },
          { name: 'قناة الترقية', value: g.channels.levels ? `<#${g.channels.levels}>` : 'نفس القناة', inline: true },
          { name: 'رسالة الترقية', value: g.levels?.messageTemplate || 'الافتراضية', inline: false }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'toggle') {
      g.xp.enabled = !g.xp.enabled;
      writeGuild(guildId, g);
      embed.setColor(g.xp.enabled ? COLORS.success : COLORS.error)
        .setDescription(`تم ${g.xp.enabled ? 'تفعيل' : 'تعطيل'} نظام الـ XP بنجاح.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      g.channels.levels = channel.id;
      writeGuild(guildId, g);
      embed.setColor(COLORS.success)
        .setDescription(`✅ تم تحديد قناة رسائل الترقية: ${channel}`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'message') {
      const text = interaction.options.getString('text');
      if (!g.levels) g.levels = {};
      g.levels.messageTemplate = text;
      writeGuild(guildId, g);
      embed.setColor(COLORS.success)
        .setTitle('✅ تم تحديث رسالة الترقية')
        .setDescription(`**الرسالة الجديدة:**\n${text}\n\n**المتغيرات:** \`{user}\`, \`{level}\`, \`{oldLevel}\`, \`{xp}\`, \`{nextXP}\``);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'reset') {
      g.xp = { enabled: true, min: 5, max: 15, cooldown: 5000 };
      if (g.levels) delete g.levels;
      if (g.channels) g.channels.levels = null;
      writeGuild(guildId, g);
      embed.setColor(COLORS.warning)
        .setDescription('♻️ تم إعادة ضبط إعدادات المستويات للوضع الافتراضي.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
