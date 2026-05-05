// ============= Image Renderer (v2) =============
// أعيدت كتابة هذا الملف لإصلاح مشكلة عدم ظهور النصوص في بطاقات الرصيد والمستوى.
// التغييرات الرئيسية:
//   1) تسجيل خط Cairo + خط احتياطي للأرقام/اللاتيني (DejaVu/Arial) مع تحقق من نجاح التحميل.
//   2) حماية النصوص: لا نمسح الإيموجي/الرموز التي كانت تختفي بسبب فلتر صارم.
//   3) ضبط baseline بدقة + ظلال خفيفة لزيادة وضوح النص فوق الخلفيات الملوّنة.
//   4) كشف نوع الخط المُحمّل ديناميكياً واستخدام stack مرن كـ fallback.

const path = require('path');
const fs = require('fs');
const arabicReshaper = require('arabic-reshaper');

let bidi = null;
try {
  const bidiModule = require('bidi-js');
  if (typeof bidiModule === 'function') bidi = bidiModule();
  else if (bidiModule && typeof bidiModule.getReorderedProposed === 'function') bidi = bidiModule;
  else if (bidiModule && typeof bidiModule.default === 'function') bidi = bidiModule.default();
} catch (e) { /* ignore */ }

let createCanvas = null;
let loadImage = null;
let GlobalFonts = null;
let FONT_NAME = 'sans-serif';
let FONT_OK = false;

try {
  const c = require('@napi-rs/canvas');
  createCanvas = c.createCanvas;
  loadImage = c.loadImage;
  GlobalFonts = c.GlobalFonts;

  // تسجيل خط Cairo (يدعم العربية + اللاتيني + الأرقام)
  const fontCandidates = [
    path.resolve(__dirname, '../../assets/fonts/cairo.ttf'),
    path.resolve(__dirname, '../../assets/fonts/Cairo-Regular.ttf'),
  ];
  for (const fp of fontCandidates) {
    if (fs.existsSync(fp) && GlobalFonts && typeof GlobalFonts.registerFromPath === 'function') {
      try {
        const ok = GlobalFonts.registerFromPath(fp, 'Cairo');
        if (ok !== false) {
          FONT_NAME = 'Cairo';
          FONT_OK = true;
          console.log('✅ [ImageRenderer] Cairo font registered from', fp);
          break;
        }
      } catch (e) {
        console.warn('⚠️ [ImageRenderer] register failed for', fp, e.message);
      }
    }
  }

  // تسجيل خط الإيموجي إن وُجد
  try {
    const emojiPath = path.resolve(__dirname, '../../assets/fonts/noto-emoji.ttf');
    if (fs.existsSync(emojiPath)) {
      GlobalFonts.registerFromPath(emojiPath, 'NotoEmoji');
      console.log('✅ [ImageRenderer] Emoji font registered');
    }
  } catch {}

  if (!FONT_OK) {
    // محاولة تحميل أي خط نظام كاحتياط لمنع اختفاء النصوص
    try {
      const sysFonts = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                        '/usr/share/fonts/dejavu/DejaVuSans.ttf'];
      for (const sf of sysFonts) {
        if (fs.existsSync(sf)) {
          GlobalFonts.registerFromPath(sf, 'Fallback');
          FONT_NAME = 'Fallback';
          FONT_OK = true;
          console.log('ℹ️ [ImageRenderer] Using system fallback font:', sf);
          break;
        }
      }
    } catch {}
  }

  if (!FONT_OK) {
    console.warn('⚠️ [ImageRenderer] No font registered — text may not render. Place a valid TTF at assets/fonts/cairo.ttf');
  }
} catch (e) {
  console.warn('⚠️ [ImageRenderer] @napi-rs/canvas not available; falling back to embeds. ' + e.message);
}

const FONT_STACK = `"${FONT_NAME}", "Cairo", "NotoEmoji", "DejaVu Sans", "Noto Sans Arabic", Arial, sans-serif`;
const hasCanvas = () => !!createCanvas;

function cleanText(text) {
  if (text === null || text === undefined) return '';
  // حافظ على العربية + الحروف اللاتينية + الأرقام + الرموز الأساسية + الإيموجي
  return String(text).trim() || 'Player';
}

function prepareText(text) {
  if (!text) return '';
  if (!/[\u0600-\u06FF]/.test(text)) return text;
  try {
    const reshaped = arabicReshaper.reshape(text);
    if (bidi && typeof bidi.getReorderedProposed === 'function') return bidi.getReorderedProposed(reshaped);
    return reshaped;
  } catch (e) { return text; }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function withShadow(ctx, fn) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  fn();
  ctx.restore();
}

async function drawAvatarCircle(ctx, url, x, y, size, ringColor) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  try {
    const img = await loadImage(url);
    ctx.drawImage(img, x, y, size, size);
  } catch (e) {
    ctx.fillStyle = '#5865f2';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
  if (ringColor) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
}

// ============== Vector Icons (no emoji needed) ==============
function iconDiamond(ctx, cx, cy, size, color = '#7ee8fa') {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size;
  const grad = ctx.createLinearGradient(0, -s, 0, s);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, color); grad.addColorStop(1, '#1f8eaa');
  ctx.fillStyle = grad;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.85, -s * 0.25);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.85, -s * 0.25);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // facet lines
  ctx.beginPath();
  ctx.moveTo(-s * 0.85, -s * 0.25); ctx.lineTo(s * 0.85, -s * 0.25);
  ctx.moveTo(-s * 0.5, -s * 0.25); ctx.lineTo(0, -s);
  ctx.moveTo(s * 0.5, -s * 0.25); ctx.lineTo(0, -s);
  ctx.moveTo(-s * 0.5, -s * 0.25); ctx.lineTo(0, s);
  ctx.moveTo(s * 0.5, -s * 0.25); ctx.lineTo(0, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

function iconStar(ctx, cx, cy, r, color = '#f1c40f') {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function iconSword(ctx, cx, cy, s, color = '#cdd6f4') {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = color;
  // blade
  ctx.beginPath();
  ctx.moveTo(0, -s); ctx.lineTo(s * 0.18, -s * 0.85);
  ctx.lineTo(s * 0.18, s * 0.3); ctx.lineTo(-s * 0.18, s * 0.3);
  ctx.lineTo(-s * 0.18, -s * 0.85); ctx.closePath(); ctx.fill();
  // crossguard
  ctx.fillStyle = '#a98d52';
  ctx.fillRect(-s * 0.55, s * 0.3, s * 1.1, s * 0.12);
  // handle
  ctx.fillStyle = '#5b3b1f';
  ctx.fillRect(-s * 0.1, s * 0.42, s * 0.2, s * 0.45);
  // pommel
  ctx.fillStyle = '#d4af37';
  ctx.beginPath(); ctx.arc(0, s * 0.92, s * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function iconChat(ctx, cx, cy, s, color = '#5865f2') {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color;
  roundRect(ctx, -s, -s * 0.75, s * 2, s * 1.4, s * 0.3); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.65); ctx.lineTo(-s * 0.15, s * 0.65); ctx.lineTo(-s * 0.4, s * 0.95); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const dx of [-s * 0.45, 0, s * 0.45]) { ctx.beginPath(); ctx.arc(dx, 0, s * 0.13, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function iconHammer(ctx, cx, cy, s, color = '#c0392b') {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 6);
  ctx.fillStyle = color;
  roundRect(ctx, -s * 0.85, -s * 0.4, s * 1.3, s * 0.7, 6); ctx.fill();
  ctx.fillStyle = '#5b3b1f';
  ctx.fillRect(-s * 0.1, s * 0.3, s * 0.2, s * 1.1);
  ctx.restore();
}

function iconLeaf(ctx, cx, cy, s, color = '#27ae60') {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s, -s * 0.6, s, s * 0.6, 0, s);
  ctx.bezierCurveTo(-s, s * 0.6, -s, -s * 0.6, 0, -s);
  ctx.fill();
  ctx.strokeStyle = '#0e6b3a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
  ctx.restore();
}

function iconSlot(ctx, cx, cy, s, color = '#e74c3c') {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = color;
  roundRect(ctx, -s, -s * 0.9, s * 2, s * 1.8, s * 0.18); ctx.fill();
  ctx.fillStyle = '#1c1c2e';
  roundRect(ctx, -s * 0.8, -s * 0.55, s * 1.6, s * 0.9, s * 0.08); ctx.fill();
  ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-s * 0.27, -s * 0.55); ctx.lineTo(-s * 0.27, s * 0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.27, -s * 0.55); ctx.lineTo(s * 0.27, s * 0.35); ctx.stroke();
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath(); ctx.arc(s * 0.85, -s * 0.65, s * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function iconCoin(ctx, cx, cy, r, color = '#f1c40f') {
  ctx.save(); ctx.translate(cx, cy);
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
  grad.addColorStop(0, '#fff7c0'); grad.addColorStop(0.6, color); grad.addColorStop(1, '#a87a06');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7a5806'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

// ============== PROFILE / RANK CARD ==============
async function renderProfileCard(data) {
  if (!hasCanvas()) return null;
  const { username, level, xp, nextXP, balance, avatarURL, stats = {}, rpgClass } = data;
  const W = 900, H = 560;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0f0c29'); bg.addColorStop(0.5, '#302b63'); bg.addColorStop(1, '#24243e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // soft glows
  const glow = ctx.createRadialGradient(W - 100, 100, 20, W - 100, 100, 320);
  glow.addColorStop(0, 'rgba(241,7,163,0.30)'); glow.addColorStop(1, 'rgba(241,7,163,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(80, H - 60, 10, 80, H - 60, 280);
  glow2.addColorStop(0, 'rgba(123,47,247,0.28)'); glow2.addColorStop(1, 'rgba(123,47,247,0)');
  ctx.fillStyle = glow2; ctx.fillRect(0, 0, W, H);

  // Top accent bar
  const topBar = ctx.createLinearGradient(0, 0, W, 0);
  topBar.addColorStop(0, '#7b2ff7'); topBar.addColorStop(1, '#f107a3');
  ctx.fillStyle = topBar; ctx.fillRect(0, 0, W, 8);

  // Avatar
  await drawAvatarCircle(ctx, avatarURL, 50, 60, 180, '#f107a3');

  // ---- Header text block ----
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  withShadow(ctx, () => {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 44px ${FONT_STACK}`;
    ctx.fillText(prepareText(cleanText(username).slice(0, 16)), 260, 115);
  });

  // Level badge
  ctx.save();
  const lg = ctx.createLinearGradient(260, 0, 410, 0);
  lg.addColorStop(0, '#7b2ff7'); lg.addColorStop(1, '#f107a3');
  ctx.fillStyle = lg; roundRect(ctx, 260, 140, 140, 42, 21); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 22px ${FONT_STACK}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`LEVEL ${level}`, 330, 161);
  ctx.restore();

  // Class chip with vector sword
  ctx.save();
  iconSword(ctx, 435, 161, 16, '#cdd6f4');
  ctx.fillStyle = '#e8eaed'; ctx.font = `22px ${FONT_STACK}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(prepareText(cleanText(rpgClass) || 'Hero'), 460, 161);
  ctx.restore();

  // XP label + bar
  const barX = 260, barY = 230, barW = 600, barH = 30;
  ctx.fillStyle = '#cdd1d6'; ctx.font = `bold 16px ${FONT_STACK}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('EXPERIENCE', barX, barY - 10);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff';
  ctx.fillText(`${(xp || 0).toLocaleString()} / ${(nextXP || 0).toLocaleString()} XP`, barX + barW, barY - 10);

  ctx.fillStyle = 'rgba(255,255,255,0.10)'; roundRect(ctx, barX, barY, barW, barH, 15); ctx.fill();
  const ratio = Math.min(1, (xp || 0) / Math.max(1, nextXP || 1));
  const xb = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  xb.addColorStop(0, '#7b2ff7'); xb.addColorStop(1, '#f107a3');
  ctx.fillStyle = xb; roundRect(ctx, barX, barY, Math.max(barH, barW * ratio), barH, 15); ctx.fill();

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, 295); ctx.lineTo(W - 40, 295); ctx.stroke();

  // Stats grid (vector icons, no emoji)
  const items = [
    { draw: (x, y) => iconChat(ctx, x, y, 22, '#5865f2'),  lb: 'MESSAGES', vl: (stats.messages_count || 0).toLocaleString() },
    { draw: (x, y) => iconDiamond(ctx, x, y, 22, '#7ee8fa'), lb: 'BALANCE',  vl: (balance || 0).toLocaleString() },
    { draw: (x, y) => iconHammer(ctx, x, y, 22, '#e67e22'), lb: 'WORK',     vl: (stats.work_count || 0).toLocaleString() },
    { draw: (x, y) => iconSword(ctx, x, y, 22, '#e74c3c'),  lb: 'DUNGEON',  vl: (stats.dungeon_count || 0).toLocaleString() },
    { draw: (x, y) => iconLeaf(ctx, x, y, 22, '#27ae60'),   lb: 'FARM',     vl: (stats.farm_plant_count || 0).toLocaleString() },
    { draw: (x, y) => iconSlot(ctx, x, y, 22, '#c0392b'),   lb: 'SLOTS',    vl: (stats.slots_count || 0).toLocaleString() },
  ];
  const colW = Math.floor((W - 80) / 3);
  for (let i = 0; i < items.length; i++) {
    const c = i % 3, r = Math.floor(i / 3);
    const sx = 40 + c * colW, sy = 320 + r * 115;
    const cellW = colW - 14, cellH = 100;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, sx, sy, cellW, cellH, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();

    // icon left, text right (avoids overlap)
    items[i].draw(sx + 38, sy + cellH / 2);

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#cdd1d6'; ctx.font = `bold 13px ${FONT_STACK}`;
    ctx.fillText(items[i].lb, sx + 78, sy + 38);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 24px ${FONT_STACK}`;
    ctx.fillText(items[i].vl, sx + 78, sy + 70);
  }

  return { buffer: await canvas.encode('png'), name: 'profile.png' };
}

// ============== BALANCE CARD ==============
async function renderBalanceCard(data) {
  if (!hasCanvas()) return null;
  const { username, balance, level, currency = 'جوهرة', avatarURL, rank } = data;
  const W = 900, H = 380;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a1a2e'); bg.addColorStop(0.5, '#16213e'); bg.addColorStop(1, '#0f3460');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Gold radial
  const radial = ctx.createRadialGradient(W - 180, 100, 10, W - 180, 100, 360);
  radial.addColorStop(0, 'rgba(255,215,0,0.30)'); radial.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = radial; ctx.fillRect(0, 0, W, H);

  // Top accent
  const ab = ctx.createLinearGradient(0, 0, W, 0);
  ab.addColorStop(0, '#f1c40f'); ab.addColorStop(1, '#e67e22');
  ctx.fillStyle = ab; ctx.fillRect(0, 0, W, 6);

  // Avatar
  await drawAvatarCircle(ctx, avatarURL, 50, 80, 170, '#f1c40f');

  // Title
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f1c40f'; ctx.font = `bold 22px ${FONT_STACK}`;
  ctx.fillText(prepareText('المحفظة الرقمية'), 250, 100);

  // Username
  withShadow(ctx, () => {
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 36px ${FONT_STACK}`;
    ctx.fillText(prepareText(cleanText(username).slice(0, 18)), 250, 142);
  });

  // Balance row: vector diamond + number, with currency below number (clear of icon)
  const balanceY = 215;
  iconDiamond(ctx, 285, balanceY, 34, '#7ee8fa');
  withShadow(ctx, () => {
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 64px ${FONT_STACK}`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText((balance || 0).toLocaleString(), 335, balanceY);
  });
  // Currency label aligned under number, away from icon
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#a8b2c1'; ctx.font = `20px ${FONT_STACK}`;
  ctx.fillText(prepareText(currency), 335, balanceY + 50);

  // Stat pills (with safe spacing)
  const pills = [
    { lb: 'LEVEL', vl: `${level || 1}`,             color: '#7b2ff7' },
    { lb: 'RANK',  vl: rank ? `#${rank}` : '—',      color: '#e74c3c' }
  ];
  const pillW = 160, pillH = 60, pillGap = 20;
  let px = 250, py = H - pillH - 30;
  for (const p of pills) {
    ctx.fillStyle = p.color; roundRect(ctx, px, py, pillW, pillH, 14); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 14px ${FONT_STACK}`;
    ctx.fillText(p.lb, px + pillW / 2, py + 18);
    ctx.font = `bold 22px ${FONT_STACK}`;
    ctx.fillText(p.vl, px + pillW / 2, py + 42);
    px += pillW + pillGap;
  }

  return { buffer: await canvas.encode('png'), name: 'balance.png' };
}


// ============== LEADERBOARD CARD ==============
async function renderLeaderboardCard(data) {
  if (!hasCanvas()) return null;
  const { title = 'Leaderboard', entries = [], guildName = '' } = data;
  const rowH = 70;
  const W = 900;
  const H = 130 + Math.max(1, entries.length) * rowH + 30;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f0c29'); bg.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const tb = ctx.createLinearGradient(0, 0, W, 0);
  tb.addColorStop(0, '#f1c40f'); tb.addColorStop(0.5, '#f107a3'); tb.addColorStop(1, '#7b2ff7');
  ctx.fillStyle = tb; ctx.fillRect(0, 0, W, 8);

  ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 38px ${FONT_STACK}`;
  ctx.fillText(prepareText(cleanText(title)), W / 2, 30);
  if (guildName) {
    ctx.fillStyle = '#cdd1d6'; ctx.font = `18px ${FONT_STACK}`;
    ctx.fillText(prepareText(cleanText(guildName)), W / 2, 80);
  }

  ctx.textAlign = 'left';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const y = 130 + i * rowH;
    const isTop = i < 3;

    ctx.fillStyle = isTop ? 'rgba(241,196,15,0.12)' : 'rgba(255,255,255,0.04)';
    roundRect(ctx, 30, y, W - 60, rowH - 10, 12); ctx.fill();

    const medals = ['🥇', '🥈', '🥉'];
    ctx.font = `bold 36px ${FONT_STACK}`;
    ctx.fillStyle = isTop ? '#f1c40f' : '#9aa0a6';
    if (i < 3) ctx.fillText(medals[i], 50, y + 8);
    else ctx.fillText(`#${i + 1}`, 50, y + 14);

    if (e.avatarURL) {
      await drawAvatarCircle(ctx, e.avatarURL, 130, y + 5, 50, isTop ? '#f1c40f' : '#3b3b58');
    }

    ctx.fillStyle = '#ffffff'; ctx.font = `bold 22px ${FONT_STACK}`;
    ctx.fillText(prepareText(cleanText(e.name).slice(0, 22)), 200, y + 12);

    ctx.fillStyle = '#cdd1d6'; ctx.font = `16px ${FONT_STACK}`;
    ctx.fillText(prepareText(e.subtitle || ''), 200, y + 38);

    ctx.textAlign = 'right'; ctx.fillStyle = '#f1c40f'; ctx.font = `bold 26px ${FONT_STACK}`;
    ctx.fillText(String(e.value || ''), W - 50, y + 18);
    ctx.textAlign = 'left';
  }

  return { buffer: await canvas.encode('png'), name: 'leaderboard.png' };
}

// ============== LEVEL UP CARD ==============
async function renderLevelUpCard(data) {
  if (!hasCanvas()) return null;
  const { username, level, avatarURL } = data;
  const W = 700, H = 240;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0f0c29'); bg.addColorStop(1, '#f107a3');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  await drawAvatarCircle(ctx, avatarURL, 30, 40, 160, '#fff');

  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  withShadow(ctx, () => {
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 46px ${FONT_STACK}`;
    ctx.fillText('LEVEL UP!', 220, 50);
    ctx.font = `26px ${FONT_STACK}`; ctx.fillStyle = '#f1c40f';
    ctx.fillText(prepareText(cleanText(username).slice(0, 16)), 220, 110);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 40px ${FONT_STACK}`;
    ctx.fillText(`⭐ Level ${level}`, 220, 150);
  });

  return { buffer: await canvas.encode('png'), name: 'levelup.png' };
}

// ============== BATTLE / DUNGEON CARD ==============
async function renderBattleCard(data) {
  if (!hasCanvas()) return null;
  const { enemyName, enemyHp, enemyMaxHp, playerName, playerHp, playerMaxHp, enemyImage, avatarURL, wave, dungeonLevel } = data;
  const W = 900, H = 480;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1e1b2e'); bg.addColorStop(1, '#3d0a0a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 28px ${FONT_STACK}`;
  ctx.fillText(`⚔ Wave ${wave || 1}  •  Dungeon Lv.${dungeonLevel || 1}`, W / 2, 20);

  if (enemyImage) {
    try {
      const img = await loadImage(enemyImage);
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, W / 2 - 130, 70, 260, 200, 18);
      ctx.clip();
      ctx.drawImage(img, W / 2 - 130, 70, 260, 200);
      ctx.restore();
    } catch (e) {}
  }

  if (avatarURL) await drawAvatarCircle(ctx, avatarURL, 40, 90, 130, '#5865f2');

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 24px ${FONT_STACK}`;
  ctx.fillText(prepareText(cleanText(playerName || 'Hero').slice(0, 14)), 40, 230);

  ctx.textAlign = 'right';
  ctx.fillText(prepareText(cleanText(enemyName || 'Enemy').slice(0, 18)), W - 40, 280);

  const drawBar = (x, y, w, cur, max, color, label) => {
    const r = Math.max(0, Math.min(1, (cur || 0) / (max || 1)));
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(ctx, x, y, w, 26, 13); ctx.fill();
    ctx.fillStyle = color; roundRect(ctx, x, y, Math.max(26, w * r), 26, 13); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 14px ${FONT_STACK}`; ctx.textAlign = 'left';
    ctx.fillText(`${label}  ${cur}/${max}`, x + 12, y + 5);
  };

  drawBar(40, 350, 380, playerHp, playerMaxHp, '#2ecc71', 'HP');
  drawBar(W - 40 - 380, 400, 380, enemyHp, enemyMaxHp, '#e74c3c', 'HP');

  return { buffer: await canvas.encode('png'), name: 'battle.png' };
}

// ============== FARM CARD ==============
async function renderFarmCard(data) {
  if (!hasCanvas()) return null;
  const { username, balance, planted = [], crops = {} } = data;
  const W = 900, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b3d2e'); bg.addColorStop(1, '#0a4f3a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 32px ${FONT_STACK}`;
  ctx.fillText(prepareText(`🌾 Farm: ${cleanText(username)}`), 30, 30);
  ctx.font = `22px ${FONT_STACK}`; ctx.fillStyle = '#f1c40f';
  ctx.fillText(`💎 ${(balance || 0).toLocaleString()}`, 30, 75);

  const now = Date.now();
  const keys = Object.keys(crops);
  const boxW = 410, boxH = 160, gap = 20;
  let x = 30, y = 130;
  for (const k of keys) {
    const crop = crops[k];
    const ready = planted.filter(p => p.type === k && now >= p.readyAt).length;
    const grow = planted.filter(p => p.type === k && now < p.readyAt).length;
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; roundRect(ctx, x, y, boxW, boxH, 14); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 24px ${FONT_STACK}`;
    ctx.fillText(prepareText(cleanText(crop.name)), x + 20, y + 18);
    ctx.font = `18px ${FONT_STACK}`; ctx.fillStyle = '#b9f0c5';
    ctx.fillText(`Ready: ${ready} | Growing: ${grow}`, x + 20, y + 60);
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`Sell: ${crop.sellPrice} | Cost: ${crop.cost}`, x + 20, y + 100);
    x += boxW + gap;
    if (x + boxW > W) { x = 30; y += boxH + gap; }
  }
  return { buffer: await canvas.encode('png'), name: 'farm.png' };
}

module.exports = {
  renderProfileCard,
  renderBalanceCard,
  renderLeaderboardCard,
  renderLevelUpCard,
  renderBattleCard,
  renderFarmCard,
  cleanText,
  prepareText,
  hasCanvas,
  FONT_NAME,
  FONT_OK,
};
