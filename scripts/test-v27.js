// v27: نظام الستريك الموحّد + الشبكة
const assert = require('assert');
const streak = require('../src/systems/streak');
const day = 86_400_000;

// يوم متتالي يزيد السلسلة، والمضاعف الاقتصادي +1% يومياً
let u = {};
streak.touch(u, 10 * day); streak.touch(u, 11 * day);
assert.strictEqual(u.xp_streak, 2);
assert.ok(Math.abs(streak.multOf(2) - 1.01) < 1e-9);
assert.strictEqual(streak.apply(u, 1000), 1010);

// المضاعف الاقتصادي لا يتجاوز +50%
assert.ok(Math.abs(streak.multOf(400) - 1.5) < 1e-9);

// الدرع ينقذ يوماً واحداً فائتاً ويُستهلك
u = { xp_streak: 5, xp_day: 20, streak_shields: 1 };
const r = streak.touch(u, 22 * day);
assert.strictEqual(r.shieldUsed, true);
assert.strictEqual(u.xp_streak, 6);
assert.strictEqual(u.streak_shields, 0);

// بدون درع: فوات يوم يعيد السلسلة إلى 1
u = { xp_streak: 5, xp_day: 20 };
streak.touch(u, 22 * day);
assert.strictEqual(u.xp_streak, 1);

// محطة 7 أيام تعطي 1500 جوهرة مرة واحدة
u = { xp_streak: 6, xp_day: 30, balance: 0 };
const m = streak.touch(u, 31 * day);
assert.strictEqual(m.milestone.days, 7);
assert.strictEqual(u.balance, 1500);

// سعر الدرع يتصاعد والحد الأقصى 3
u = { balance: 100000, streak_shields: 0 };
assert.strictEqual(streak.buyShield(u).price, 2500);
assert.strictEqual(streak.buyShield(u).price, 5000);
assert.strictEqual(streak.buyShield(u).price, 7500);
assert.strictEqual(streak.buyShield(u).ok, false);

// الشبكة: كل أمر في الخريطة له روابط معرّفة الأسماء
const { GRAPH, LABELS } = require('../src/systems/network');
for (const [k, list] of Object.entries(GRAPH)) for (const n of list) assert.ok(LABELS[n], `label missing for ${n} (from ${k})`);

console.log('✅ v27 streak + network tests passed');
