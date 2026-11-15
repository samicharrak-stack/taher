// ============= Game Media (Local GIFs) =============
// تم استبدال روابط Tenor الخارجية بملفات GIF محلية مولّدة ذاتياً
// (تعمل دائماً بدون اتصال بالإنترنت ولا تتعرض لروابط ميتة).
// كل ملف يُرسل كـ AttachmentBuilder ويُربط بالـ embed عبر attachment://name.gif

const path = require('path');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');

const GIF_DIR = path.resolve(__dirname, '../../assets/gifs');

// خريطة: لعبة + حالة → اسم ملف GIF
const MAP = {
  slots:       { spin: 'cmd_slots', win: 'win',  jackpot: 'jackpot', lose: 'lose' },
  roulette:    { spin: 'cmd_roulette', win: 'win',  lose: 'lose' },
  blackjack:   { deal: 'cmd_blackjack', win: 'win',  bust: 'lose' },
  rps:         { play: 'cmd_rps', win: 'win',  lose: 'lose', tie: 'tie' },
  race:        { start: 'cmd_race', win: 'win',  lose: 'lose' },
  fish:        { cast: 'cmd_fish', catch: 'win', miss: 'lose', legendary: 'jackpot' },
  coinflip:    { flip: 'cmd_coinflip', win: 'win', lose: 'lose' },
  crash:       { play: 'cmd_crash', win: 'win', lose: 'lose' },
  scratch:     { play: 'cmd_scratch', win: 'win', lose: 'lose' },
  treasure:    { play: 'cmd_treasure', win: 'win', lose: 'lose' },
  highlow:     { play: 'cmd_highlow', win: 'win', lose: 'lose' },
  guess:       { think: 'cmd_guess', win: 'win',  lose: 'lose' },
  dice:        { roll: 'cmd_dice', win: 'win', lose: 'lose' },
  minesweeper: { play: 'cmd_minesweeper', boom: 'lose', win: 'win' },
  farm:        { play: 'cmd_farm', plant: 'cmd_farm', harvest: 'win' },
  snake:       { play: 'loading' },
  memory:      { play: 'cards' },
  sort:        { play: 'loading' },
  emoji:       { play: 'loading' },
  challenge:   { play: 'dice' },
  rob:         { sneak: 'loading',   caught: 'lose', win: 'win' },
  generic:     { win: 'win', lose: 'lose', tie: 'tie', loading: 'loading' },
};

function _resolveFile(game, state) {
  const g = MAP[game] || {};
  const name = g[state] || (MAP.generic[state] || 'loading');
  const fp = path.join(GIF_DIR, `${name}.gif`);
  if (fs.existsSync(fp)) return { fp, name: `${name}.gif` };
  // fallback to loading
  const fb = path.join(GIF_DIR, 'loading.gif');
  return fs.existsSync(fb) ? { fp: fb, name: 'loading.gif' } : null;
}

/**
 * Returns an attachment URL string (attachment://name.gif) for embed.setImage(),
 * paired with the AttachmentBuilder you must include in `files: [...]`.
 *   const { url, file } = pickGifAttachment('slots','win');
 *   embed.setImage(url);
 *   await reply({ embeds:[embed], files:[file] });
 */
function pickGifAttachment(game, state) {
  const r = _resolveFile(game, state);
  if (!r) return null;
  const file = new AttachmentBuilder(r.fp, { name: r.name });
  return { url: `attachment://${r.name}`, file, name: r.name };
}

// Backwards-compatible signature used by older code paths.
// Returns just the attachment:// url; caller is responsible for adding the file.
// If you need the file too, use pickGifAttachment.
function pickGif(game, state) {
  const r = _resolveFile(game, state);
  return r ? `attachment://${r.name}` : null;
}

// ============= صور GIF افتتاحية لكل أمر/لعبة (assets/gifs/cmd_*.gif) =============
const INTRO_ALIAS = { gamble: 'slots', bet: 'roulette', lotto: 'lottery', blackjack21: 'blackjack', rob: 'steal', transfer: 'pay' };
function introGif(key) {
  const k = INTRO_ALIAS[key] || key;
  if (!k) return null;
  const fp = path.join(GIF_DIR, `cmd_${k}.gif`);
  if (!fs.existsSync(fp)) return null;
  const name = `cmd_${k}.gif`;
  return { file: new AttachmentBuilder(fp, { name }), url: `attachment://${name}`, name };
}

/**
 * يضيف GIF متحرك كصورة لأول إمبد في أول رد فقط — إذا كان الإمبد بلا صورة ولا يحتوي ملفات رسومية.
 * لا يغيّر الرسائل الخاصة (ephemeral) ولا رسائل الخطأ.
 */
function attachIntroGif(interaction, key) {
  if (!interaction || interaction.__introGif || !introGif(key)) return interaction;
  interaction.__introGif = true;
  let used = false;
  let keptUrl = null;
  for (const fn of ['reply', 'editReply', 'update']) {
    const orig = interaction[fn];
    if (typeof orig !== 'function') continue;
    interaction[fn] = async function wrapped(payload, ...rest) {
      try {
        if (!used && payload && typeof payload === 'object' && !payload.ephemeral && Array.isArray(payload.embeds) && payload.embeds.length) {
          const { EmbedBuilder } = require('discord.js');
          const e = payload.embeds[0];
          const data = e?.toJSON ? e.toJSON() : e;
          const isError = data?.color === 0xE8455F || data?.color === 0xff4757;
          const g = introGif(key);
          if (data && g && !isError && !String(data.image?.url || '').includes(g.name) && !String(data.thumbnail?.url || '').includes(g.name)) {
            const embed = new EmbedBuilder(data);
            // البطاقة المرسومة تبقى الصورة الكبيرة، وGIF الأمر يجلس في الزاوية
            if (data.image?.url) embed.setThumbnail(g.url);
            else embed.setImage(g.url);
            used = true; keptUrl = g.url;
            const files = [...(payload.files || [])];
            if (!files.some((f) => (f?.name || f?.attachment?.name) === g.name)) files.push(g.file);
            payload = { ...payload, embeds: [embed, ...payload.embeds.slice(1)], files };
          }
        }
        else if (keptUrl && payload && typeof payload === 'object' && Array.isArray(payload.embeds) && payload.embeds.length && !Array.isArray(payload.attachments)) {
          // تعديلات لاحقة لنفس الرسالة: أبقِ الـ GIF داخل الإمبد بدل أن يظهر كمرفق منفصل
          const { EmbedBuilder } = require('discord.js');
          const d = payload.embeds[0]?.toJSON ? payload.embeds[0].toJSON() : payload.embeds[0];
          const hasImageFile = (payload.files || []).some((f) => /\.(png|jpe?g|gif|webp)$/i.test(f?.name || f?.attachment?.name || ''));
          if (d && !d.image?.url && !hasImageFile) payload = { ...payload, embeds: [new EmbedBuilder(d).setImage(keptUrl), ...payload.embeds.slice(1)] };
        }
        if (payload && typeof payload === 'object' && !payload.ephemeral) used = true;
      } catch {}
      return orig.call(this, payload, ...rest);
    };
  }
  return interaction;
}

module.exports = { pickGif, pickGifAttachment, MAP, GIF_DIR, introGif, attachIntroGif };
