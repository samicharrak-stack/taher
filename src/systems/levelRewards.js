// 🎁 مكافآت العملات عند صعود المستوى — قابلة للضبط لكل سيرفر
// الإعدادات في g.levels.rewards:
//   enabled  : تشغيل/إيقاف
//   base     : المكافأة الأساسية لكل مستوى
//   perLevel : زيادة لكل مستوى (مكافأة المستوى L = base + perLevel × (L - 1))
//   custom   : { "10": 5000 } مبلغ مخصص لمستوى معين (يستبدل الحساب)
const DEFAULT_REWARDS = { enabled: true, base: 100, perLevel: 50, custom: {} };

/** مكافأة إضافية عند معالم المسارات، فوق المعادلة العادية */
const MILESTONES = { 10: 500, 25: 2000, 50: 7500, 75: 15000, 100: 40000 };

function milestoneFor(level) {
  return MILESTONES[level] || 0;
}

function getRewardConfig(g) {
  const r = { ...DEFAULT_REWARDS, ...(g?.levels?.rewards || {}) };
  r.custom = { ...(r.custom || {}) };
  return r;
}

function setRewardConfig(g, patch) {
  g.levels = g.levels || {};
  g.levels.rewards = { ...getRewardConfig(g), ...patch };
  return g.levels.rewards;
}

/** مكافأة الوصول لمستوى معين */
function rewardForLevel(cfg, level) {
  if (!cfg.enabled || level < 2) return 0;
  const custom = cfg.custom?.[String(level)];
  if (custom !== undefined && custom !== null) return Math.max(0, Math.floor(Number(custom) || 0));
  return Math.max(0, Math.floor((Number(cfg.base) || 0) + (Number(cfg.perLevel) || 0) * (level - 1)));
}

/** يحسب ويضيف مجموع المكافآت لكل مستوى تم تجاوزه، ويرجع المبلغ */
function grantLevelReward(g, u, oldLevel, newLevel) {
  const cfg = getRewardConfig(g);
  let total = 0;
  for (let L = oldLevel + 1; L <= newLevel; L++) {
    total += rewardForLevel(cfg, L);
    if (cfg.enabled && cfg.custom?.[String(L)] == null) total += milestoneFor(L);
  }
  if (total > 0) u.balance = (Number(u.balance) || 0) + total;
  return total;
}

module.exports = { DEFAULT_REWARDS, MILESTONES, getRewardConfig, setRewardConfig, rewardForLevel, milestoneFor, grantLevelReward };
