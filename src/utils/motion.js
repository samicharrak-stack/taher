// حركة موحّدة للبطاقات: لمعة تمر على التصميم الحالي ثم تُحفظ GIF.
// البطاقات الطويلة (قوائم) تبقى PNG حتى لا يثقل الرد.
const MAX_PIXELS = 1000 * 640;

async function stillPng(canvas) {
  if (typeof canvas.encode === 'function') return canvas.encode('png');
  return canvas.toBuffer('image/png');
}

/**
 * @param {import('@napi-rs/canvas').Canvas} canvas
 * @param {string} name
 * @returns {Promise<{buffer:Buffer,name:string}>}
 */
async function animateCanvas(canvas, name = 'card.png') {
  const png = await stillPng(canvas);
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h || w * h > MAX_PIXELS || w > 1200) return { buffer: png, name };

  let gifenc;
  let C;
  try {
    gifenc = require('gifenc');
    C = require('@napi-rs/canvas');
  } catch {
    return { buffer: png, name };
  }

  try {
    const img = await C.loadImage(png);
    const { GIFEncoder, quantize, applyPalette } = gifenc;
    const enc = GIFEncoder();
    const frames = 8;
    for (let f = 0; f < frames; f++) {
      const c = C.createCanvas(w, h);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#070b16';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const t = f / frames;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gx = w * (0.15 + 0.7 * t);
      const gy = h * (0.25 + 0.08 * Math.sin(t * Math.PI * 2));
      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.28);
      glow.addColorStop(0, 'rgba(255,255,255,0.22)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const sx = -160 + t * (w + 320);
      ctx.save();
      ctx.translate(sx, 0);
      ctx.transform(1, 0, -0.42, 1, 0, 0);
      const sheen = ctx.createLinearGradient(0, 0, 110, 0);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, -20, 110, h + 40);
      ctx.restore();
      ctx.restore();

      const frame = ctx.getImageData(0, 0, w, h);
      const pal = quantize(frame.data, 80, { format: 'rgb444' });
      const idx = applyPalette(frame.data, pal, 'rgb444');
      enc.writeFrame(idx, w, h, { palette: pal, delay: 90, repeat: 0 });
    }
    enc.finish();
    const buffer = Buffer.from(enc.bytes());
    if (buffer.length < 32 || buffer.length > 7_500_000) return { buffer: png, name };
    if (buffer.slice(0, 3).toString() !== 'GIF') return { buffer: png, name };
    return { buffer, name: String(name).replace(/\.png$/i, '.gif') };
  } catch {
    return { buffer: png, name };
  }
}

module.exports = { animateCanvas, MAX_PIXELS };
