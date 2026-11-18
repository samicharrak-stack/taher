// 🕸️ network v27 — ربط كل الأوامر ببعضها كالشبكة
// ------------------------------------------------------------------
// 1) navRow(cmd): صف أزرار ذكي يربط الأمر بالأوامر القريبة منه (اقتصاد ↔ ستريك ↔ مستوى ↔ دانجون ↔ مزرعة)
// 2) decorate(interaction, cmd): يلف دوال الرد لـ:
//      • تحويل أي إمبد بدون صورة إلى بطاقة مصمّمة متحركة (موشن حسب الأمر)
//      • إضافة صف التنقل تلقائياً للردود التي ليس فيها أزرار
// 3) handleButton(interaction): أزرار net:<أمر>[:<فرعي>] تشغّل الأمر مباشرة
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');

const LABELS = {
  hub: ['اللوحة', '🕸️'], streak: ['الستريك', '🔥'], daily: ['اليومي', '🎁'], work: ['عمل', '💼'], balance: ['الرصيد', '💎'],
  bank: ['البنك', '🏦'], pay: ['تحويل', '💸'], rank: ['المستوى', '⭐'], leaderboard: ['المتصدرين', '🏆'], achievements: ['الإنجازات', '🎖️'],
  quests: ['المهام', '📜'], dungeon: ['الدانجون', '⚔️'], farm: ['المزرعة', '🌾'], shop: ['المتجر', '🛒'], shadow: ['الظلال', '🌑'],
  prestige: ['البريستيج', '👑'], gamesinfo: ['الألعاب', '🎮'], slots: ['سلوت', '🎰'], roulette: ['روليت', '🎡'], blackjack: ['بلاك جاك', '🃏'],
  coinflip: ['عملة', '🪙'], fish: ['صيد', '🎣'], crash: ['صاروخ', '🚀'], scratch: ['كشط', '🎟️'], treasure: ['كنز', '🗝️'], highlow: ['أعلى/أقل', '📈'],
  race: ['سباق', '🐪'], guess: ['خمن', '🔢'], help: ['المساعدة', '📖'], pet: ['الحيوان', '🐾'], stocks: ['الأسهم', '📊'], lottery: ['اليانصيب', '🎫'],
  ai: ['اسأل البوت', '🤖'], membercard: ['بطاقتي', '🪪'],
};

// الشبكة: كل أمر → الأوامر المرتبطة به (يُعرض أول 4 + زر اللوحة)
const GRAPH = {
  daily: ['streak', 'balance', 'work', 'quests'],
  work: ['daily', 'balance', 'bank', 'streak'],
  balance: ['bank', 'daily', 'work', 'leaderboard'],
  bank: ['balance', 'work', 'stocks', 'daily'],
  pay: ['balance', 'bank', 'leaderboard'],
  steal: ['balance', 'bank', 'work'],
  streak: ['daily', 'rank', 'quests', 'balance'],
  rank: ['leaderboard', 'streak', 'achievements', 'prestige'],
  leaderboard: ['rank', 'balance', 'streak', 'dungeon'],
  achievements: ['rank', 'quests', 'streak'],
  quests: ['daily', 'streak', 'achievements', 'dungeon'],
  prestige: ['rank', 'leaderboard', 'streak'],
  dungeon: ['shop', 'shadow', 'rank', 'streak'],
  shadow: ['dungeon', 'shop', 'rank'],
  shop: ['dungeon', 'balance', 'farm'],
  farm: ['balance', 'streak', 'quests', 'pet'],
  pet: ['farm', 'balance', 'streak'],
  gamesinfo: ['slots', 'roulette', 'blackjack', 'crash'],
  slots: ['roulette', 'blackjack', 'balance', 'streak'],
  roulette: ['slots', 'blackjack', 'balance'],
  blackjack: ['slots', 'roulette', 'balance'],
  coinflip: ['slots', 'highlow', 'balance'],
  crash: ['scratch', 'treasure', 'balance'], scratch: ['crash', 'treasure', 'balance'], treasure: ['crash', 'scratch', 'balance'],
  highlow: ['coinflip', 'guess', 'balance'], race: ['crash', 'slots', 'balance'], guess: ['highlow', 'gamesinfo'],
  fish: ['farm', 'balance', 'gamesinfo'],
  help: ['streak', 'daily', 'dungeon', 'farm'],
  info: ['help', 'rank'], membercard: ['rank', 'balance', 'streak'],
  stocks: ['bank', 'balance'], lottery: ['balance', 'daily'], marry: ['balance', 'rank'],
};
const DEFAULT_LINKS = ['streak', 'daily', 'rank', 'balance'];
// أوامر لا نضيف لها شبكة أو بطاقة تلقائية
const SKIP = new Set(['ban', 'kick', 'mute', 'unmute', 'warn', 'clear', 'clearwarns', 'lock', 'unlock', 'slowmode', 'say', 'nickname', 'role', 'unban', 'embedbuilder', 'reload', 'restoredata', 'settings', 'admin', 'poll', 'ticket', 'afk', 'shh', 'calc', 'translate', 'reminder', 'templates']);

function exists(name) {
  try { return !!require('../handlers/commandHandler').getCommand(name); } catch { return false; }
}

// v28: بدل صف الأزرار المزدحم → قائمة تنقل واحدة أنيقة
const DESC = {
  hub: 'كل أنظمتك في لوحة واحدة', streak: 'سلسلتك اليومية ومضاعفك', daily: 'استلم مكافأتك اليومية', work: 'اكسب عملات الآن',
  balance: 'محفظتك وبنكك', bank: 'إيداع وسحب', rank: 'مستواك وتقدمك', leaderboard: 'ترتيب السيرفر', achievements: 'إنجازاتك',
  quests: 'مهام اليوم', dungeon: 'ادخل البوابة وقاتل', farm: 'ازرع واحصد', shop: 'عتاد وأدوات', gamesinfo: 'كل الألعاب',
};
function navMenu(cmdName) {
  const links = ['hub', ...(GRAPH[cmdName] || DEFAULT_LINKS), 'dungeon', 'farm', 'gamesinfo']
    .filter((n, i, a) => n !== cmdName && a.indexOf(n) === i && LABELS[n] && exists(n)).slice(0, 8);
  if (!links.length) return null;
  const menu = new StringSelectMenuBuilder().setCustomId('net:menu').setPlaceholder('✦  تنقّل سريع  —  اختر وجهتك')
    .addOptions(links.map((n) => ({ label: LABELS[n][0], value: n, emoji: LABELS[n][1], description: DESC[n] || `افتح /${n}` })));
  return new ActionRowBuilder().addComponents(menu);
}
const navRow = navMenu;

const toData = (e) => (e && typeof e.toJSON === 'function' ? e.toJSON() : e);
const hasFiles = (p) => (Array.isArray(p.files) && p.files.length) || (Array.isArray(p.attachments) && p.attachments.length);

function decorate(interaction, cmdName) {
  if (!interaction || interaction.__network || SKIP.has(cmdName)) return interaction;
  interaction.__network = true;
  let done = false;
  const autoCards = process.env.AUTO_CARDS !== 'off';

  const patch = async (payload) => {
    if (done || !payload || typeof payload !== 'object' || payload.ephemeral || payload.flags) return payload;
    const comps = Array.isArray(payload.components) ? payload.components : [];
    if (comps.length) return payload;               // أمر تفاعلي له أزراره الخاصة — لا نلمسه
    done = true;
    const out = { ...payload };
    const embeds = Array.isArray(payload.embeds) ? payload.embeds.map(toData) : [];
    const first = embeds[0];
    // بطاقة تلقائية لأي إمبد ليس فيه صورة
    if (autoCards && first && !first.image?.url && !hasFiles(payload) && first.color !== 0xE8455F && (first.description || (first.fields || []).length)) {
      try {
        const guild = interaction.guild;
        const card = await require('../utils/networkCards').autoCard({
          embed: first, command: cmdName,
          username: interaction.member?.displayName || interaction.user?.username,
          avatarURL: interaction.user?.displayAvatarURL?.({ extension: 'png', size: 128 }),
          resolve: (id) => guild?.members?.cache?.get(id)?.displayName || interaction.client?.users?.cache?.get(id)?.username,
        });
        if (card?.buffer) {
          const e0 = new EmbedBuilder(first).setImage(`attachment://${card.name}`).setDescription(null).setFields([]);
          if (!e0.data.title) e0.setTitle(first.title || null);
          // نبقي الإمبد خفيفاً: البطاقة تحمل التفاصيل
          out.embeds = [e0, ...embeds.slice(1)];
          if (!e0.data.title && !e0.data.author) out.embeds = [new EmbedBuilder().setColor(first.color ?? 0xFFD76A).setImage(`attachment://${card.name}`), ...embeds.slice(1)];
          out.files = [new AttachmentBuilder(card.buffer, { name: card.name })];
        }
      } catch {}
    }
    const row = navRow(cmdName);
    if (row) out.components = [row];
    return out;
  };

  for (const fn of ['reply', 'editReply']) {
    const orig = interaction[fn];
    if (typeof orig !== 'function') continue;
    interaction[fn] = async function wrapped(payload, ...rest) {
      if (typeof payload === 'string') payload = { content: payload };
      const p = await patch(payload).catch(() => payload);
      return orig.call(this, p, ...rest);
    };
  }
  return interaction;
}

/** يحوّل زراً إلى تفاعل أمر (options فارغة → القيم الافتراضية لكل أمر) */
function buttonShim(interaction, commandName, sub) {
  const shim = Object.create(interaction);
  const nil = () => null;
  shim.commandName = commandName;
  shim.isChatInputCommand = () => true;
  shim.isButton = () => false;
  shim.isMessageComponent = () => false;
  shim.options = {
    getSubcommand: () => sub || null, getSubcommandGroup: nil, getString: nil, getInteger: nil, getNumber: nil, getBoolean: nil,
    getUser: nil, getMember: nil, getChannel: nil, getRole: nil, getAttachment: nil, getMentionable: nil, get: nil, data: [],
  };
  shim.reply = (p) => interaction.reply(p);
  shim.deferReply = (p) => interaction.deferReply(p);
  shim.editReply = (p) => interaction.editReply(p);
  shim.followUp = (p) => interaction.followUp(p);
  shim.fetchReply = () => interaction.fetchReply();
  shim.update = (p) => interaction.reply(p);
  shim.deferUpdate = () => interaction.deferReply();
  Object.defineProperty(shim, 'replied', { get: () => interaction.replied });
  Object.defineProperty(shim, 'deferred', { get: () => interaction.deferred });
  return shim;
}

async function handleButton(interaction) {
  let [, name, sub] = interaction.customId.split(':');
  if (name === 'menu') { name = interaction.values?.[0]; sub = undefined; }
  const { getCommand } = require('../handlers/commandHandler');
  const cmd = getCommand(name);
  if (!cmd) return interaction.reply({ content: '❌ هذا الأمر غير متاح.', ephemeral: true });
  const req = (cmd.data?.toJSON?.().options || []).some((o) => o.required && o.type > 2);
  if (req) return interaction.reply({ content: `💡 هذا الأمر يحتاج معلومات — اكتب \`/${name}\``, ephemeral: true });
  const { checkCooldown } = require('../utils/cooldowns');
  if (await checkCooldown(interaction, name, cmd.cooldown || 3)) return;
  const shim = buttonShim(interaction, name, sub);
  try { require('./streak').touchMember(interaction.guildId, interaction.user.id); } catch {}
  try { require('../utils/gameArt').decorate(shim, cmd.art || cmd.data?.name); } catch {}
  decorate(shim, name);
  return cmd.execute(shim);
}

module.exports = { GRAPH, LABELS, navRow, navMenu, decorate, handleButton, buttonShim };
