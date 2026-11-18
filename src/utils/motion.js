// 🎞️ motion v27 — محرّك الحركة الذكي: موشن خاص لكل أمر
// ------------------------------------------------------------------
// كل بطاقة تُرسم مرة واحدة ثم تُحرَّك هنا. v27 يضيف "مشاهد حركة" (presets)
// تُختار تلقائياً من اسم البطاقة أو تُمرَّر صراحة:
//   embers  → الدانجون/القتال: شرر ناري يتصاعد + نبض أحمر + اهتزاز دخول
//   nature  → المزرعة: أوراق تتساقط وتتمايل + أشعة شمس
//   coins   → الاقتصاد: عملات ذهبية تدور وتتساقط + لمعة ذهبية
//   ascend  → المستوى/الرتبة: نجوم تصعد + أشعة دوّارة
//   flame   → الستريك: لهب يتراقص أسفل البطاقة + شرر
//   neon    → الألعاب: قصاصات احتفال + خط نيون ماسح
//   network → اللوحة/المساعدة: عُقد متصلة تنبض كالشبكة
//   hearts  → الاجتماعي: قلوب تطفو
//   scan    → الإدارة/التصويت: خط مسح هادئ
//   calm    → الأذكار: نور هادئ بطيء
//   dust    → الافتراضي
// كل المشاهد تستخدم نفس الدورة الزمنية، فالحلقة (loop) تبدو سلسة بلا قفزات.
const MAX_PIXELS = 1000 * 1000;
const MAX_WIDTH = 1200;

// v28: حركة هادئة وراقية — دخول ناعم، لمعة واحدة، جسيمات خفيفة، لوحة ألوان ثابتة (بلا وميض أو تشوّه ألوان)
const MOTION = { frames: 16, delay: 70, quality: 256, sheenWidth: 220, sheenSkew: -0.35, introFrames: 5, sceneAlpha: 0.38, particles: 14 };

const PRESETS = {
  embers:  { accent: 'rgba(255,110,60,1)',  glow: 'rgba(255,80,40,0.55)',  shake: 4 },
  nature:  { accent: 'rgba(120,230,140,1)', glow: 'rgba(140,255,160,0.45)' },
  coins:   { accent: 'rgba(255,215,106,1)', glow: 'rgba(255,200,90,0.55)' },
  ascend:  { accent: 'rgba(190,170,255,1)', glow: 'rgba(170,140,255,0.5)' },
  flame:   { accent: 'rgba(255,150,40,1)',  glow: 'rgba(255,120,30,0.6)' },
  neon:    { accent: 'rgba(110,220,255,1)', glow: 'rgba(100,190,255,0.5)' },
  network: { accent: 'rgba(110,220,255,1)', glow: 'rgba(90,200,255,0.45)' },
  hearts:  { accent: 'rgba(255,140,200,1)', glow: 'rgba(255,120,190,0.5)' },
  scan:    { accent: 'rgba(210,220,235,1)', glow: 'rgba(200,210,230,0.3)' },
  rain:    { accent: 'rgba(150,210,255,1)', glow: 'rgba(120,190,255,0.4)' },
  snow:    { accent: 'rgba(220,245,255,1)', glow: 'rgba(200,240,255,0.4)' },
  boost:   { accent: 'rgba(255,115,250,1)', glow: 'rgba(255,115,250,0.5)' },
  sleep:   { accent: 'rgba(185,170,255,1)', glow: 'rgba(150,130,255,0.45)' },
  rocket:  { accent: 'rgba(110,220,255,1)', glow: 'rgba(90,200,255,0.5)', shake: 2 },
  calm:    { accent: 'rgba(190,240,255,1)', glow: 'rgba(170,230,255,0.35)' },
  dust:    { accent: 'rgba(255,215,106,1)', glow: 'rgba(255,200,90,0.45)' },
};

const NAME_MAP = [
  [/boost/i, 'boost'], [/afk/i, 'sleep'], [/bump/i, 'rocket'],
  [/dungeon|gate|battle|duel|hunter|boss|shadow|arena/i, 'embers'],
  [/farm|barn|craft|market|garden|pet/i, 'nature'],
  [/balance|bank|coin|steal|shop|daily|work|pay|lotter|stock|wealth|rob/i, 'coins'],
  [/streak/i, 'flame'],
  [/level|rank|profile|podium|leader|achiev|prestige/i, 'ascend'],
  [/slot|roulette|black|dice|crash|scratch|treasure|highlow|race|wheel|rps|games|result|word|question|chairs|lobby|tictac|connect|trivia|hangman|mine|fish|guess/i, 'neon'],
  [/hub|help|server|quest|info|network|auto/i, 'network'],
  [/love|social|marry|rate/i, 'hearts'],
  [/modcase|poll|ticket|warn|ban|kick|mute/i, 'scan'],
  [/dhikr|adhkar/i, 'calm'],
  [/boost/i, 'boost'], [/afk/i, 'sleep'], [/bump/i, 'rocket'],
];
function presetFor(name) {
  for (const [re, p] of NAME_MAP) if (re.test(String(name || ''))) return p;
  return 'dust';
}

async function stillPng(canvas) {
  if (typeof canvas.encode === 'function') return canvas.encode('png');
  return canvas.toBuffer('image/png');
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;

function seeded(seed = 20240517) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function particles(w, h, n, seed) {
  const r = seeded(seed);
  return Array.from({ length: n }, () => ({ x: r() * w, y: r() * h, r: r(), s: 0.4 + r() * 0.8, p: r() * TAU, k: Math.floor(r() * 5) }));
}
function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ── مشاهد الحركة: كل دالة ترسم طبقة فوق البطاقة عند الزمن t (0..1)
const SCENES = {
  dust(ctx, w, h, t, P) {
    for (const d of P) {
      const y = (d.y - t * h * d.s + h) % h;
      ctx.globalAlpha = (0.2 + 0.4 * d.r) * (0.55 + 0.45 * Math.sin(t * TAU + d.p));
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(d.x, y, 0.8 + d.r * 2, 0, TAU); ctx.fill();
    }
  },
  embers(ctx, w, h, t, P) {
    // نبض أحمر من الأطراف
    const pulse = 0.5 + 0.5 * Math.sin(t * TAU * 2);
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(255,40,20,${0.10 + 0.12 * pulse})`);
    ctx.globalAlpha = 1; ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    for (const d of P) {
      const y = h - ((h - d.y + t * h * (0.6 + d.s)) % (h + 20));
      const x = d.x + Math.sin(t * TAU * 2 + d.p) * 10;
      const rad = 1.2 + d.r * 2.6;
      ctx.globalAlpha = 0.45 + 0.5 * d.r;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 3);
      g.addColorStop(0, '#fff3c4'); g.addColorStop(0.35, '#ff9b3d'); g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad * 3, 0, TAU); ctx.fill();
    }
  },
  nature(ctx, w, h, t, P) {
    // أشعة شمس مائلة من الزاوية
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * TAU);
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(w * 0.9, -20); ctx.rotate(0.5 + i * 0.16 + Math.sin(t * TAU) * 0.03);
      const g = ctx.createLinearGradient(0, 0, 0, h * 1.4); g.addColorStop(0, 'rgba(255,240,170,0.9)'); g.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g; ctx.fillRect(-18, 0, 36, h * 1.4); ctx.restore();
    }
    const colors = ['#7ee08a', '#b6ff5c', '#ffd36a', '#ff9f43', '#4cf0b0'];
    for (const d of P.slice(0, 22)) {
      const y = (d.y + t * h * (0.5 + d.s * 0.6)) % (h + 30) - 15;
      const x = d.x + Math.sin(t * TAU + d.p) * 22;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * TAU + d.p) * 1.2 + d.p);
      ctx.globalAlpha = 0.55 + 0.35 * d.r; ctx.fillStyle = colors[d.k];
      ctx.beginPath(); ctx.ellipse(0, 0, 7 + d.r * 5, 3 + d.r * 2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,60,20,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.restore();
    }
  },
  coins(ctx, w, h, t, P) {
    for (const d of P.slice(0, 18)) {
      const y = (d.y + t * h * (0.7 + d.s)) % (h + 40) - 20;
      const spin = Math.abs(Math.cos(t * TAU * 2 + d.p));
      const R = 7 + d.r * 7;
      ctx.save(); ctx.translate(d.x, y); ctx.globalAlpha = 0.75;
      const g = ctx.createLinearGradient(-R, -R, R, R); g.addColorStop(0, '#fff1b0'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#c47a10');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1.5, R * spin), R, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,0,0.8)'; ctx.lineWidth = 1.4; ctx.stroke();
      if (spin > 0.6) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(-R * spin * 0.35, -R * 0.35, R * 0.18, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  },
  ascend(ctx, w, h, t, P) {
    ctx.save(); ctx.translate(w / 2, h * 0.45); ctx.rotate(t * TAU / 6);
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 14; i++) { ctx.rotate(TAU / 14); ctx.fillStyle = '#d9ccff'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(w, h), -26); ctx.lineTo(Math.max(w, h), 26); ctx.fill(); }
    ctx.restore();
    for (const d of P) {
      const y = h - ((h - d.y + t * h * d.s * 1.2) % h);
      const s = (1.5 + d.r * 4) * (0.6 + 0.4 * Math.sin(t * TAU * 2 + d.p));
      ctx.globalAlpha = 0.5 + 0.5 * d.r; ctx.fillStyle = d.k % 2 ? '#ffffff' : '#ffe9a6';
      ctx.beginPath(); ctx.moveTo(d.x, y - s * 2); ctx.lineTo(d.x + s * 0.5, y - s * 0.5); ctx.lineTo(d.x + s * 2, y);
      ctx.lineTo(d.x + s * 0.5, y + s * 0.5); ctx.lineTo(d.x, y + s * 2); ctx.lineTo(d.x - s * 0.5, y + s * 0.5);
      ctx.lineTo(d.x - s * 2, y); ctx.lineTo(d.x - s * 0.5, y - s * 0.5); ctx.closePath(); ctx.fill();
    }
  },
  flame(ctx, w, h, t, P) {
    for (let i = 0; i < 18; i++) {
      const x = (i + 0.5) * (w / 18);
      const fh = h * (0.16 + 0.08 * Math.sin(t * TAU * 2 + i * 1.7) + 0.04 * Math.sin(t * TAU * 4 + i));
      const g = ctx.createLinearGradient(0, h, 0, h - fh);
      g.addColorStop(0, 'rgba(255,90,20,0.55)'); g.addColorStop(0.5, 'rgba(255,170,40,0.35)'); g.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - w / 22, h); ctx.quadraticCurveTo(x - w / 40, h - fh * 0.6, x + Math.sin(t * TAU + i) * 8, h - fh);
      ctx.quadraticCurveTo(x + w / 40, h - fh * 0.6, x + w / 22, h); ctx.fill();
    }
    SCENES.embers.call(null, ctx, w, h, t, P.slice(0, 14).map((d) => ({ ...d, y: h * 0.7 + d.y * 0.3 })));
  },
  neon(ctx, w, h, t, P) {
    const colors = ['#ffd76a', '#ff6b7f', '#6fd3ff', '#4cf0b0', '#c3a8ff'];
    for (const d of P) {
      const y = (d.y + t * h * (0.6 + d.s)) % (h + 20) - 10;
      ctx.save(); ctx.translate(d.x + Math.sin(t * TAU + d.p) * 14, y); ctx.rotate(t * TAU * (d.k % 2 ? 2 : -2) + d.p);
      ctx.globalAlpha = 0.7; ctx.fillStyle = colors[d.k]; ctx.fillRect(-4, -2, 8 * Math.abs(Math.cos(t * TAU * 3 + d.p)) + 1, 4);
      ctx.restore();
    }
    const sy = (t * h * 1.0) % h;
    const g = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
    g.addColorStop(0, 'rgba(110,220,255,0)'); g.addColorStop(0.5, 'rgba(110,220,255,0.22)'); g.addColorStop(1, 'rgba(110,220,255,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, sy - 30, w, 60);
  },
  network(ctx, w, h, t, P) {
    const nodes = P.slice(0, 16).map((d) => ({ x: d.x + Math.cos(t * TAU + d.p) * 14, y: d.y + Math.sin(t * TAU + d.p) * 10, d }));
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]; const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 220) continue;
      ctx.globalAlpha = (1 - dist / 220) * 0.35; ctx.strokeStyle = '#7fdcff';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // نبضة تسري على الخط
      const k = (t * 2 + (i + j) * 0.13) % 1;
      ctx.globalAlpha = (1 - dist / 220) * 0.8; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 1.6, 0, TAU); ctx.fill();
    }
    for (const n of nodes) {
      const s = 2.5 + 1.5 * Math.sin(t * TAU * 2 + n.d.p);
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#bdf4ff'; ctx.beginPath(); ctx.arc(n.x, n.y, s, 0, TAU); ctx.fill();
    }
  },
  hearts(ctx, w, h, t, P) {
    for (const d of P.slice(0, 16)) {
      const y = h - ((h - d.y + t * h * d.s) % (h + 30));
      const x = d.x + Math.sin(t * TAU + d.p) * 16; const s = 5 + d.r * 7;
      ctx.globalAlpha = 0.55 + 0.3 * d.r; ctx.fillStyle = d.k % 2 ? '#ff7bb5' : '#ffb3d6';
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x, y - s * 0.3, x - s, y - s * 0.3, x - s, y + s * 0.2);
      ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s, x, y + s * 1.2);
      ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.7, x + s, y + s * 0.2);
      ctx.bezierCurveTo(x + s, y - s * 0.3, x, y - s * 0.3, x, y + s * 0.3); ctx.fill();
    }
  },
  scan(ctx, w, h, t) {
    const sx = (t * w * 1.2) % (w + 200) - 100;
    const g = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0);
    g.addColorStop(0, 'rgba(220,230,255,0)'); g.addColorStop(0.5, 'rgba(220,230,255,0.16)'); g.addColorStop(1, 'rgba(220,230,255,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(sx - 80, 0, 160, h);
    ctx.globalAlpha = 0.05; ctx.fillStyle = '#ffffff';
    for (let y = (t * 8) % 4; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  },
  rain(ctx, w, h, t, P) {
    ctx.globalAlpha = 0.12; ctx.fillStyle = '#0a1830'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a9d8ff'; ctx.lineWidth = 1.3;
    for (let i = 0; i < 70; i++) {
      const d = P[i % P.length]; const x = (d.x + i * 37) % w; const y = ((d.y + i * 53) + t * h * 2.2 * (0.7 + d.s * 0.4)) % (h + 40) - 20;
      ctx.globalAlpha = 0.35 + 0.3 * d.r; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16); ctx.stroke();
    }
    if (Math.floor(t * 12) === 7) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
  },
  snow(ctx, w, h, t, P) {
    for (let i = 0; i < 50; i++) {
      const d = P[i % P.length]; const x = ((d.x + i * 41) % w) + Math.sin(t * TAU + d.p + i) * 12; const y = ((d.y + i * 29) + t * h * 0.6 * d.s) % (h + 10) - 5;
      ctx.globalAlpha = 0.6 + 0.4 * d.r; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 1.5 + d.r * 2.5, 0, TAU); ctx.fill();
    }
  },
  boost(ctx, w, h, t, P) {
    for (const d of P) {
      const y = h - ((h - d.y + t * h * (0.5 + d.s)) % (h + 30));
      const x = d.x + Math.sin(t * TAU + d.p) * 10; const s = 4 + d.r * 7;
      ctx.globalAlpha = 0.55 + 0.4 * d.r; ctx.fillStyle = d.k % 2 ? '#ff73fa' : '#b98cff';
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.8, y - s * 0.2); ctx.lineTo(x, y + s * 1.2); ctx.lineTo(x - s * 0.8, y - s * 0.2); ctx.closePath(); ctx.fill();
      ctx.globalAlpha *= 0.6; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.3, y - s * 0.2); ctx.lineTo(x - s * 0.3, y - s * 0.2); ctx.fill();
    }
  },
  sleep(ctx, w, h, t, P) {
    ctx.globalAlpha = 0.08 + 0.05 * Math.sin(t * TAU); ctx.fillStyle = '#1a1050'; ctx.fillRect(0, 0, w, h);
    for (const d of P.slice(0, 12)) {
      const k = (t + d.r) % 1; const x = d.x * 0.5 + w * 0.05 + Math.sin(k * TAU + d.p) * 18; const y = h - k * h * 0.9;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; ctx.fillStyle = '#d9d2ff';
      ctx.font = `bold ${Math.round(14 + k * 26)}px sans-serif`; ctx.fillText('z', x, y);
    }
    SCENES.dust(ctx, w, h, t * 0.4, P.slice(12));
  },
  rocket(ctx, w, h, t, P) {
    ctx.strokeStyle = '#9fe3ff'; ctx.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const d = P[i % P.length]; const x = (d.x + i * 53) % w; const len = 30 + d.r * 70;
      const y = h - ((d.y + i * 31 + t * h * 3 * (0.6 + d.s)) % (h + len));
      ctx.globalAlpha = 0.25 + 0.4 * d.r; ctx.lineWidth = 1 + d.r * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
    }
  },
  calm(ctx, w, h, t, P) {
    const g = ctx.createRadialGradient(w / 2, h * 0.2, 0, w / 2, h * 0.2, w * 0.6);
    g.addColorStop(0, `rgba(200,245,255,${0.12 + 0.06 * Math.sin(t * TAU)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    SCENES.dust(ctx, w, h, t * 0.5, P.slice(0, 18));
  },
};

/**
 * يحوّل canvas ثابتاً إلى بطاقة متحركة (GIF) بمشهد حركة مناسب للأمر.
 * @param {*} canvas
 * @param {string} name اسم الملف — يُستنتج منه مشهد الحركة
 * @param {{preset?:string, accent?:string, glow?:string, intensity?:number}} opts
 */
async function animateCanvas(canvas, name = 'card.png', opts = {}) {
  const png = await stillPng(canvas);
  const w = canvas.width, h = canvas.height;
  const still = { buffer: png, name };
  if (process.env.CARD_MOTION === 'off') return still;
  if (!w || !h || w * h > MAX_PIXELS || w > MAX_WIDTH) return still;

  let gifenc, C;
  try { gifenc = require('gifenc'); C = require('@napi-rs/canvas'); } catch { return still; }

  const presetName = opts.preset && SCENES[opts.preset] ? opts.preset : presetFor(name);
  const preset = PRESETS[presetName] || PRESETS.dust;
  const accent = opts.accent || preset.accent;
  const glow = opts.glow || preset.glow;
  const intensity = typeof opts.intensity === 'number' ? opts.intensity : 1;
  const scene = SCENES[presetName] || SCENES.dust;

  try {
    const img = await C.loadImage(png);
    const { GIFEncoder, quantize, applyPalette } = gifenc;
    const enc = GIFEncoder();
    const P = particles(w, h, MOTION.particles, 20240517 + presetName.length * 97);
    const N = w * h > 1000 * 640 ? 12 : MOTION.frames;
    const c = C.createCanvas(w, h);
    const ctx = c.getContext('2d');
    const layer = C.createCanvas(w, h);
    const lctx = layer.getContext('2d');
    let palette = null;

    for (let f = 0; f < N; f++) {
      const t = f / N;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0a0d18'; ctx.fillRect(0, 0, w, h);

      // 1) دخول ناعم: ظهور + صعود خفيف (بلا اهتزاز)
      const intro = easeOut(Math.min(1, (f + 1) / MOTION.introFrames));
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.65 * intro;
      ctx.translate(0, (1 - intro) * 10);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();

      // 1.5) امتلاء أشرطة التقدم
      if (Array.isArray(opts.reveal)) {
        const k = easeInOut(Math.min(1, (f + 1) / Math.max(2, Math.floor(N * 0.55))));
        for (const R of opts.reveal) {
          const cover = R.w * (1 - k) * (R.ratio ?? 1);
          if (cover <= 0.5) continue;
          ctx.save(); rrPath(ctx, R.x, R.y, R.w, R.h, R.h / 2); ctx.clip();
          const x0 = R.x + R.w * (1 - (R.ratio ?? 1));
          ctx.fillStyle = R.bg || '#141a30'; ctx.fillRect(x0, R.y, cover, R.h);
          ctx.fillStyle = R.color || 'rgba(255,255,255,0.06)'; ctx.fillRect(x0, R.y, cover, R.h);
          ctx.restore();
        }
      }

      // 2) مشهد الأمر على طبقة منفصلة ثم يُدمج بشفافية منخفضة — أنيق وغير مزعج
      const breathe = 0.5 + 0.5 * Math.sin(t * TAU);
      lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalAlpha = 1; lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, w, h);
      scene(lctx, w, h, t, P);
      ctx.save(); rrPath(ctx, 0, 0, w, h, 28); ctx.clip();
      ctx.globalAlpha = MOTION.sceneAlpha * intensity * intro * Math.max(0, Math.min(1, (N - 1 - f) / 4)); // يختفي المشهد في النهاية → إطار أخير نظيف
      ctx.drawImage(layer, 0, 0);
      ctx.restore();

      // 3) هالة لونية خفيفة جداً في الزاوية
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, Math.max(w, h) * 0.5);
      halo.addColorStop(0, glow); halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (0.06 + 0.05 * breathe) * intensity; ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // 4) لمعة زجاجية واحدة تمر بعد الدخول
      const st = Math.min(1, Math.max(0, (t - 0.25) / 0.6));
      if (st > 0 && st < 1) {
        const sx = -MOTION.sheenWidth * 2 + easeInOut(st) * (w + MOTION.sheenWidth * 4);
        ctx.save(); rrPath(ctx, 0, 0, w, h, 28); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
        ctx.translate(sx, 0); ctx.transform(1, 0, MOTION.sheenSkew, 1, 0, 0);
        const sheen = ctx.createLinearGradient(0, 0, MOTION.sheenWidth, 0);
        sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0.10)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sheen; ctx.fillRect(0, -h * 0.2, MOTION.sheenWidth, h * 1.4);
        ctx.restore();
      }

      // 5) حدّ رفيع بلون الأمر
      ctx.save(); ctx.globalAlpha = (0.22 + 0.12 * breathe) * intensity; ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      rrPath(ctx, 1.5, 1.5, w - 3, h - 3, 27); ctx.stroke(); ctx.restore();

      const frame = ctx.getImageData(0, 0, w, h);
      // لوحة ألوان واحدة لكل الإطارات (من الإطار النهائي الكامل) → تدرّجات نظيفة بلا وميض
      if (!palette) {
        const ref = C.createCanvas(w, h); const r = ref.getContext('2d');
        r.drawImage(img, 0, 0); r.globalAlpha = MOTION.sceneAlpha; scene(lctx, w, h, 0.5, P); r.drawImage(layer, 0, 0);
        palette = quantize(r.getImageData(0, 0, w, h).data, MOTION.quality, { format: 'rgb565' });
      }
      const idx = applyPalette(frame.data, palette, 'rgb565');
      enc.writeFrame(idx, w, h, { palette: f === 0 ? palette : undefined, first: f === 0, delay: f === N - 1 ? (opts.hold || 1800) : MOTION.delay, repeat: process.env.CARD_LOOP === 'on' ? 0 : -1 });
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

module.exports = { animateCanvas, presetFor, PRESETS, SCENES, MAX_PIXELS, MOTION };
