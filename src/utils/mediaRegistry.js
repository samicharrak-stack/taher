// 🎴 mediaRegistry v25 — أُلغيت كل روابط GIF الخارجية وملفات assets/gifs.
// كل الصور في البوت الآن بطاقات مرسومة ومتحرّكة من محرّك الحركة الموحّد.
// هذا الملف يبقى كواجهة متوافقة فقط: كل الدوال لا تُعدّل الإمبد ولا تُرفق ملفات.
const EMPTY = Object.freeze({});

/** لا وسائط خارجية — البطاقة المرسومة هي الصورة */
function getMedia() { return null; }
function getFarmMedia() { return null; }
function getDungeonMedia() { return null; }
function resolveLocal() { return null; }
function localFile() { return null; }
function mediaFile() { return null; }

/** لا تُعدّل الإمبد: البطاقة المرسومة تبقى كما هي */
function setEmbedMedia(embed) { return embed; }
function setFarmMedia(embed) { return embed; }

module.exports = {
  GAME_MEDIA: EMPTY,
  FARM_MEDIA: EMPTY,
  DUNGEON_MEDIA: EMPTY,
  LOCAL_MAP: EMPTY,
  GIF_DIR: null,
  getMedia,
  getFarmMedia,
  getDungeonMedia,
  setEmbedMedia,
  setFarmMedia,
  mediaFile,
  resolveLocal,
  localFile,
};
