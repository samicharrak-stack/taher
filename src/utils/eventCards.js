// 🌟 eventCards v27 — بطاقات "سبوتلايت" عصرية للأحداث: البوست، الغياب AFK، العودة، البومب
// تصميم موحّد: صورة العضو في هالة متوهجة + عنوان كبير + شرائح معلومات زجاجية + موشن خاص بكل حدث
const kitAll = require('./cardKit');
const K = kitAll._kit;
const { backdrop, glass, chip, lin } = require('./modernCards');

const KINDS = {
  boost:  { p: { a: '#ff73fa', b: '#8a5cff', glow: 'rgba(255,115,250,0.45)', deep: '#1a0620', hi: '#ffd166' }, icon: '💎', preset: 'boost',  tag: 'NITRO BOOST' },
  afk:    { p: { a: '#b9a8ff', b: '#4a5bff', glow: 'rgba(150,130,255,0.42)', deep: '#0a0820', hi: '#7fdcff' }, icon: '🌙', preset: 'sleep',  tag: 'AFK' },
  back:   { p: { a: '#34f5c5', b: '#1fb6ff', glow: 'rgba(52,245,197,0.42)', deep: '#03161a', hi: '#ffd166' }, icon: '✨', preset: 'ascend', tag: 'WELCOME BACK' },
  bump:   { p: { a: '#5ee7ff', b: '#2b6cff', glow: 'rgba(94,231,255,0.45)', deep: '#05101f', hi: '#ffd166' }, icon: '🚀', preset: 'rocket', tag: 'BUMP' },
  remind: { p: { a: '#ffd166', b: '#ff8a3d', glow: 'rgba(255,190,90,0.42)', deep: '#1a0f03', hi: '#5ee7ff' }, icon: '⏰', preset: 'rocket', tag: 'BUMP TIME' },
};

/**
 * @param {{kind:'boost'|'afk'|'back'|'bump'|'remind', username?:string, avatarURL?:string, title:string, subtitle?:string,
 *          stats?:Array<[string,string,string]>, chips?:string[], footer?:string}} o
 */
async function spotlightCard(o) {
  const C = K.C(); if (!C) return null;
  await kitAll.ready();
  const k = KINDS[o.kind] || KINDS.back, p = k.p;
  const stats = (o.stats || []).slice(0, 3);
  const W = 1000, H = stats.length ? 420 : 300;
  const canvas = C.createCanvas(W, H), ctx = canvas.getContext('2d');
  backdrop(ctx, W, H, p, { seed: o.kind.length * 7 });

  // هالة الصورة + حلقات مدارية
  const acx = W - 150, acy = 150, AS = 150;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.35 - i * 0.1; ctx.lineWidth = 2; ctx.strokeStyle = i % 2 ? p.b : p.a;
    ctx.beginPath(); ctx.ellipse(acx, acy, AS / 2 + 22 + i * 16, AS / 2 + 10 + i * 12, -0.35, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.shadowColor = p.glow; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(acx, acy, AS / 2 + 6, 0, Math.PI * 2); ctx.strokeStyle = lin(ctx, acx - AS, acy - AS, acx + AS, acy + AS, [p.a, p.b]); ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
  await K.avatar(ctx, o.avatarURL, acx - AS / 2, acy - AS / 2, AS, { a: p.a, b: p.b, glow: p.glow, deep: p.deep }, o.username || '?', { ring: false });
  // أيقونة الحدث على الصورة
  ctx.save(); ctx.shadowColor = p.glow; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(acx - AS / 2 + 14, acy + AS / 2 - 14, 30, 0, Math.PI * 2);
  ctx.fillStyle = lin(ctx, acx - AS / 2 - 16, 0, acx - AS / 2 + 44, 0, [p.a, p.b]); ctx.fill(); ctx.restore();
  K.emoji(ctx, k.icon, acx - AS / 2 + 14, acy + AS / 2 - 14, 34);

  // النصوص
  const rx = W - 270;
  chip(ctx, k.tag, rx, 46, p, { solid: true, size: 13 });
  K.txt(ctx, o.title, rx, 128, { size: 44, align: 'right', maxW: rx - 50, shadow: true });
  if (o.subtitle) K.wrap(ctx, o.subtitle, rx - 50, 19, 'normal', 2).forEach((l, i) => K.txt(ctx, l, rx, 166 + i * 28, { size: 19, weight: 'normal', color: '#c9d2ea', align: 'right', maxW: rx - 50 }));
  let cx = rx;
  for (const c of (o.chips || []).slice(0, 3)) cx -= chip(ctx, c, cx, o.subtitle ? 222 : 170, p) + 10;
  if (o.username) K.txt(ctx, o.username, acx, acy + AS / 2 + 46, { size: 20, align: 'center', color: p.a, maxW: 260 });

  // شرائح الإحصائيات
  if (stats.length) {
    const ty = H - 128, th = 92, gap = 18, tw = (W - 88 - gap * (stats.length - 1)) / stats.length;
    stats.forEach(([label, value, icon], i) => {
      const x = W - 44 - tw * (i + 1) - gap * i;
      glass(ctx, x, ty, tw, th, 20, { tint: p.a });
      ctx.save(); K.rr(ctx, x + tw - 62, ty + th / 2 - 24, 48, 48, 14); ctx.fillStyle = lin(ctx, x + tw - 62, ty, x + tw - 14, ty + th, [p.a, p.b]); ctx.globalAlpha = 0.25; ctx.fill(); ctx.restore();
      K.emoji(ctx, icon, x + tw - 38, ty + th / 2, 28);
      K.txt(ctx, label, x + tw - 76, ty + th / 2 - 8, { size: 14, weight: 'normal', color: '#9aa6c4', align: 'right', maxW: tw - 90 });
      K.txt(ctx, value, x + tw - 76, ty + th / 2 + 24, { size: 24, color: i === 0 ? p.hi : '#f4f7ff', align: 'right', maxW: tw - 90 });
    });
  }
  if (o.footer) K.txt(ctx, o.footer, W / 2, H - 14, { size: 13, weight: 'normal', color: 'rgba(255,255,255,0.45)', align: 'center', maxW: W - 120 });
  return require('./motion').animateCanvas(canvas, `${o.kind === 'back' ? 'afk-back' : o.kind === 'remind' ? 'bump-remind' : o.kind}.png`, { preset: k.preset, hold: 1600 });
}

/** يرسل البطاقة كإمبد بصورة، أو يرجع null عند الفشل */
async function cardPayload(o, { color = 0xFF73FA, content } = {}) {
  try {
    const card = await spotlightCard(o);
    if (!card?.buffer) return null;
    const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
    return { content, embeds: [new EmbedBuilder().setColor(color).setImage(`attachment://${card.name}`)], files: [new AttachmentBuilder(card.buffer, { name: card.name })] };
  } catch { return null; }
}

module.exports = { spotlightCard, cardPayload, KINDS };
