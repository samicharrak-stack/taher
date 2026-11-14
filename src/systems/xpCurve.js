// منحنى الخبرة — نفس المعادلة القديمة بصيغة مغلقة:
// مجموع (4i² + 40i + 80) من i = 0 حتى (المستوى - 2)
function xpForLevel(level) {
  const L = Math.floor(Number(level) || 1);
  if (L <= 1) return 0;
  const n = L - 2;
  const count = n + 1;
  const sumI = (n * count) / 2;
  const sumI2 = (n * count * (2 * n + 1)) / 6;
  return 4 * sumI2 + 40 * sumI + 80 * count;
}

function calculateLevel(xp) {
  const x = Math.max(0, Number(xp) || 0);
  if (x < xpForLevel(2)) return 1;
  let lo = 1;
  let hi = 2;
  while (xpForLevel(hi) <= x && hi < 100000) hi *= 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xpForLevel(mid) <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** تقدّم المستوى الحالي من إجمالي الخبرة */
function levelProgress(totalXP) {
  const total = Math.max(0, Number(totalXP) || 0);
  const level = calculateLevel(total);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - base);
  const into = Math.max(0, total - base);
  return { level, totalXP: total, xp: into, nextXP: span, ratio: Math.min(1, into / span) };
}

module.exports = { xpForLevel, calculateLevel, levelProgress };
