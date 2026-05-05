const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { COLORS, createModernEmbed, createDetailedEmbed, DESIGN } = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  aliases: ['مساعدة', 'اوامر', 'دليل', 'help'],
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📚 عرض دليل الأوامر الشامل'),
  async execute(interaction) {
    const embed = createModernEmbed(interaction, '📚 دليل أوامر سامي المطور', `مرحباً بك في نظام **سامي** المتطور. استخدم القائمة أدناه لاستكشاف جميع الأوامر المتاحة وتخصيص تجربتك.`, COLORS.royal)
      .addFields(
        { name: `${DESIGN.money} الاقتصاد`, value: 'نظام مالي متكامل يشمل العمل والجوائز.', inline: true },
        { name: `${DESIGN.sword} الـ RPG`, value: 'مغامرات في الدانجون، المزرعة، والمستويات.', inline: true },
        { name: `🎮 الألعاب`, value: 'مجموعة من الألعاب التفاعلية الممتعة.', inline: true }
      )
      .setImage('https://cdn.discordapp.com/attachments/1470839860594999593/1472741198572683470/standard.gif')
      .setFooter({ text: `استخدم القائمة أدناه للتنقل • ${config.SERVER_NAME}` });

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('help_category')
          .setPlaceholder('📂 اختر فئة الأوامر...')
          .addOptions([
            { label: 'الاقتصاد', value: 'economy', emoji: '💰', description: 'أوامر المال، العمل، والجوائز' },
            { label: 'الـ RPG والمستويات', value: 'rpg', emoji: '⚔️', description: 'نظام اللفلات، الرتب، والدانجون' },
            { label: 'الألعاب', value: 'games', emoji: '🎮', description: 'ألعاب الحظ والتحديات' },
            { label: 'الإدارة والإعدادات', value: 'admin', emoji: '⚙️', description: 'أدوات الإدارة وتخصيص البوت' },
            { label: 'أدوات عامة', value: 'utility', emoji: '🛠️', description: 'أدوات مساعدة وخدمات' }
          ])
      );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ هذا الأمر ليس لك!', ephemeral: true });

      const category = i.values[0];
      let title = '';
      let fields = [];
      let color = COLORS.royal;

      switch (category) {
        case 'economy':
          title = '💰 أوامر الاقتصاد والنظام المالي';
          fields = [
            { name: '/balance', value: 'عرض رصيدك من الجواهر 💎', inline: true },
            { name: '/daily', value: 'استلام الجائزة اليومية 🎁', inline: true },
            { name: '/pay', value: 'تحويل الجواهر لمستخدم آخر 💸', inline: true },
            { name: '/work', value: 'العمل في وظيفة لكسب المال 👷', inline: true }
          ];
          color = COLORS.gold;
          break;
        case 'rpg':
          title = '⚔️ نظام الـ RPG والمغامرات';
          fields = [
            { name: '/rank', value: 'عرض بطاقتك الشخصية ومستواك 👤', inline: true },
            { name: '/leaderboard', value: 'قائمة أفضل المغامرين 🏆', inline: true },
            { name: '/dungeon', value: 'دخول الدهاليز المظلمة 🏰', inline: true },
            { name: '/farm', value: 'إدارة مزرعتك وحصاد المحاصيل 🌾', inline: true },
            { name: '/shop', value: 'متجر الأدوات، الأعراق، والمهارات 🛒', inline: true },
            { name: '/prestige', value: 'نظام التميز (Prestige) ⭐', inline: true }
          ];
          color = COLORS.cyan;
          break;
        case 'games':
          title = '🎮 الألعاب والترفيه';
          fields = [
            { name: '/tod', value: 'لعبة حقيقة أم جرأة الشهيرة 🎲', inline: true },
            { name: '/slots', value: 'آلة الحظ الكلاسيكية 🎰', inline: true },
            { name: '/blackjack', value: 'تحدي البلاك جاك المثير 🃏', inline: true },
            { name: '/snake', value: 'لعبة الثعبان الكلاسيكية 🐍', inline: true },
            { name: '/minesweeper', value: 'كاشف الألغام 💣', inline: true },
            { name: '/memory', value: 'اختبار قوة الذاكرة 🧠', inline: true }
          ];
          color = COLORS.phantom;
          break;
        case 'admin':
          title = '⚙️ الإدارة والتحكم بالسيرفر';
          fields = [
            { name: '/settings', value: 'لوحة التحكم المركزية ⚙️', inline: true },
            { name: '/welcomesettings', value: 'تخصيص نظام الترحيب 👋', inline: true },
            { name: '/levelsettings', value: 'إعدادات نظام الخبرة 📊', inline: true },
            { name: '/rules', value: 'إنشاء نظام قوانين احترافي 📜', inline: true },
            { name: '/announce', value: 'إرسال إعلانات منسقة 📢', inline: true },
            { name: '/autorole', value: 'نظام الرتب التلقائية 🤖', inline: true }
          ];
          color = COLORS.error;
          break;
        case 'utility':
          title = '🛠️ أدوات عامة ومساعدة';
          fields = [
            { name: '/afk', value: 'تفعيل وضع الغياب عن الشاشة 💤', inline: true },
            { name: '/info', value: 'معلومات تقنية عن البوت ℹ️', inline: true },
            { name: '/adhkar', value: 'أذكار وأدعية إسلامية 🕌', inline: true },
            { name: '/embedbuilder', value: 'منشئ الرسائل المنسقة 🖼️', inline: true },
            { name: '/help', value: 'عرض هذا الدليل 📚', inline: true }
          ];
          color = COLORS.info;
          break;
      }

      const categoryEmbed = createDetailedEmbed(interaction, title, fields, color);
      categoryEmbed.setDescription(`${DESIGN.thin_separator}\nاستخدم البادئة أو الأوامر المباشرة للوصول السريع.`);
      
      await i.update({ embeds: [categoryEmbed] });
    });
  }
};
