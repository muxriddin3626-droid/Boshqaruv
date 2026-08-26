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
 *
 * ESLATMA (ishlab chiqarish uchun):
 *  - Bu yerda ma'lumotlar xotirada (in-memory) saqlanadi - faqat namuna/dev uchun.
 *    Real loyihada Postgres/Redis ishlatilishi kerak.
 *  - HTTPS/WSS albatta ishlatilishi shart (bu yerda oddiy http bilan ko'rsatilgan).
 *  - Rate limiting, audit-log va device-revocation kabi funksiyalar qo'shilishi kerak.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 8080;

// ---------- In-memory "ma'lumotlar bazasi" (namuna uchun) ----------
const users = new Map();        // userId -> { id, email, passwordHash }
const devices = new Map();      // deviceId -> { id, userId, name, role, online, ws }
const pairingCodes = new Map(); // code -> { agentDeviceId, expiresAt }
const sessions = new Map();     // sessionId -> { agentDeviceId, controllerDeviceId, approved }
const sessionHistory = [];      // tugagan/yaratilgan sessiyalar arxivi (namuna uchun xotirada)

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

// ---------- Auth: ro'yxatdan o'tish / kirish ----------
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email va password kerak' });
  const exists = [...users.values()].find(u => u.email === email);
  if (exists) return res.status(409).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  users.set(id, { id, email, passwordHash });
  const token = signToken({ userId: id, email });
  res.json({ token });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = [...users.values()].find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Email yoki parol xato' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Email yoki parol xato' });
  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token });
});

// ---------- Qurilmani ro'yxatga olish ----------
// role: "agent" (kuzatiluvchi) yoki "controller" (kuzatuvchi)
app.post('/devices/register', authMiddleware, (req, res) => {
  const { name, role, platform } = req.body;
  if (!['agent', 'controller'].includes(role)) {
    return res.status(400).json({ error: 'role "agent" yoki "controller" bo\'lishi kerak' });
  }
  const id = uuidv4();
  devices.set(id, {
    id, userId: req.user.userId, name: name || 'Nomsiz qurilma',
    role, platform: platform || 'unknown', online: false, ws: null
  });
  res.json({ deviceId: id });
});

// ---------- Pairing kod yaratish (Agent tomonda) ----------
// Agent o'z ekranida ko'rsatiladigan 6 xonali kod so'raydi.
// Controller shu kodni kiritib, ulanish so'rovi yuboradi.
app.post('/pair/generate-code', authMiddleware, (req, res) => {
  const { agentDeviceId } = req.body;
  const device = devices.get(agentDeviceId);
  if (!device || device.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Qurilma topilmadi' });
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pairingCodes.set(code, { agentDeviceId, expiresAt: Date.now() + 5 * 60 * 1000 });
  res.json({ code, expiresInSeconds: 300 });
});

// ---------- Pairing kodni ishlatish (Controller tomonda) ----------
// Bu faqat sessionni yaratadi - Agent hali tasdiqlamagan (kutish holatida)
app.post('/pair/claim', authMiddleware, (req, res) => {
  const { code, controllerDeviceId } = req.body;
  const entry = pairingCodes.get(code);
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Kod noto\'g\'ri yoki muddati o\'tgan' });
  }
  const sessionId = uuidv4();
  const sessionObj = {
    id: sessionId,
    agentDeviceId: entry.agentDeviceId,
    controllerDeviceId,
    approved: false,       // Agent tasdiqlashi kerak
    createdAt: Date.now(),
    startedAt: Date.now(),
    endedAt: null
  };
  sessions.set(sessionId, sessionObj);
  sessionHistory.push(sessionObj);
  pairingCodes.delete(code); // kod bir martalik

  // Agent hali onlayn bo'lsa, unga darhol so'rov yuboramiz
  const agent = devices.get(entry.agentDeviceId);
  if (agent && agent.ws && agent.ws.readyState === 1) {
    agent.ws.send(JSON.stringify({
      type: 'pairing-request',
      sessionId,
      controllerDeviceId
    }));
  }

  res.json({ sessionId, status: 'waiting_for_agent_approval' });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ---------- Foydalanuvchining qurilmalari ro'yxati ----------
app.get('/devices', authMiddleware, (req, res) => {
  const list = [...devices.values()]
    .filter(d => d.userId === req.user.userId)
    .map(d => ({
      id: d.id, name: d.name, role: d.role, platform: d.platform, online: d.online
    }));
  res.json({ devices: list });
});

// ---------- Sessiyalar tarixi ----------
app.get('/sessions', authMiddleware, (req, res) => {
  const myDeviceIds = new Set(
    [...devices.values()].filter(d => d.userId === req.user.userId).map(d => d.id)
  );
  const list = sessionHistory
    .filter(s => myDeviceIds.has(s.agentDeviceId) || myDeviceIds.has(s.controllerDeviceId))
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(s => ({
      id: s.id,
      agentName: devices.get(s.agentDeviceId)?.name || 'Noma\'lum',
      controllerName: devices.get(s.controllerDeviceId)?.name || 'Noma\'lum',
      approved: s.approved,
      startedAt: s.startedAt,
      endedAt: s.endedAt || null
    }));
  res.json({ sessions: list });
});

// ==================== WebSocket - signaling ====================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
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

  const device = devices.get(deviceId);
  if (!device || device.userId !== user.userId) {
    ws.close(4004, 'Qurilma topilmadi');
    return;
  }

  device.online = true;
  device.ws = ws;
  console.log(`[WS] Ulandi: ${device.name} (${device.role}) - ${deviceId}`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      // Agent tomon pairing so'rovini tasdiqlaydi/rad etadi
      case 'pairing-response': {
        const session = sessions.get(msg.sessionId);
        if (!session || session.agentDeviceId !== deviceId) return;
        session.approved = !!msg.approved;

        const controller = devices.get(session.controllerDeviceId);
        if (controller && controller.ws && controller.ws.readyState === 1) {
          controller.ws.send(JSON.stringify({
            type: 'pairing-result',
            sessionId: msg.sessionId,
            approved: session.approved
          }));
        }
        break;
      }

      // WebRTC signaling xabarlari: offer, answer, ice-candidate
      // Bularni to'g'ridan-to'g'ri qarama-qarshi tomonga "relay" qilamiz
      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        const session = sessions.get(msg.sessionId);
        if (!session || !session.approved) return; // tasdiqlanmagan sessiyada signaling yo'q

        const targetId = deviceId === session.agentDeviceId
          ? session.controllerDeviceId
          : session.agentDeviceId;
        const target = devices.get(targetId);
        if (target && target.ws && target.ws.readyState === 1) {
          target.ws.send(JSON.stringify({ ...msg, from: deviceId }));
        }
        break;
      }

      // Controller -> Agent: sichqoncha/teginish/klaviatura buyruqlari
      // (WebRTC DataChannel orqali ham yuborish mumkin, bu WS orqali zaxira yo'l)
      case 'input-command': {
        const session = sessions.get(msg.sessionId);
        if (!session || !session.approved || session.controllerDeviceId !== deviceId) return;
        const agent = devices.get(session.agentDeviceId);
        if (agent && agent.ws && agent.ws.readyState === 1) {
          agent.ws.send(JSON.stringify({ type: 'input-command', payload: msg.payload }));
        }
        break;
      }

      // Sessiyani tugatish (ikkala tomon ham chaqira oladi)
      case 'end-session': {
        const session = sessions.get(msg.sessionId);
        if (!session) return;
        session.endedAt = Date.now(); // tarixda saqlanib qoladi (sessionHistory bir xil obyektga ishora qiladi)
        const otherId = deviceId === session.agentDeviceId
          ? session.controllerDeviceId : session.agentDeviceId;
        const other = devices.get(otherId);
        if (other && other.ws && other.ws.readyState === 1) {
          other.ws.send(JSON.stringify({ type: 'session-ended', sessionId: msg.sessionId }));
        }
        sessions.delete(msg.sessionId);
        break;
      }
    }
  });

  ws.on('close', () => {
    device.online = false;
    device.ws = null;
    console.log(`[WS] Uzildi: ${device.name} - ${deviceId}`);
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server ${PORT}-portda ishlamoqda`);
});

module.exports = { app, server };
