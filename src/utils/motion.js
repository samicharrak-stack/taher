// 🎞️ motion v25 — محرّك الحركة الموحّد لكل بطاقات البوت
// ------------------------------------------------------------------
// كل بطاقة تُرسم مرة واحدة (canvas) ثم تُحرَّك هنا بطبقات متناسقة:
//   1) دخول ناعم (scale + fade) في أول الإطارات
//   2) لمعة قطرية تمرّ على التصميم (sheen)
//   3) هالة ضوئية تتنفّس بلون البطاقة (breathing glow)
//   4) جزيئات/نجوم تطفو ببطء (floating dust)
//   5) نبضة إطار خفيفة (border pulse)
// كل الطبقات تستخدم نفس منحنى الزمن (easing) ونفس الدورة، فتبدو الحركة
// كأنها قطعة واحدة لا مؤثرات عشوائية. لا يوجد أي GIF خارجي.
const MAX_PIXELS = 1000 * 1000;
const MAX_WIDTH = 1200;

// إعدادات الحركة — مكان واحد لتعديل إيقاع كل البطاقات
const MOTION = {
  frames: 12,          // عدد الإطارات
  delay: 80,           // ms لكل إطار (≈ 1 ثانية للدورة)
  quality: 96,         // دقّة لوحة الألوان
  sheenWidth: 150,     // عرض اللمعة
  sheenSkew: -0.42,    // ميل اللمعة
  dust: 26,            // عدد الجزيئات الطافية
  introFrames: 3,      // إطارات الدخول
};

async function stillPng(canvas) {
  if (typeof canvas.encode === 'function') return canvas.encode('png');
  return canvas.toBuffer('image/png');
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** جزيئات ثابتة (بذرة ثابتة) حتى لا ترتجف بين الإطارات */
function makeDust(w, h, n) {
  let s = 20240517;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: rnd() * w,
      y: rnd() * h,
      r: 0.8 + rnd() * 2.2,
      speed: 0.25 + rnd() * 0.75,
      phase: rnd() * Math.PI * 2,
      alpha: 0.18 + rnd() * 0.45,
    });
  }
  return out;
}

/**
 * يحوّل canvas ثابتاً إلى بطاقة متحركة (GIF).
 * @param {import('@napi-rs/canvas').Canvas} canvas
 * @param {string} name
 * @param {{accent?:string, glow?:string, intensity?:number}} opts
 * @returns {Promise<{buffer:Buffer,name:string}>}
 */
async function animateCanvas(canvas, name = 'card.png', opts = {}) {
  const png = await stillPng(canvas);
  const w = canvas.width;
  const h = canvas.height;
  const still = { buffer: png, name };

  // البطاقات الطويلة جداً تبقى PNG حتى لا يتضخّم حجم الرد
  if (!w || !h || w * h > MAX_PIXELS || w > MAX_WIDTH) return still;

  let gifenc;
  let C;
  try {
    gifenc = require('gifenc');
    C = require('@napi-rs/canvas');
  } catch {
    return still;
  }

  const accent = opts.accent || 'rgba(255,215,106,1)';
  const glow = opts.glow || 'rgba(255,200,90,0.55)';
  const intensity = typeof opts.intensity === 'number' ? opts.intensity : 1;

  try {
    const img = await C.loadImage(png);
    const { GIFEncoder, quantize, applyPalette } = gifenc;
    const enc = GIFEncoder();
    const dust = makeDust(w, h, MOTION.dust);
    // البطاقات الكبيرة تُحرَّك بإطارات أقل حتى يبقى حجم الملف معقولاً
    const N = w * h > 1000 * 640 ? 8 : MOTION.frames;

    for (let f = 0; f < N; f++) {
      const t = f / N;                       // 0..1 دورة كاملة
      const c = C.createCanvas(w, h);
      const ctx = c.getContext('2d');

      // خلفية داكنة تمنع أي شفافية غريبة في GIF
      ctx.fillStyle = '#070b16';
      ctx.fillRect(0, 0, w, h);

      // ── 1) دخول ناعم: تكبير طفيف + ظهور تدريجي في أول الإطارات
      const intro = Math.min(1, (f + 1) / MOTION.introFrames);
      const scale = 0.985 + 0.015 * easeOut(intro);
      const alpha = 0.55 + 0.45 * easeOut(intro);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();

      // ── 2) هالة تتنفّس بلون البطاقة
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const breathe = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
      const gx = w * (0.5 + 0.16 * Math.cos(t * Math.PI * 2));
      const gy = h * (0.42 + 0.10 * Math.sin(t * Math.PI * 2));
      const rad = Math.max(w, h) * (0.30 + 0.06 * breathe);
      const halo = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
      halo.addColorStop(0, glow);
      halo.addColorStop(0.55, 'rgba(255,255,255,0.05)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (0.16 + 0.10 * breathe) * intensity;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // ── 3) جزيئات طافية (حركة رأسية بطيئة + وميض)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const d of dust) {
        const dy = (d.y - t * h * d.speed + h) % h;
        const tw = 0.55 + 0.45 * Math.sin(t * Math.PI * 2 + d.phase);
        ctx.globalAlpha = d.alpha * tw * intensity;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(d.x, dy, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ── 4) لمعة قطرية تمرّ مرة واحدة في الدورة
      const sweep = easeInOut(Math.min(1, t * 1.15));
      const sx = -MOTION.sheenWidth * 2 + sweep * (w + MOTION.sheenWidth * 4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(sx, 0);
      ctx.transform(1, 0, MOTION.sheenSkew, 1, 0, 0);
      const sheen = ctx.createLinearGradient(0, 0, MOTION.sheenWidth, 0);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.45, 'rgba(255,255,255,0.30)');
      sheen.addColorStop(0.55, 'rgba(255,255,255,0.30)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, -h * 0.2, MOTION.sheenWidth, h * 1.4);
      ctx.restore();

      // ── 5) نبضة إطار خفيفة بلون البطاقة
      ctx.save();
      ctx.globalAlpha = (0.10 + 0.10 * breathe) * intensity;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      const inset = 2.5;
      const r = 26;
      ctx.beginPath();
      ctx.moveTo(inset + r, inset);
      ctx.arcTo(w - inset, inset, w - inset, h - inset, r);
      ctx.arcTo(w - inset, h - inset, inset, h - inset, r);
      ctx.arcTo(inset, h - inset, inset, inset, r);
      ctx.arcTo(inset, inset, w - inset, inset, r);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      const frame = ctx.getImageData(0, 0, w, h);
      const pal = quantize(frame.data, MOTION.quality, { format: 'rgb444' });
      const idx = applyPalette(frame.data, pal, 'rgb444');
      enc.writeFrame(idx, w, h, { palette: pal, delay: MOTION.delay, repeat: 0 });
    }

    enc.finish();
    const buffer = Buffer.from(enc.bytes());
    if (buffer.length < 32 || buffer.length > 7_500_000) return still;
    if (buffer.slice(0, 3).toString() !== 'GIF') return still;
    return { buffer, name: String(name).replace(/\.png$/i, '.gif') };
  } catch {
    return still;
  }
}

module.exports = { animateCanvas, MAX_PIXELS, MOTION };
