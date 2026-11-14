// node scripts/test-level-rewards.js
const assert = require('assert');
const R = require('../src/systems/levelRewards');

// الافتراضي: 100 + 50 × (L-1)
assert.strictEqual(R.rewardForLevel(R.getRewardConfig({}), 2), 150);
assert.strictEqual(R.rewardForLevel(R.getRewardConfig({}), 10), 550);
// مخصص لمستوى معين يستبدل المعادلة
const g = {}; R.setRewardConfig(g, { custom: { 10: 5000 } });
assert.strictEqual(R.rewardForLevel(R.getRewardConfig(g), 10), 5000);
// تخطي عدة مستويات يجمع مكافآتها ويضيفها للرصيد
const u = { balance: 1000 };
assert.strictEqual(R.grantLevelReward({}, u, 1, 3), 150 + 200);
assert.strictEqual(u.balance, 1350);
// الإيقاف = لا مكافأة
const off = {}; R.setRewardConfig(off, { enabled: false });
const u2 = { balance: 10 };
assert.strictEqual(R.grantLevelReward(off, u2, 1, 5), 0);
assert.strictEqual(u2.balance, 10);
// معلم المستوى 10 يضيف 500 فوق المكافأة العادية 550
const mile = { balance: 0 };
assert.strictEqual(R.grantLevelReward({}, mile, 9, 10), 550 + 500);
assert.strictEqual(mile.balance, 1050);
const curve = require('../src/systems/xpCurve');
assert.strictEqual(curve.xpForLevel(1), 0);
assert.strictEqual(curve.xpForLevel(2), 80);
assert.strictEqual(curve.xpForLevel(3), 204);
assert.strictEqual(curve.calculateLevel(79), 1);
assert.strictEqual(curve.calculateLevel(80), 2);
assert.strictEqual(curve.calculateLevel(203), 2);
assert.strictEqual(curve.calculateLevel(204), 3);
for (let L = 1; L <= 40; L++) {
  let slow = 0;
  for (let i = 0; i < L - 1; i++) slow += 4 * i * i + 40 * i + 80;
  assert.strictEqual(curve.xpForLevel(L), slow);
  assert.strictEqual(curve.calculateLevel(slow), L);
}
const info = require('../src/systems/levelInfo');
assert.strictEqual(info.trackFor(1).id, 'start');
assert.strictEqual(info.trackFor(25).id, 'star');
assert.strictEqual(info.trackFor(100).id, 'myth');
assert.strictEqual(info.nextTitle(8).level, 10);
console.log('✅ level rewards tests passed');
