const { EmbedBuilder } = require('discord.js');
const config = require('../config');

// 🎨 v23 — لوحة «رويال نوار» الموحّدة: نفس ألوان البطاقات المرسومة (cardKit THEMES)
// كل الإمبدات في البوت تستخدم هذه القيم فقط، فيبقى الشريط الجانبي متناسقاً مع الصورة.
const COLORS = {
  primary: 0xE8B04A,      // ذهبي ملكي — لون الهوية الأساسي
  success: 0x2FD69B,      // زمردي (emerald)
  warning: 0xFFB547,      // كهرماني (amber)
  error: 0xE8455F,        // قرمزي (crimson)
  phantom: 0x8E6CFF,      // بنفسجي (violet)
  gold: 0xFFD76A,         // ذهبي فاتح (gold)
  cyan: 0x4CC9F0,         // سماوي (frost)
  info: 0x4FA3FF,         // أزرق (azure)
  dark: 0x14161D,         // نوار
  royal: 0xD4AF37,        // ذهبي معدني — القوائم والأدلة
  neon: 0x4CF0B0,         // زمردي مضيء
  premium: 0xFF9F43,      // برتقالي فاخر
  rose: 0xFF7AB6,         // وردي (rose)
};

const DESIGN = {
  separator: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
  thin_separator: '────────────────────────────',
  bullet: '•',
  arrow: '❯',
  double_arrow: '»',
  crown: '👑',
  star: '⭐',
  diamond: '💎',
  sparkles: '✨',
  locked: '🔒',
  unlocked: '🔓',
  info: 'ℹ️',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  clock: '🕒',
  calendar: '📅',
  trophy: '🏆',
  money: '💰',
  shield: '🛡️',
  sword: '⚔️',
  heart: '❤️',
  level: '📊'
};

const BAR_STYLES = {
  classic: { full: '▰', empty: '▱' },
  modern: { full: '█', empty: '░' },
  blocks: { full: '▓', empty: '░' },
  rounded: { full: '●', empty: '○' }
};

function createProgressBar(current, max, length = 10, style = 'modern') {
  const progress = Math.min(Math.max(current / max, 0), 1);
  const fullCount = Math.round(progress * length);
  const emptyCount = length - fullCount;
  const { full, empty } = BAR_STYLES[style] || BAR_STYLES.modern;
  return full.repeat(fullCount) + empty.repeat(emptyCount);
}

const GIFS = {};

function getRandomGif(key) {
  return null;
}

function createBaseEmbed(title, color = COLORS.primary) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();
}

function createSuccessEmbed(title, description) {
  return createBaseEmbed(`✅ ${title}`, COLORS.success)
    .setDescription(description);
}

function createErrorEmbed(description) {
  return createBaseEmbed('❌ خطأ', COLORS.error)
    .setDescription(description);
}

function createInfoEmbed(title, description) {
  return createBaseEmbed(`ℹ️ ${title}`, COLORS.info)
    .setDescription(description);
}

function createStyledEmbed(interaction, title, color = COLORS.primary) {
  const authorName = config.SERVER_NAME || 'Sami Bot';
  const authorIcon = interaction?.client?.user?.displayAvatarURL?.() || null;
  const embed = new EmbedBuilder()
    .setTitle(`${title}`)
    .setColor(color)
    .setTimestamp();
  
  if (authorIcon) {
    embed.setAuthor({ name: authorName, iconURL: authorIcon });
  } else {
    embed.setAuthor({ name: authorName });
  }
  
  return embed;
}

function createModernEmbed(interaction, title, description, color = COLORS.primary) {
  const embed = createStyledEmbed(interaction, title, color);
  if (description) {
    embed.setDescription(`${DESIGN.thin_separator}\n${description}\n${DESIGN.thin_separator}`);
  }
  return embed;
}

function createDetailedEmbed(interaction, title, fields = [], color = COLORS.primary, thumbnail = null) {
  const embed = createStyledEmbed(interaction, title, color);
  if (thumbnail) embed.setThumbnail(thumbnail);
  
  if (fields.length > 0) {
    embed.addFields(fields.map(f => ({
      name: `${DESIGN.bullet} ${f.name}`,
      value: f.value,
      inline: f.inline ?? false
    })));
  }
  
  return embed;
}

function replaceVars(text, vars = {}) {
  if (!text) return '';
  return text
    .replace(/\{user\}/g, vars.user || '{user}')
    .replace(/\{mention\}/g, vars.mention || '{mention}')
    .replace(/\{mentione\}/g, vars.mention || '{mentione}')
    .replace(/\{username\}/g, vars.username || '{username}')
    .replace(/\{server\}/g, vars.server || config.SERVER_NAME)
    .replace(/\{memberCount\}/g, vars.memberCount ?? '0')
    .replace(/\{invite\}/g, vars.invite || config.SERVER_INVITE)
    .replace(/\{level\}/g, vars.level ?? '0')
    .replace(/\{oldLevel\}/g, vars.oldLevel ?? '0')
    .replace(/\{xp\}/g, vars.xp ?? '0')
    .replace(/\{nextXP\}/g, vars.nextXP ?? '0');
}

function getPlatformColor(type) {
  const map = {
    twitter: 0x1DA1F2,
    reddit: 0xFF4500,
    telegram: 0x0088cc,
  };
  return map[type] || COLORS.info;
}

function getCategoryColor(category) {
  const map = {
    news: 0xFFD76A,
    memes: 0x8E6CFF,
    manhwa: 0x2FD69B,
    episodes: 0xFF9F43,
  };
  return map[category] || null;
}

function getFollowEmbedColor(type, category) {
  return getCategoryColor(category) || getPlatformColor(type);
}

const { getBadgeForLevel } = require('../data/badges');
const { getRankForXP } = require('../data/ranks');

function createLevelUpEmbed(user, newLevel) {
  const badge = getBadgeForLevel(newLevel);
  const totalXP = newLevel * 100;
  const rank = getRankForXP(totalXP);

  const embed = createStyledEmbed(null, '🎊 تهانينا! لقد ارتفع مستواك!', COLORS.gold)
    .setDescription(`**${config.SERVER_NAME} تفخر بصعودك للنخبة!** ${user}\n\n${badge.emoji} **شعارك الجديد:** ${badge.name}\n${badge.desc}\n\n🔗 │ ${rank.emoji} **${rank.name}** → ${rank.minLevel * 100} XP`);

  return embed;
}

function createProgressBar(current, total, size = 15) {
  const progress = Math.min(1, Math.max(0, current / total));
  const filledChars = Math.round(progress * size);
  const emptyChars = size - filledChars;
  
  const filledBar = '▰'.repeat(filledChars);
  const emptyBar = '▱'.repeat(emptyChars);
  
  return `${filledBar}${emptyBar} **${Math.round(progress * 100)}%**`;
}

module.exports = {
  COLORS,
  DESIGN,
  GIFS,
  BAR_STYLES,
  getRandomGif,
  createBaseEmbed,
  createSuccessEmbed,
  createErrorEmbed,
  createInfoEmbed,
  createStyledEmbed,
  createModernEmbed,
  createDetailedEmbed,
  createProgressBar,
  replaceVars,
  getPlatformColor,
  getFollowEmbedColor,
  createLevelUpEmbed
};