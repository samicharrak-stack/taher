const fs = require('fs');
const path = require('path');
const { DATA_DIR, DEFAULTS, DEFAULT_USER_DATA } = require('../config');
const { isMongoEnabled, connectMongo } = require('../db/mongo');
const logger = require('../utils/logger');
let GuildModel = null;
let UserModel = null;
let mongoConnected = false;
const gist = require('../db/gistStore');

// Background connection
if (isMongoEnabled()) {
  connectMongo(process.env.MONGODB_URI).then(() => {
    mongoConnected = true;
    GuildModel = require('../models/Guild');
    UserModel = require('../models/User');
    logger.info('✅ MongoDB connected for background sync');
  }).catch(err => {
    logger.error({ err: err.message }, '❌ MongoDB background connection failed');
  });
}

// Ensure directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const USERS_DIR = path.join(DATA_DIR, 'users');
if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });

function guildFilePath(guildId) {
  const p = path.join(DATA_DIR, `${guildId}.json`);
  const fallback = path.join(process.cwd(), 'src', 'data', `${guildId}.json`);
  if (!fs.existsSync(p) && fs.existsSync(fallback)) {
    return fallback;
  }
  return p;
}

function userFilePath(userId) {
  return path.join(USERS_DIR, `${userId}.json`);
}

async function cloudRestoreAll() {
  const res = await gist.restore({
    writeGuildFile: (gid, json) => { fs.writeFileSync(path.join(DATA_DIR, `${gid}.json`), json); guildCache.delete(gid); },
    writeUserFile: (uid, json) => { fs.writeFileSync(userFilePath(uid), json); userCache.delete(uid); },
  });
  gist.start();
  return res;
}

/** كل ملفات البيانات المحلية (للنسخ الاحتياطي) */
function snapshotAll() {
  const out = {};
  for (const f of fs.readdirSync(DATA_DIR)) if (/^\d+\.json$/.test(f)) out[`guild_${f}`] = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
  const users = {};
  for (const f of fs.readdirSync(USERS_DIR)) if (/^\d+\.json$/.test(f)) { try { users[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(USERS_DIR, f), 'utf8')); } catch {} }
  out['users.json'] = JSON.stringify(users);
  return out;
}

// Cache for performance and race condition prevention
const guildCache = new Map();
const userCache = new Map();
const saveTimeouts = new Map();

function readGuild(guildId) {
  if (guildCache.has(guildId)) return guildCache.get(guildId);
  
  const p = guildFilePath(guildId);
  let data = null;

  // Try reading from disk first
  if (fs.existsSync(p)) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      data = JSON.parse(raw || '{}');
    } catch (err) {
      logger.error({ guildId, err }, '❌ Error parsing local guild data');
    }
  }

  // If disk is empty/not found AND Mongo is connected, try reading from Mongo
  if ((!data || Object.keys(data).length <= 5) && mongoConnected && GuildModel) {
    // Note: Since this is a synchronous function, we can't await. 
    // However, we can try to fetch it during bot startup or handle it via a cache prime.
    // For now, let's assume the local disk is the source of truth if it exists.
  }

  if (!data) {
    data = { ...DEFAULTS, templates: {}, xpData: {}, roles: {}, channels: {}, lang: 'en' };
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  }
  
  guildCache.set(guildId, data);
  return data;
}

function writeGuild(guildId, data) {
  // Update cache immediately
  guildCache.set(guildId, data);
  
  // Debounce the actual disk write to improve performance and prevent race conditions
  if (saveTimeouts.has(`guild_${guildId}`)) {
    clearTimeout(saveTimeouts.get(`guild_${guildId}`));
  }
  
  const timeout = setTimeout(() => {
    try {
      const p = guildFilePath(guildId);
      const payload = JSON.stringify(data, null, 2);
      
      // Use atomic write to prevent data corruption
      const tmpPath = `${p}.tmp`;
      fs.writeFileSync(tmpPath, payload);
      fs.renameSync(tmpPath, p);
      
      // Background sync to Mongo
      if (mongoConnected && GuildModel) {
        GuildModel.updateOne({ guildId }, { guildId, data }, { upsert: true }).catch(() => {});
      }
      
      gist.queueGuild(guildId, payload);
      saveTimeouts.delete(`guild_${guildId}`);
    } catch (err) {
      logger.error({ guildId, err }, '❌ Failed to write guild data');
    }
  }, 1000); // 1 second debounce
  
  saveTimeouts.set(`guild_${guildId}`, timeout);
}

function readUser(userId) {
  if (userCache.has(userId)) return userCache.get(userId);
  
  const p = userFilePath(userId);
  let data = { id: userId, ...DEFAULT_USER_DATA }; // Initialize with default data

  if (fs.existsSync(p)) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const parsedData = JSON.parse(raw || '{}');
      // Merge with default data to ensure all keys are present
      data = { ...data, ...parsedData };
    } catch (err) {
      logger.error({ userId, err }, '❌ Error parsing local user data');
      // If parsing fails, use the default data (already initialized above)
    }
  } else {
    // If file doesn't exist, use the default data (already initialized above)
    // and write it to disk for the first time.
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  }
  
  userCache.set(userId, data);
  return data;
}

function writeUser(userId, data) {
  // Update cache immediately
  userCache.set(userId, data);
  
  // Debounce the actual disk write
  if (saveTimeouts.has(`user_${userId}`)) {
    clearTimeout(saveTimeouts.get(`user_${userId}`));
  }
  
  const timeout = setTimeout(() => {
    try {
      const p = userFilePath(userId);
      const payload = JSON.stringify(data, null, 2);
      
      // Use atomic write
      const tmpPath = `${p}.tmp`;
      fs.writeFileSync(tmpPath, payload);
      fs.renameSync(tmpPath, p);
      
      // Background sync to Mongo
      if (mongoConnected && UserModel) {
        UserModel.updateOne({ userId }, { userId, data }, { upsert: true }).catch(() => {});
      }
      
      gist.queueUser(userId, data);
      saveTimeouts.delete(`user_${userId}`);
    } catch (err) {
      logger.error({ userId, err }, '❌ Failed to write user data');
    }
  }, 1000); // 1 second debounce
  
  saveTimeouts.set(`user_${userId}`, timeout);
}

function getSetting(guildId, key, def = undefined) {
  const g = readGuild(guildId);
  return g[key] ?? def;
}

function setSetting(guildId, key, val) {
  const g = readGuild(guildId);
  g[key] = val;
  writeGuild(guildId, g);
}

function saveTemplate(guildId, name, template) {
  const g = readGuild(guildId);
  g.templates = g.templates || {};
  g.templates[name] = template;
  writeGuild(guildId, g);
}

function loadTemplates(guildId) {
  const g = readGuild(guildId);
  return g.templates || {};
}

module.exports = {
  guildFilePath,
  readGuild,
  writeGuild,
  readUser,
  writeUser,
  getSetting,
  setSetting,
  saveTemplate,
  loadTemplates,
  cloudRestoreAll,
  snapshotAll,
};
