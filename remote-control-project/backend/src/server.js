/**
 * Remote Control Signaling Server
 * ---------------------------------
 * Vazifasi:
 *  1) Qurilmalarni ro'yxatdan o'tkazish va autentifikatsiya qilish (JWT)
 *  2) "Pairing" - Agent (kuzatiluvchi telefon) va Controller (kuzatuvchi telefon)ni
 *     bir-biriga xavfsiz ulash uchun bir martalik kodlar
 *  3) WebRTC signaling - offer/answer/ICE candidate xabarlarini ikki tomon
 *     o'rtasida uzatish (video/audio/data oqimining o'zi WebRTC orqali
 *     to'g'ridan-to'g'ri (P2P) ketadi, server faqat "tanishtiruvchi")
 *  4) MUHIM: Agent tomonidagi razrezhaniye (consent) - Controller ulanishidan
 *     oldin Agent tomonda foydalanuvchi tasdiqlashi shart bo'lgan oqim
 *  5) /ice-servers - mijozlarga STUN/TURN sozlamalarini beradi (TURN maxfiy
 *     ma'lumotlari faqat shu endpoint orqali, kodga yozilmaydi)
 *
 * SAQLASH: doimiy ma'lumot (foydalanuvchi, qurilma, sessiya tarixi) store.js
 * orqali saqlanadi - DATABASE_URL bo'lsa Postgres, bo'lmasa xotira. Faol
 * WebSocket ulanishlari, pairing kodlar va faol sessiya marshruti esa shu
 * yerda xotirada (runtime holati) boshqariladi.
 *
 * ESLATMA (ishlab chiqarish uchun):
 *  - HTTPS/WSS albatta ishlatilishi shart (Nginx + certbot - DEPLOYMENT.md).
 *  - Rate limiting, pairing-kod urinishlarini cheklash qo'shilishi kerak.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { createStore } = require('./store');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 8080;

const store = createStore();

// ---------- Runtime (xotira) holati - saqlanmaydi ----------
const wsByDevice = new Map();   // deviceId -> ws (faol ulanishlar)
const pairingCodes = new Map(); // code -> { agentDeviceId, expiresAt }
const activeSessions = new Map(); // sessionId -> { agentDeviceId, controllerDeviceId, approved }

function isOnline(deviceId) {
  const ws = wsByDevice.get(deviceId);
  return !!(ws && ws.readyState === 1);
}
function sendTo(deviceId, obj) {
  const ws = wsByDevice.get(deviceId);
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

// ---------- Yordamchi funksiyalar ----------
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token yo\'q' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token noto\'g\'ri yoki eskirgan' });
  }
}

// Async route'lardagi xatolarni ushlab, 500 qaytaradigan o'rovchi
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error('[route xato]', e);
  res.status(500).json({ error: 'Server xatosi' });
});

// ---------- ICE serverlar (STUN/TURN) ----------
// Mijozlar (Android/web) WebRTC uchun shu ro'yxatni oladi. TURN maxfiy
// ma'lumotlari faqat .env'da turadi va shu yerdan beriladi.
function buildIceServers() {
  const servers = [];
  const stun = process.env.STUN_URL || 'stun:stun.l.google.com:19302';
  servers.push({ urls: stun });
  if (process.env.TURN_URL) {
    servers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_PASSWORD || ''
    });
  }
  return servers;
}
app.get('/ice-servers', authMiddleware, (req, res) => {
  res.json({ iceServers: buildIceServers() });
});

// ---------- Auth: ro'yxatdan o'tish / kirish ----------
app.post('/auth/register', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email va password kerak' });
  const exists = await store.findUserByEmail(email);
  if (exists) return res.status(409).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  await store.createUser({ id, email, passwordHash });
  const token = signToken({ userId: id, email });
  res.json({ token });
}));

app.post('/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await store.findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Email yoki parol xato' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Email yoki parol xato' });
  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token });
}));

// ---------- Qurilmani ro'yxatga olish ----------
// role: "agent" (kuzatiluvchi) yoki "controller" (kuzatuvchi)
app.post('/devices/register', authMiddleware, wrap(async (req, res) => {
  const { name, role, platform } = req.body;
  if (!['agent', 'controller'].includes(role)) {
    return res.status(400).json({ error: 'role "agent" yoki "controller" bo\'lishi kerak' });
  }
  const id = uuidv4();
  await store.createDevice({
    id, userId: req.user.userId, name: name || 'Nomsiz qurilma',
    role, platform: platform || 'unknown'
  });
  res.json({ deviceId: id });
}));

// ---------- Pairing kod yaratish (Agent tomonda) ----------
app.post('/pair/generate-code', authMiddleware, wrap(async (req, res) => {
  const { agentDeviceId } = req.body;
  const device = await store.getDevice(agentDeviceId);
  if (!device || device.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Qurilma topilmadi' });
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pairingCodes.set(code, { agentDeviceId, expiresAt: Date.now() + 5 * 60 * 1000 });
  res.json({ code, expiresInSeconds: 300 });
}));

// ---------- Pairing kodni ishlatish (Controller tomonda) ----------
// Bu faqat sessionni yaratadi - Agent hali tasdiqlamagan (kutish holatida)
app.post('/pair/claim', authMiddleware, wrap(async (req, res) => {
  const { code, controllerDeviceId } = req.body;
  const entry = pairingCodes.get(code);
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Kod noto\'g\'ri yoki muddati o\'tgan' });
  }
  const sessionId = uuidv4();
  const startedAt = Date.now();

  // Marshrutlash uchun runtime holat
  activeSessions.set(sessionId, {
    agentDeviceId: entry.agentDeviceId,
    controllerDeviceId,
    approved: false
  });
  // Audit-log uchun doimiy yozuv
  await store.addSession({
    id: sessionId,
    agentDeviceId: entry.agentDeviceId,
    controllerDeviceId,
    approved: false,
    startedAt,
    endedAt: null
  });
  pairingCodes.delete(code); // kod bir martalik

  // Agent hali onlayn bo'lsa, unga darhol so'rov yuboramiz
  sendTo(entry.agentDeviceId, {
    type: 'pairing-request',
    sessionId,
    controllerDeviceId
  });

  res.json({ sessionId, status: 'waiting_for_agent_approval' });
}));

app.get('/health', (req, res) => res.json({ ok: true }));

// ---------- Foydalanuvchining qurilmalari ro'yxati ----------
app.get('/devices', authMiddleware, wrap(async (req, res) => {
  const list = (await store.listDevicesByUser(req.user.userId)).map(d => ({
    id: d.id, name: d.name, role: d.role, platform: d.platform, online: isOnline(d.id)
  }));
  res.json({ devices: list });
}));

// ---------- Sessiyalar tarixi (audit-log) ----------
app.get('/sessions', authMiddleware, wrap(async (req, res) => {
  const myDevices = await store.listDevicesByUser(req.user.userId);
  const nameById = new Map(myDevices.map(d => [d.id, d.name]));
  const history = await store.listSessionsForDeviceIds(myDevices.map(d => d.id));
  const list = history.map(s => ({
    id: s.id,
    agentName: nameById.get(s.agentDeviceId) || 'Noma\'lum',
    controllerName: nameById.get(s.controllerDeviceId) || 'Noma\'lum',
    approved: s.approved,
    startedAt: s.startedAt,
    endedAt: s.endedAt || null
  }));
  res.json({ sessions: list });
}));

// ==================== WebSocket - signaling ====================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const deviceId = url.searchParams.get('deviceId');

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    ws.close(4001, 'Auth xato');
    return;
  }

  const device = await store.getDevice(deviceId);
  if (!device || device.userId !== user.userId) {
    ws.close(4004, 'Qurilma topilmadi');
    return;
  }

  wsByDevice.set(deviceId, ws);
  console.log(`[WS] Ulandi: ${device.name} (${device.role}) - ${deviceId}`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      // Agent tomon pairing so'rovini tasdiqlaydi/rad etadi
      case 'pairing-response': {
        const session = activeSessions.get(msg.sessionId);
        if (!session || session.agentDeviceId !== deviceId) return;
        session.approved = !!msg.approved;
        store.setSessionApproved(msg.sessionId, session.approved).catch(() => {});

        sendTo(session.controllerDeviceId, {
          type: 'pairing-result',
          sessionId: msg.sessionId,
          approved: session.approved
        });
        break;
      }

      // WebRTC signaling xabarlari: offer, answer, ice-candidate
      // Bularni to'g'ridan-to'g'ri qarama-qarshi tomonga "relay" qilamiz
      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        const session = activeSessions.get(msg.sessionId);
        if (!session || !session.approved) return; // tasdiqlanmagan sessiyada signaling yo'q

        const targetId = deviceId === session.agentDeviceId
          ? session.controllerDeviceId
          : session.agentDeviceId;
        sendTo(targetId, { ...msg, from: deviceId });
        break;
      }

      // Controller -> Agent: sichqoncha/teginish/klaviatura buyruqlari
      case 'input-command': {
        const session = activeSessions.get(msg.sessionId);
        if (!session || !session.approved || session.controllerDeviceId !== deviceId) return;
        sendTo(session.agentDeviceId, { type: 'input-command', payload: msg.payload });
        break;
      }

      // Sessiyani tugatish (ikkala tomon ham chaqira oladi)
      case 'end-session': {
        const session = activeSessions.get(msg.sessionId);
        if (!session) return;
        store.endSession(msg.sessionId, Date.now()).catch(() => {}); // audit-log'da qoladi
        const otherId = deviceId === session.agentDeviceId
          ? session.controllerDeviceId : session.agentDeviceId;
        sendTo(otherId, { type: 'session-ended', sessionId: msg.sessionId });
        activeSessions.delete(msg.sessionId);
        break;
      }
    }
  });

  ws.on('close', () => {
    // Faqat shu ulanish hali joriy bo'lsa o'chiramiz (qayta ulanish poygasiga qarshi)
    if (wsByDevice.get(deviceId) === ws) wsByDevice.delete(deviceId);
    console.log(`[WS] Uzildi: ${device.name} - ${deviceId}`);
  });
});

async function start() {
  await store.init();
  server.listen(PORT, () => {
    console.log(`Signaling server ${PORT}-portda ishlamoqda`);
  });
}

// Test uchun import qilinganda avtomatik ishga tushmasin
if (require.main === module) {
  start().catch((e) => { console.error('Ishga tushirishda xato:', e); process.exit(1); });
}

module.exports = { app, server, store, start };
