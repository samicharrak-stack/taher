const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createStyledEmbed, COLORS } = require('../../utils/embeds');

// List of available colors with their names and hex codes
const COLORS_LIST = [
  { name: 'أحمر', hex: '#FF0000' },
  { name: 'أزرق', hex: '#0000FF' },
  { name: 'أخضر', hex: '#00FF00' },
  { name: 'أصفر', hex: '#FFFF00' },
  { name: 'بنفسجي', hex: '#800080' },
  { name: 'برتقالي', hex: '#FFA500' },
  { name: 'وردي', hex: '#FFC0CB' },
  { name: 'سماوي', hex: '#00FFFF' },
  { name: 'أبيض', hex: '#FFFFFF' },
  { name: 'أسود', hex: '#000000' },
  { name: 'ذهبي', hex: '#FFD700' },
  { name: 'فضي', hex: '#C0C0C0' },
  { name: 'بني', hex: '#A52A2A' },
  { name: 'رمادي', hex: '#808080' },
  { name: 'نيلي', hex: '#4B0082' }
];

module.exports = {
  aliases: ['colors', 'الوان', 'ألوان', 'clr'],
  data: new SlashCommandBuilder()
    .setName('colors')
    .setDescription('اختيار لون للرتبة الخاصة بك')
    .addIntegerOption(option => 
      option.setName('number')
        .setDescription('رقم اللون الذي تريده')
        .setRequired(false)),
  
  async execute(interaction) {
    const guild = interaction.guild;
    const member = interaction.member;
    const colorNumber = interaction.options?.getInteger('number');

    // If a color number is provided, try to apply it directly
    if (colorNumber) {
      const index = colorNumber - 1;
      if (index >= 0 && index < COLORS_LIST.length) {
        return applyColor(interaction, member, index);
      } else {
        return interaction.reply({ content: `❌ رقم اللون غير صحيح. يرجى اختيار رقم بين 1 و ${COLORS_LIST.length}.`, ephemeral: true });
      }
    }

    // Otherwise, show the list of colors
    const embed = createStyledEmbed(interaction, '🎨 قائمة الألوان المتاحة', COLORS.primary)
      .setDescription(COLORS_LIST.map((c, i) => `**${i + 1}.** ${c.name}`).join('\n') + '\n\n💡 اكتب `/colors` متبوعاً برقم اللون، أو استخدم الاختصار `الوان [الرقم]`.')
      .setFooter({ text: 'ملاحظة: سيتم إنشاء رتبة جديدة بلونك المختار إذا لم تكن موجودة.' });

    return interaction.reply({ embeds: [embed] });
  }
};

async function applyColor(interaction, member, index) {
  const color = COLORS_LIST[index];
  const guild = interaction.guild;
  const roleName = `Color-${color.name}`;

  try {
    // 1. Initial Checks
    const botMember = await guild.members.fetchMe();
    
    // NEW: If bot doesn't have a high-level manageable role, try to create one or use permissions
    if (!botMember.permissions.has('ManageRoles')) {
       // Check if the user is an administrator to allow them to "fix" the bot
       if (member.permissions.has('Administrator')) {
          try {
            const newBotRole = await guild.roles.create({
              name: 'Taher System',
              color: '#3498db',
              permissions: ['ManageRoles', 'ManageChannels', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis'],
              reason: 'إنشاء رتبة النظام لتشغيل الألوان والخدمات'
            });
            await botMember.roles.add(newBotRole);
            await interaction.reply({ content: '✅ تم إنشاء رتبة جديدة للبوت (**Taher System**) وتزويدها بالصلاحيات. يرجى سحبها للأعلى في إعدادات السيرفر لتفعيل الألوان.', ephemeral: true });
            return;
          } catch (e) {
            return interaction.reply({ content: '❌ فشل إنشاء رتبة للبوت. يرجى إعطائي رتبة يدوياً تملك صلاحية "إدارة الرتب".', ephemeral: true });
          }
       }
       return interaction.reply({ content: '❌ البوت لا يملك صلاحية "إدارة الرتب". اطلب من الإدارة تفعيلها.', ephemeral: true });
    }

    // 2. Find or Create the Role
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
      role = await guild.roles.create({
        name: roleName,
        color: color.hex,
        reason: `إضافة لون جديد للعضو: ${member.user.tag}`
      });
    }

    // 3. Hierarchy Logic: Attempt to move the role as high as possible
    const botHighestRole = botMember.roles.highest;
    const targetPosition = botHighestRole.position - 1;

    if (role.position < targetPosition && targetPosition > 0) {
      try {
        // Try multiple methods to move the role
        await role.setPosition(targetPosition).catch(() => {});
        // Refresh cache
        await new Promise(resolve => setTimeout(resolve, 500));
        role = await guild.roles.fetch(role.id, { force: true });
      } catch (e) {
        console.error('Hierarchy move failed:', e.message);
      }
    }

    // 4. Update Member Roles
    // Re-fetch member to ensure we have latest roles
    const currentMember = await member.fetch({ force: true });
    
    // Remove any other color roles
    const otherColorRoles = currentMember.roles.cache.filter(r => r.name.startsWith('Color-') && r.id !== role.id);
    if (otherColorRoles.size > 0) {
      await currentMember.roles.remove(otherColorRoles).catch(() => {});
    }

    // Add the new color role
    await currentMember.roles.add(role);

    // 5. Verify and Warn
    // Final check: Is there a colored role above the new one?
    const finalMember = await currentMember.fetch({ force: true });
    const rolesWithColor = finalMember.roles.cache
      .filter(r => r.color !== 0)
      .sort((a, b) => b.position - a.position);
    
    const topColoredRole = rolesWithColor.first();
    
    let statusMessage = `✅ تم تطبيق اللون **${color.name}** بنجاح!`;
    let warningMessage = '';

    if (topColoredRole && topColoredRole.id !== role.id) {
      warningMessage = `\n\n⚠️ **تنبيه**: لونك لم يتغير لأن رتبة (**${topColoredRole.name}**) موجودة فوق رتبة اللون في قائمة الرتب.
💡 **الحل**:
1. اذهب لإعدادات السيرفر -> الأدوار.
2. اسحب رتبة البوت (**${botMember.displayName}**) لتكون في أعلى القائمة.
3. أو اجعل لون رتبة **${topColoredRole.name}** "تلقائي" (بدون لون).`;
    }

    const embed = createStyledEmbed(interaction, '🎨 نظام الألوان', color.hex)
      .setDescription(`${statusMessage}${warningMessage}`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

    return interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Colors system error:', error);
    return interaction.reply({ 
      content: `❌ حدث خطأ تقني: ${error.message}\nتأكد من أن رتبة البوت أعلى من رتب الألوان التي يحاول إدارتها.`, 
      ephemeral: true 
    });
  }
}
