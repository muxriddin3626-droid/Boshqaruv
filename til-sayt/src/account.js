// Akkaunt: Telegram, Google yoki telefon raqam orqali kirish, ma'lumotlarni sinxronlash, kunlik limitlar,
// Premium kodlari, do'stlar va haftalik reyting.
const db = require('./db');
const crypto = require('crypto');
const auth = require('./auth');
const sms = require('./sms');

const settings = require('./settings');

const MAX_STATE_BYTES = 2 * 1024 * 1024;

// Kun Toshkent vaqti (UTC+5) bo'yicha hisoblanadi.
const tashkentDay = (t = Date.now()) => new Date(t + 5 * 3600 * 1000).toISOString().slice(0, 10);

// Haftaning dushanbasi (YYYY-MM-DD) — haftalik reyting kaliti.
function weekStart(t = Date.now()) {
  const d = new Date(t + 5 * 3600 * 1000);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req, res, max = 64 * 1024) {
  try {
    return JSON.parse(await readBody(req, max));
  } catch {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return null;
  }
}

const isPremium = (user) => Boolean(user && user.premiumUntil > Date.now());

async function currentUser(req) {
  const uid = auth.sessionUserId(req);
  return uid ? db.getUser(uid) : null;
}

// ---------- Kunlik limitlar ----------

// Limitni tekshiradi. { ok, commit } qaytaradi: commit() — muvaffaqiyatli so'rovdan keyin
// hisobga yozish (xatolikda foydalanuvchi limitini yo'qotmaydi).
async function quota(req, kind) {
  const user = await currentUser(req);
  const FREE = settings.freeLimits();
  if (!settings.get().limitsOn || isPremium(user)) return { ok: true, commit: async () => {} };
  const subject = user ? `u:${user.id}` : `ip:${clientIp(req)}`;
  const day = tashkentDay();
  const used = (await db.getUsage(subject, day))[kind] || 0;
  if (used >= FREE[kind]) return { ok: false, limit: FREE[kind], loggedIn: Boolean(user) };
  return { ok: true, commit: () => db.incrementUsage(subject, day, kind).catch(() => {}) };
}

function sendLimit(res, q) {
  const what = { lesson: 'ovozli dars', practice: "o'yin va hikoya", exam: "imtihon bo'limi" };
  sendJson(res, 402, {
    limit: true,
    loggedIn: q.loggedIn,
    error: `Bugungi bepul limit tugadi. Premium bilan cheksiz mashq qiling yoki ertaga davom eting!`,
    what,
  });
}

// Eski limit yozuvlarini tozalab turamiz.
setInterval(() => db.cleanupUsage(tashkentDay(Date.now() - 3 * 86400000)).catch(() => {}), 6 * 3600 * 1000).unref();

// ---------- Foydalanuvchi ma'lumoti ----------

function publicUser(user) {
  return {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    firstName: user.firstName,
    photoUrl: user.photoUrl,
    refCode: user.refCode,
    premiumUntil: user.premiumUntil,
    showInRating: user.showInRating,
  };
}

async function usageFor(req, user) {
  const subject = user ? `u:${user.id}` : `ip:${clientIp(req)}`;
  return db.getUsage(subject, tashkentDay());
}

function config() {
  return {
    telegramBot: auth.enabled ? auth.BOT_USERNAME : null,
    googleClientId: auth.GOOGLE_CLIENT_ID || null,
    phoneLogin: sms.enabled,
    phoneUzOnly: sms.onlyUzbek,
    limits: settings.get().limitsOn ? settings.freeLimits() : null,
    premiumContact: settings.get().premiumContact,
    premiumPrice: settings.get().premiumPrice,
    refBonusDays: settings.get().refBonusDays,
    announcement: settings.get().announcement,
  };
}

async function handleMe(req, res) {
  const user = await currentUser(req);
  sendJson(res, 200, {
    user: user ? publicUser(user) : null,
    premium: isPremium(user),
    usage: await usageFor(req, user),
    limits: settings.get().limitsOn ? settings.freeLimits() : null,
  });
}

// Kirish usulidan qat'i nazar umumiy qism: foydalanuvchini yaratish, taklif bonusi va sessiya.
// keepExisting — mavjud foydalanuvchining ismini o'zgartirmaslik (telefon orqali kirganda).
async function finishLogin(req, res, profile, ref, { keepExisting = false } = {}) {
  const existing = keepExisting && (await db.getUser(profile.id));
  const { user, created } = existing ? { user: existing, created: false } : await db.upsertUser(profile);
  let bonus = 0;
  // Taklif havolasi orqali kelgan yangi foydalanuvchi: ikkalasi do'st bo'ladi va bonus oladi.
  if (created && typeof ref === 'string') {
    const inviter = await db.getUserByRef(ref.trim().toUpperCase());
    if (inviter && inviter.id !== user.id) {
      await db.setReferredBy(user.id, inviter.id);
      await db.addFriends(user.id, inviter.id);
      const refDays = settings.get().refBonusDays;
      if (refDays > 0) {
        await db.addPremiumDays(user.id, refDays);
        await db.addPremiumDays(inviter.id, refDays);
        bonus = refDays;
      }
    }
  }
  const fresh = await db.getUser(user.id);
  sendJson(res, 200, { user: publicUser(fresh), premium: isPremium(fresh), created, bonus }, { 'Set-Cookie': auth.sessionCookie(req, user.id) });
}

async function handleTelegramLogin(req, res) {
  const body = await readJson(req, res);
  if (!body) return;
  const tg = auth.verifyTelegram(body.user);
  if (!tg) {
    sendJson(res, 401, { error: "Telegram ma'lumoti tasdiqlanmadi. Qaytadan urinib ko'ring." });
    return;
  }
  await finishLogin(req, res, tg, body.ref);
}

async function handleGoogleLogin(req, res) {
  const body = await readJson(req, res);
  if (!body) return;
  let profile = null;
  try {
    profile = await auth.verifyGoogle(body.credential);
  } catch (err) {
    console.error('Google:', err.message);
  }
  if (!profile) {
    sendJson(res, 401, { error: "Google ma'lumoti tasdiqlanmadi. Qaytadan urinib ko'ring." });
    return;
  }
  await finishLogin(req, res, profile, body.ref);
}

// ---------- Telefon raqam orqali kirish (SMS kod) ----------

const CODE_MINUTES = 5;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const SMS_PER_PHONE = 5; // kuniga bitta raqamga
const SMS_PER_IP = 10; // kuniga bitta IP'dan

// Raqamni faqat raqamlarga keltiramiz: "90 123-45-67" → 998901234567.
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 9) digits = `998${digits}`;
  if (!/^\d{10,15}$/.test(digits)) return null;
  if (sms.onlyUzbek && !/^998\d{9}$/.test(digits)) return null;
  return digits;
}

async function handlePhoneStart(req, res) {
  if (!sms.enabled) {
    sendJson(res, 404, { error: 'Telefon orqali kirish sozlanmagan.' });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const phone = normalizePhone(body.phone);
  if (!phone) {
    sendJson(res, 400, { error: sms.onlyUzbek ? "Raqamni to'g'ri kiriting: +998 90 123 45 67" : "Raqamni mamlakat kodi bilan to'g'ri kiriting." });
    return;
  }
  const last = await db.getPhoneCode(phone);
  const wait = last ? Math.ceil((last.sentAt + RESEND_SECONDS * 1000 - Date.now()) / 1000) : 0;
  if (wait > 0) {
    sendJson(res, 429, { error: `Kodni qayta yuborish uchun ${wait} soniya kuting.`, wait });
    return;
  }
  const day = tashkentDay();
  const byPhone = (await db.getUsage(`sms:${phone}`, day)).sms || 0;
  const byIp = (await db.getUsage(`smsip:${clientIp(req)}`, day)).sms || 0;
  if (byPhone >= SMS_PER_PHONE || byIp >= SMS_PER_IP) {
    sendJson(res, 429, { error: "Bugun juda ko'p kod so'raldi. Ertaga urinib ko'ring yoki boshqa usulda kiring." });
    return;
  }
  const code = String(crypto.randomInt(100000, 1000000));
  await db.savePhoneCode(phone, auth.hashCode(phone, code), Date.now() + CODE_MINUTES * 60000);
  try {
    await sms.sendCode(phone, code);
  } catch (err) {
    console.error('SMS:', err.message);
    await db.deletePhoneCode(phone);
    sendJson(res, 502, { error: "SMS yuborib bo'lmadi. Birozdan keyin qayta urinib ko'ring." });
    return;
  }
  await db.incrementUsage(`sms:${phone}`, day, 'sms');
  await db.incrementUsage(`smsip:${clientIp(req)}`, day, 'sms');
  sendJson(res, 200, { sent: true, phone, resendIn: RESEND_SECONDS, minutes: CODE_MINUTES });
}

async function handlePhoneVerify(req, res) {
  if (!sms.enabled) {
    sendJson(res, 404, { error: 'Telefon orqali kirish sozlanmagan.' });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const phone = normalizePhone(body.phone);
  const code = String(body.code || '').replace(/\D/g, '');
  const row = phone && (await db.getPhoneCode(phone));
  if (!row || row.expiresAt < Date.now()) {
    sendJson(res, 400, { error: 'Kod eskirgan. Yangi kod so\'rang.', expired: true });
    return;
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    sendJson(res, 429, { error: "Urinishlar ko'p bo'ldi. Yangi kod so'rang.", expired: true });
    return;
  }
  if (!auth.sameHash(row.hash, auth.hashCode(phone, code))) {
    await db.bumpPhoneAttempts(phone);
    sendJson(res, 401, { error: "Kod noto'g'ri. Qaytadan tekshiring." });
    return;
  }
  await db.deletePhoneCode(phone);
  const [first, ...rest] = String(body.name || '').trim().replace(/\s+/g, ' ').split(' ');
  const profile = {
    id: `p:${phone}`,
    firstName: (first || "O'quvchi").slice(0, 64),
    lastName: rest.join(' ').slice(0, 64),
    photoUrl: '',
  };
  await finishLogin(req, res, profile, body.ref, { keepExisting: true });
}

async function handleLogout(req, res) {
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookie(req) });
}

// ---------- Ma'lumotlarni sinxronlash ----------

// Haftalik XP: brauzerdagi kunlik XP yozuvlaridan shu hafta kunlarini yig'amiz.
function weeklyXpFrom(state) {
  const xp = state['tu-xp'] && state['tu-xp'].v;
  if (!xp || typeof xp.days !== 'object') return 0;
  const start = weekStart();
  let sum = 0;
  for (const [day, value] of Object.entries(xp.days)) {
    if (day >= start && Number.isFinite(value)) sum += Math.max(0, Math.min(5000, value));
  }
  return Math.round(sum);
}

async function handleState(req, res) {
  const user = await currentUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Avval kiring.' });
    return;
  }
  if (req.method === 'GET') {
    sendJson(res, 200, { data: await db.getState(user.id) });
    return;
  }
  const body = await readJson(req, res, MAX_STATE_BYTES);
  if (!body) return;
  const incoming = {};
  for (const [key, entry] of Object.entries(body.data || {})) {
    // Faqat ilova kalitlarini qabul qilamiz.
    if (/^(tu-|til-ustoz-settings$|til-ustoz-best-)/.test(key) && key.length < 80 && entry && typeof entry.t === 'number') {
      incoming[key] = { v: entry.v, t: Math.min(entry.t, Date.now() + 60000) };
    }
  }
  const merged = await db.mergeState(user.id, incoming);
  await db.setWeeklyXp(user.id, weekStart(), weeklyXpFrom(merged));
  sendJson(res, 200, { data: merged });
}

// ---------- Reyting va do'stlar ----------

function shortName(row) {
  const last = row.lastName ? ` ${row.lastName[0]}.` : '';
  return `${row.firstName || "O'quvchi"}${last}`;
}

async function handleLeaderboard(req, res) {
  const user = await currentUser(req);
  const week = weekStart();
  const global = await db.leaderboard(week);
  let friends = [];
  if (user) {
    const ids = [user.id, ...(await db.friendIds(user.id))];
    friends = await db.leaderboard(week, ids);
  }
  const map = (rows) => rows.map((r) => ({ name: shortName(r), photoUrl: r.photoUrl, xp: r.xp, me: Boolean(user && r.id === user.id) }));
  sendJson(res, 200, { week, global: map(global), friends: map(friends), loggedIn: Boolean(user) });
}

async function handleAddFriend(req, res) {
  const user = await currentUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Avval kiring.' });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const friend = typeof body.code === 'string' && (await db.getUserByRef(body.code.trim().toUpperCase()));
  if (!friend || friend.id === user.id) {
    sendJson(res, 404, { error: 'Bunday kod topilmadi.' });
    return;
  }
  await db.addFriends(user.id, friend.id);
  sendJson(res, 200, { ok: true, name: shortName(friend) });
}

async function handleRatingVisibility(req, res) {
  const user = await currentUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Avval kiring.' });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  await db.setShowInRating(user.id, Boolean(body.show));
  sendJson(res, 200, { ok: true });
}

// ---------- Premium ----------

async function handleRedeem(req, res) {
  const user = await currentUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Kodni ishlatish uchun avval akkauntga kiring.' });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const days = code && (await db.redeemCode(code, user.id));
  if (!days) {
    sendJson(res, 404, { error: "Kod noto'g'ri yoki allaqachon ishlatilgan." });
    return;
  }
  const until = await db.addPremiumDays(user.id, days);
  sendJson(res, 200, { ok: true, days, premiumUntil: until });
}

const GET_ROUTES = {
  '/api/me': handleMe,
  '/api/state': handleState,
  '/api/leaderboard': handleLeaderboard,
};

const POST_ROUTES = {
  '/api/auth/telegram': handleTelegramLogin,
  '/api/auth/google': handleGoogleLogin,
  '/api/auth/phone/start': handlePhoneStart,
  '/api/auth/phone/verify': handlePhoneVerify,
  '/api/auth/logout': handleLogout,
  '/api/state': handleState,
  '/api/friends/add': handleAddFriend,
  '/api/rating/visibility': handleRatingVisibility,
  '/api/premium/redeem': handleRedeem,
};

module.exports = {
  GET_ROUTES,
  POST_ROUTES,
  quota,
  sendLimit,
  config,
  ready: db.ready.then(() => settings.load()),
  currentUser,
  readJson,
  sendJson,
  clientIp,
  tashkentDay,
  weekStart,
  isPremium,
};
