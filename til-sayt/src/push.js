// Bildirishnomalar (Web Push): foydalanuvchi tanlagan vaqtda, agar o'sha kuni hali
// dars qilmagan bo'lsa, telefoniga eslatma yuboriladi. VAPID kalitlari .env dan yoki
// birinchi ishga tushganda yaratilib, bazada saqlanadi.
const webpush = require('web-push');
const db = require('./db');
const { sendJson, readJson, clientIp } = require('./account');

const TUTORS = { ru: 'Anna', de: 'Hans', ko: 'Minji' };
const MESSAGES = [
  (t) => `${t} kutyapti: bugungi dars hali bajarilmadi. 15 daqiqa — va streak saqlanadi! 🔥`,
  (t) => `Bugun hali mashq qilmadingiz. ${t} bilan 10 daqiqa gaplashamizmi? 🎙️`,
  (t) => `10 ta yangi so'z va bitta qisqa suhbat — bugungi reja tayyor. ${t} kutyapti! 📚`,
  (t) => `Har kuni ozgina — va til o'zi kelib qoladi. Bugungi darsni boshlaymizmi? ${t} 😊`,
];

let publicKey = '';

const ready = (async () => {
  await db.ready;
  let keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  if (!keys.publicKey || !keys.privateKey) {
    const saved = (await db.getSettings()).vapid;
    if (saved && saved.publicKey && saved.privateKey) keys = saved;
    else {
      keys = webpush.generateVAPIDKeys();
      await db.setSettings({ vapid: keys });
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@tilustoz.app', keys.publicKey, keys.privateKey);
  publicKey = keys.publicKey;
})().catch((err) => console.error('Push sozlanmadi:', err.message));

// Foydalanuvchining mahalliy vaqti: tz — UTC dan farq (daqiqa).
function local(tz) {
  const iso = new Date(Date.now() + tz * 60000).toISOString();
  return { day: iso.slice(0, 10), hhmm: iso.slice(11, 16) };
}

async function send(row, payload) {
  try {
    await webpush.sendNotification(row.sub, JSON.stringify(payload), { TTL: 6 * 3600 });
    return true;
  } catch (err) {
    // Obuna bekor qilingan yoki eskirgan.
    if (err.statusCode === 404 || err.statusCode === 410) await db.deletePushSub(row.endpoint);
    else console.error('Push xatosi:', err.statusCode || err.message);
    return false;
  }
}

function reminder(lang) {
  const t = TUTORS[lang] || 'Ustoz';
  return { title: 'Til Ustoz', body: MESSAGES[Math.floor(Math.random() * MESSAGES.length)](t), url: '/' };
}

// Har daqiqada: vaqti kelgan va bugun dars qilmaganlarga eslatma.
async function tick() {
  const rows = await db.listPushSubs();
  for (const row of rows) {
    const { day, hhmm } = local(row.tz);
    if (row.time !== hhmm || row.sentDay === day || row.activeDay === day) continue;
    await db.updatePushSub(row.endpoint, { sentDay: day });
    await send(row, reminder(row.lang));
  }
}

ready.then(() => setInterval(() => tick().catch((err) => console.error('Push:', err.message)), 60000).unref());

// ---------- So'rovlar ----------

const validTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const validEndpoint = (e) => typeof e === 'string' && /^https:\/\//.test(e) && e.length < 1000;

function cleanSub(s) {
  if (!s || !validEndpoint(s.endpoint) || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') return null;
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh.slice(0, 200), auth: s.keys.auth.slice(0, 100) } };
}

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 20;
}

async function handleKey(req, res) {
  await ready;
  sendJson(res, publicKey ? 200 : 503, { publicKey });
}

async function handleSubscribe(req, res) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: "So'rovlar juda ko'p." });
  const body = await readJson(req, res);
  if (!body) return;
  const sub = cleanSub(body.subscription);
  const tz = Number(body.tz);
  if (!sub || !validTime(body.time) || !Number.isInteger(tz) || Math.abs(tz) > 14 * 60) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const lang = ['ru', 'de', 'ko'].includes(body.lang) ? body.lang : 'ru';
  const uid = require('./auth').sessionUserId(req);
  await db.savePushSub({ endpoint: sub.endpoint, sub, userId: uid, lang, time: body.time, tz, activeDay: typeof body.activeDay === 'string' ? body.activeDay.slice(0, 10) : '' });
  sendJson(res, 200, { ok: true });
}

async function handleUnsubscribe(req, res) {
  const body = await readJson(req, res);
  if (!body) return;
  if (validEndpoint(body.endpoint)) await db.deletePushSub(body.endpoint);
  sendJson(res, 200, { ok: true });
}

// Brauzer bugun dars qilinganini bildiradi — bugun eslatma kerak emas.
async function handleActive(req, res) {
  const body = await readJson(req, res);
  if (!body) return;
  if (validEndpoint(body.endpoint) && /^\d{4}-\d{2}-\d{2}$/.test(String(body.day))) {
    await db.updatePushSub(body.endpoint, { activeDay: body.day });
  }
  sendJson(res, 200, { ok: true });
}

// Sinov: darhol bitta bildirishnoma.
async function handleTest(req, res) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: "So'rovlar juda ko'p." });
  const body = await readJson(req, res);
  if (!body) return;
  const row = validEndpoint(body.endpoint) && (await db.getPushSub(body.endpoint));
  if (!row) return sendJson(res, 404, { error: 'Obuna topilmadi.' });
  const ok = await send(row, { title: 'Til Ustoz', body: `✅ Bildirishnomalar ishlayapti! Har kuni ${row.time} da eslatamiz.`, url: '/' });
  sendJson(res, ok ? 200 : 502, ok ? { ok: true } : { error: "Bildirishnoma yuborilmadi." });
}

module.exports = {
  ready,
  tick,
  GET_ROUTES: { '/api/push/key': handleKey },
  POST_ROUTES: {
    '/api/push/subscribe': handleSubscribe,
    '/api/push/unsubscribe': handleUnsubscribe,
    '/api/push/active': handleActive,
    '/api/push/test': handleTest,
  },
};
