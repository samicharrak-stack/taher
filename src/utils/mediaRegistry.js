/**
 * MEDIA REGISTRY — يفضّل GIFs المحلية من assets/gifs دائماً
 * الروابط الخارجية القديمة تُستخدم فقط كاحتياط إن لم يوجد ملف محلي.
 */
const path = require('path');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');

const GIF_DIR = path.resolve(__dirname, '../../assets/gifs');

/** حالة اللعبة → اسم ملف محلي (بدون .gif) */
const LOCAL_MAP = {
  slots: { spin: 'cmd_slots', win: 'win', jackpot: 'jackpot', lose: 'lose' },
  roulette: { spin: 'cmd_roulette', win: 'win', lose: 'lose' },
  blackjack: { deal: 'cmd_blackjack', win: 'win', bust: 'lose' },
  rps: { play: 'cmd_rps', win: 'win', lose: 'lose', tie: 'tie' },
  race: { start: 'cmd_race', win: 'win', lose: 'lose', running: 'cmd_race' },
  fish: { cast: 'cmd_fish', catch: 'win', miss: 'lose', legendary: 'jackpot' },
  coinflip: { flip: 'cmd_coinflip', win: 'win', lose: 'lose' },
  dice: { roll: 'cmd_dice', win: 'win', lose: 'lose' },
  cards: { deal: 'cards', win: 'win', lose: 'lose' },
  stocks: { up: 'win', down: 'lose', chart: 'loading' },
  work: { general: 'cmd_work', warrior: 'cmd_work', miner: 'cmd_work', farmer: 'cmd_farm', trader: 'cmd_shop', hunter: 'cmd_dungeon' },
  daily: { streak_low: 'cmd_daily', streak_mid: 'cmd_daily', streak_high: 'jackpot', gift: 'cmd_daily' },
  general: { win: 'win', lose: 'lose', celebrate: 'fireworks', levelup: 'fireworks', loading: 'loading', tie: 'tie' },
  farm: { plant: 'cmd_farm', harvest: 'win', water: 'loading', barn: 'cmd_farm', craft: 'cmd_farm', pest: 'lose', levelup: 'fireworks', sunny: 'cmd_farm', rainy: 'loading', storm: 'lose', golden: 'jackpot', frozen: 'loading' },
  crash: { play: 'cmd_crash', win: 'win', lose: 'lose' },
  scratch: { play: 'cmd_scratch', win: 'win', lose: 'lose' },
  treasure: { play: 'cmd_treasure', win: 'win', lose: 'lose' },
  guess: { think: 'cmd_guess', win: 'win', lose: 'lose' },
  highlow: { play: 'cmd_highlow', win: 'win', lose: 'lose' },
};

// احتياطي قديم (لا يُفضَّل) — يُستخدم فقط إن غاب الملف المحلي
const GAME_MEDIA = {
  slots: {}, roulette: {}, blackjack: {}, rps: {}, race: {}, fish: {},
  coinflip: {}, dice: {}, cards: {}, stocks: {}, work: {}, daily: {}, general: {},
};
const FARM_MEDIA = { weather: {}, actions: {}, crops: {}, animals: {} };
const DUNGEON_MEDIA = { rooms: {}, combat: {} };

function localFile(name) {
  if (!name) return null;
  const fp = path.join(GIF_DIR, `${name}.gif`);
  if (!fs.existsSync(fp)) return null;
  const fileName = `${name}.gif`;
  return { file: new AttachmentBuilder(fp, { name: fileName }), url: `attachment://${fileName}`, name: fileName };
}

function resolveLocal(game, state) {
  const g = LOCAL_MAP[game] || {};
  const name = g[state] || LOCAL_MAP.general[state] || 'loading';
  return localFile(name) || localFile('loading');
}

function getMedia(game, state) {
  const local = resolveLocal(game, state);
  if (local) return local.url;
  const category = GAME_MEDIA[game];
  if (!category) return null;
  return category[state] || null;
}

function getFarmMedia(category, key) {
  const mapKey = category === 'weather' || category === 'actions' ? key : null;
  if (mapKey) {
    const local = resolveLocal('farm', mapKey);
    if (local) return local.url;
  }
  const cat = FARM_MEDIA[category];
  return cat?.[key] || null;
}

function getDungeonMedia(category, key) {
  return DUNGEON_MEDIA[category]?.[key] || null;
}

/**
 * يضع صورة متحركة محلية على الإمبد ويربط الملف بـ safeReply / mediaFilesFor.
 * لا يستبدل صورة بطاقة مرسومة (attachment:// غير موجودة في خريطة الـ GIF).
 */
function setEmbedMedia(embed, game, state, fallbackUrl = null) {
  if (!embed) return embed;
  try {
    const current = embed.data?.image?.url || '';
    // لا تلمس بطاقة مرسومة (slots.gif / balance.gif / rank.gif ...) إن كانت ليست من مكتبة الحالات
    if (current.startsWith('attachment://')) {
      const base = current.replace('attachment://', '').replace(/\.gif$/i, '');
      const known = new Set(['win', 'lose', 'tie', 'loading', 'jackpot', 'slots_spin', 'dice', 'cards', 'fireworks']);
      const isCmd = base.startsWith('cmd_');
      if (!known.has(base) && !isCmd) return embed;
    }
  } catch {}

  const local = resolveLocal(game, state);
  if (local) {
    embed.setImage(local.url);
    try { require('./gameHelpers').queueGif(embed, local.file); } catch {}
    return embed;
  }
  if (fallbackUrl) embed.setImage(fallbackUrl);
  return embed;
}

function setFarmMedia(embed, category, key) {
  const local = resolveLocal('farm', key);
  if (local) {
    embed.setImage(local.url);
    try { require('./gameHelpers').queueGif(embed, local.file); } catch {}
    return embed;
  }
  const url = getFarmMedia(category, key);
  if (url) embed.setImage(url);
  return embed;
}

/** يُرجع الملف المحلي الحالي للإمبد لإرفاقه مع editReply */
function mediaFile(embed) {
  try { return require('./gameHelpers').takeQueuedGif(embed); } catch { return null; }
}

module.exports = {
  GAME_MEDIA, FARM_MEDIA, DUNGEON_MEDIA, LOCAL_MAP, GIF_DIR,
  getMedia, getFarmMedia, getDungeonMedia,
  setEmbedMedia, setFarmMedia, mediaFile, resolveLocal, localFile,
};
