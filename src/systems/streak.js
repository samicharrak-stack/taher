// 🔥 streak v27 — نظام الستريك الموحّد (سلسلة النشاط اليومي)
// ------------------------------------------------------------------
// - أي نشاط (رسالة أو أمر) في يوم جديد يزيد السلسلة يوماً واحداً
// - فوت يوم واحد؟ درع الستريك 🛡️ ينقذ سلسلتك تلقائياً
// - مضاعف موحّد يُطبَّق على: الخبرة، الراتب اليومي، العمل، الدانجون، المزرعة
// - محطات (milestones) بمكافآت جواهر وألقاب
// التخزين داخل بيانات العضو في السيرفر (نفس حقول xp_streak القديمة للتوافق):
//   xp_streak, xp_day, streak_best, streak_shields, streak_milestones[], streak_history[]
const DAY = 86_400_000;
const MAX_SHIELDS = 3;
const SHIELD_BASE_PRICE = 2500;

const MILESTONES = [
  { days: 3,   reward: 500,    title: 'شرارة',        emoji: '✨' },
  { days: 7,   reward: 1500,   title: 'أسبوع النار',   emoji: '🔥' },
  { days: 14,  reward: 4000,   title: 'لهب لا ينطفئ', emoji: '☄️' },
  { days: 30,  reward: 10000,  title: 'سيد الشهر',     emoji: '👑' },
  { days: 60,  reward: 25000,  title: 'أسطورة حيّة',   emoji: '🐉' },
  { days: 100, reward: 60000,  title: 'خالد',          emoji: '🌌' },
  { days: 365, reward: 250000, title: 'عام كامل',      emoji: '🏆' },
];

const dayOf = (now = Date.now()) => Math.floor(now / DAY);

/** المضاعف: +1% لكل يوم حتى +50% (يبدأ من اليوم الثاني) */
function multOf(count) {
  return 1 + Math.min(0.5, Math.max(0, (count || 1) - 1) * 0.01 * (count > 30 ? 1.2 : 1));
}

function tierOf(count = 0) {
  if (count >= 100) return { name: 'خالد', theme: 'violet', emoji: '🌌' };
  if (count >= 30)  return { name: 'ذهبي', theme: 'gold', emoji: '👑' };
  if (count >= 14)  return { name: 'ناري', theme: 'crimson', emoji: '☄️' };
  if (count >= 7)   return { name: 'متوهّج', theme: 'amber', emoji: '🔥' };
  if (count >= 3)   return { name: 'شرارة', theme: 'amber', emoji: '✨' };
  return { name: 'بداية', theme: 'slate', emoji: '🕯️' };
}

function nextMilestone(count = 0) {
  return MILESTONES.find((m) => m.days > count) || null;
}

/**
 * يسجّل نشاط العضو اليوم. يعدّل كائن العضو u مباشرة (المستدعي يحفظ).
 * @returns {{count:number, mult:number, isNewDay:boolean, shieldUsed:boolean, reset:boolean, milestone:object|null, dailyBonus:number}}
 */
function touch(u, now = Date.now()) {
  const day = dayOf(now);
  const last = u.xp_day ?? null;
  const res = { count: u.xp_streak || 0, isNewDay: false, shieldUsed: false, reset: false, milestone: null, dailyBonus: 0 };
  if (last === day) { res.mult = multOf(res.count || 1); return res; }

  res.isNewDay = true;
  const gap = last == null ? Infinity : day - last;
  if (gap === 1) {
    u.xp_streak = (u.xp_streak || 0) + 1;
  } else if (gap === 2 && (u.streak_shields || 0) > 0) {
    u.streak_shields -= 1;
    u.xp_streak = (u.xp_streak || 0) + 1;
    res.shieldUsed = true;
  } else {
    if ((u.xp_streak || 0) > 1) res.reset = true;
    u.xp_streak = 1;
    u.streak_milestones = [];
  }
  u.xp_day = day;
  u.streak_best = Math.max(u.streak_best || 0, u.xp_streak);
  u.streak_history = [...(u.streak_history || []), day].slice(-14);
  res.count = u.xp_streak;
  res.dailyBonus = 50;

  const m = MILESTONES.find((x) => x.days === u.xp_streak);
  u.streak_milestones = u.streak_milestones || [];
  if (m && !u.streak_milestones.includes(m.days)) {
    u.streak_milestones.push(m.days);
    u.balance = (u.balance || 0) + m.reward;
    u.streak_title = m.title;
    res.milestone = m;
  }
  res.mult = multOf(res.count);
  return res;
}

/** يطبّق مضاعف الستريك على مبلغ (جواهر/خبرة) */
function apply(u, amount) {
  const n = Number(amount) || 0;
  if (n <= 0) return n;
  return Math.floor(n * multOf(u?.xp_streak || 1));
}

/** حالة السلسلة للعرض: هل هي مهددة؟ */
function status(u, now = Date.now()) {
  const day = dayOf(now);
  const count = u?.xp_streak || 0;
  const last = u?.xp_day ?? null;
  const activeToday = last === day;
  const atRisk = !activeToday && last === day - 1;
  const broken = last != null && day - last > ((u?.streak_shields || 0) > 0 ? 2 : 1);
  const msLeft = (day + 1) * DAY - now;
  const history = new Set(u?.streak_history || []);
  const week = Array.from({ length: 7 }, (_, i) => history.has(day - 6 + i));
  return {
    count: broken ? 0 : count, best: u?.streak_best || count, shields: u?.streak_shields || 0,
    mult: multOf(broken ? 1 : count), activeToday, atRisk, broken, msLeft, week,
    tier: tierOf(broken ? 0 : count), next: nextMilestone(broken ? 0 : count), title: u?.streak_title || null,
  };
}

function shieldPrice(u) { return SHIELD_BASE_PRICE * ((u?.streak_shields || 0) + 1); }

function buyShield(u) {
  if ((u.streak_shields || 0) >= MAX_SHIELDS) return { ok: false, reason: 'max' };
  const price = shieldPrice(u);
  if ((u.balance || 0) < price) return { ok: false, reason: 'money', price };
  u.balance -= price;
  u.streak_shields = (u.streak_shields || 0) + 1;
  return { ok: true, price, shields: u.streak_shields };
}

/** تسجيل نشاط مباشر في ملف السيرفر (للأوامر) */
function touchMember(guildId, userId) {
  try {
    const { readGuild, writeGuild } = require('../utils/guildStorage');
    const g = readGuild(guildId);
    g.users = g.users || {};
    const u = g.users[userId] = g.users[userId] || { balance: require('../config').DEFAULT_BALANCE || 1000, xp: 0, level: 1 };
    const r = touch(u);
    if (r.isNewDay) writeGuild(guildId, g);
    return r;
  } catch { return null; }
}

module.exports = { MILESTONES, MAX_SHIELDS, multOf, tierOf, nextMilestone, touch, apply, status, shieldPrice, buyShield, touchMember, dayOf };
