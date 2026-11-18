const { SlashCommandBuilder } = require('discord.js');
const { readGuild, writeGuild } = require('../../utils/guildStorage');
const { COLORS, createStyledEmbed } = require('../../utils/embeds');
const config = require('../../config');
const { calculateLevel } = require('../../systems/levels');

// 🎴 أُزيلت صور الـ GIF العشوائية — البطاقة المرسومة المتحركة هي الصورة الوحيدة
const STREAK_IMAGES = [null, null, null, null];

// Streak-based colors
function streakColor(streak) {
  if (streak >= 15) return 0xFFD76A;
  if (streak >= 8)  return 0xFF9F43;
  if (streak >= 4)  return 0x2FD69B;
  return COLORS.gold;
}

// Streak image picker
function streakImage(streak) {
  if (streak >= 15) return STREAK_IMAGES[3];
  if (streak >= 8)  return STREAK_IMAGES[2];
  if (streak >= 4)  return STREAK_IMAGES[1];
  return STREAK_IMAGES[0];
}

// Animated streak bar
function streakBar(streak) {
  const fire   = '🔥'.repeat(Math.min(streak, 7));
  const empty  = '▫️'.repeat(Math.max(0, 7 - streak));
  const label  = streak >= 7 ? ' 🌟 **أسبوع كامل!**' : '';
  return `${fire}${empty}${label}`;
}

// Streak title
function streakTitle(streak) {
  if (streak >= 30) return '🌟 أسطورة الأيام!';
  if (streak >= 14) return '👑 محارب الأيام!';
  if (streak >= 7)  return '🔥 أسبوع من النار!';
  if (streak >= 3)  return '✨ سلسلة متصاعدة!';
  return '🎁 الهدية اليومية';
}

module.exports = {
  aliases: ['يومي', 'راتب', 'هدية', 'daily'],
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('🎁 احصل على هديتك اليومية وبني سلسلة الأيام!'),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId  = interaction.user.id;
    const g = readGuild(guildId);
    g.users = g.users || {};
    const u = g.users[userId] || { balance: config.DEFAULT_BALANCE || 1000, xp: 0, level: 1, stats: {} };

    const now = Date.now();
    const COOLDOWN = 24 * 60 * 60 * 1000;
    const lastDaily = u.last_daily || 0;

    if (now - lastDaily < COOLDOWN) {
      const left    = COOLDOWN - (now - lastDaily);
      const hours   = Math.floor(left / (1000 * 60 * 60));
      const minutes = Math.floor((left % (1000 * 60 * 60)) / (1000 * 60));
      return interaction.reply({
        embeds: [
          createStyledEmbed(interaction, '⏳ لقد أخذت هديتك!', COLORS.warning)
            .setDescription(
              `عُد بعد **${hours} ساعة و ${minutes} دقيقة**.\n\n` +
              `🔥 سلسلتك الحالية: **${u.daily_streak || 1} يوم**\n` +
              streakBar(u.daily_streak || 1)
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        ],
        ephemeral: true
      });
    }

    // ─── Streak Calculation ───────────────────────────────
    const twoDay = 2 * COOLDOWN;
    u.daily_streak = (lastDaily && (now - lastDaily) < twoDay) ? (u.daily_streak || 1) + 1 : 1;
    const streak      = u.daily_streak;
    const streakBonus = Math.min(streak - 1, 14) * 100;
    const xpGain      = 50 + Math.min(streak - 1, 14) * 5;
    const STREAK = require('../../systems/streak');
    const baseGold    = (config.DAILY_REWARD || 500) + streakBonus;
    const goldReward  = STREAK.apply(u, baseGold);
    const actMult     = STREAK.multOf(u.xp_streak || 1);

    u.balance = (u.balance || 0) + goldReward;
    u.xp      = (u.xp || 0) + xpGain;
    u.last_daily = now;
    u.stats = u.stats || {};
    u.stats.daily_count = (u.stats.daily_count || 0) + 1;

    const oldLevel = u.level || 1;
    const newLevel = calculateLevel(u.xp);
    const leveledUp = newLevel > oldLevel;
    if (leveledUp) u.level = newLevel;

    g.users[userId] = u;
    writeGuild(guildId, g);

    // ─── Daily Embed ──────────────────────────────────────
    const embed = createStyledEmbed(interaction, streakTitle(streak), streakColor(streak))
      .setAuthor({ name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setDescription(
        `> *خذ هديتك اليومية واحتفظ بالسلسلة!*\n\n` +
        `**🔥 سلسلة الأيام**\n${streakBar(streak)}\n**${streak} يوم متتالي**`
      )
      .addFields(
        { name: '💰 الجواهر',   value: `\`+${goldReward.toLocaleString()}\``, inline: true },
        { name: '⭐ الخبرة',    value: `\`+${xpGain}\``, inline: true },
        { name: '🎁 مكافأة السلسلة', value: `\`+${streakBonus.toLocaleString()}\``, inline: true },
        { name: '🔥 مضاعف الستريك', value: `\`x${actMult.toFixed(2)}\``, inline: true },
        { name: '🛡️ الدروع', value: `\`${u.streak_shields || 0}/3\``, inline: true },
        { name: '📅 أفضل سلسلة', value: `\`${Math.max(u.streak_best || 0, u.xp_streak || 0)}\``, inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `💎 الرصيد: ${u.balance.toLocaleString()} • ⭐ XP: ${u.xp.toLocaleString()} • الحد الأقصى للمكافأة: 14 يوم` });

    // Milestone announcements
    if ([7, 14, 30].includes(streak)) {
      embed.addFields({ name: '🏆 إنجاز سلسلة!', value: `وصلت لـ **${streak} يوم متتالي**! مبروك!`, inline: false });
    }

    await interaction.reply({ embeds: [embed] });

    try {
      const { checkAchievements } = require('../../systems/achievements');
      await checkAchievements(guildId, userId, interaction.channel);
    } catch {}

    if (leveledUp) {
      try {
        const lvlChanId = g.channels?.levels;
        const targetChannel = (lvlChanId ? interaction.guild.channels.cache.get(lvlChanId) : null) || interaction.channel;
        if (targetChannel) {
          const lvlEmbed = createStyledEmbed(interaction, '🎉 مستوى جديد!', 0xE8B04A)
            .setDescription(`<@${userId}> وصل للمستوى **${u.level}** 🎊`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
          await targetChannel.send({ embeds: [lvlEmbed] });
        }
      } catch {}
    }
  }
};
