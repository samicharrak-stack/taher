// 🎴 gameMedia v25 — تم إلغاء كل ملفات GIF العشوائية نهائياً.
// البطاقات المتحركة تُولَّد الآن من محرّك الحركة الموحّد (utils/motion.js)
// عبر البطاقات المرسومة (cardKit / modernCards / rpgCards / dungeonCards).
// هذا الملف يبقى كواجهة متوافقة فقط حتى لا تنكسر الأوامر القديمة:
// كل الدوال تُرجع null، فلا يُرفق أي GIF خارجي ولا يُستبدل أي بطاقة مرسومة.
const EMPTY = Object.freeze({});

/** لا يوجد GIF — البطاقة المرسومة هي الصورة الوحيدة */
function pickGif() { return null; }
function pickGifAttachment() { return null; }
function introGif() { return null; }

/**
 * متوافقة مع الاستدعاء القديم: لا تُعدّل التفاعل إطلاقاً.
 * (كانت تضيف GIF عشوائياً كصورة/مصغّرة — أُزيلت بالكامل)
 */
function attachIntroGif(interaction) { return interaction; }

module.exports = {
  pickGif,
  pickGifAttachment,
  introGif,
  attachIntroGif,
  MAP: EMPTY,
  GIF_DIR: null,
};
