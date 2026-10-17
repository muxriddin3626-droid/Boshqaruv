// Admin panel: statistika, foydalanuvchilar, Premium, kodlar va sozlamalar.
// Kirish: ADMIN_SECRET paroli bilan yoki akkaunt ID'si ADMIN_USER_IDS (yoki ADMIN_TELEGRAM_IDS) ro'yxatida bo'lsa.
// ID: Telegram — raqam, Google — "g:...", telefon — "p:998901234567".
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');
const settings = require('./settings');
const account = require('./account');

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_IDS = new Set(
  `${process.env.ADMIN_USER_IDS || ''},${process.env.ADMIN_TELEGRAM_IDS || ''}`
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
);
const DAY = 86400000;
const { sendJson, readJson, clientIp, tashkentDay, weekStart } = account;

// Parolni taxmin qilishga urinishlarni cheklaymiz: bir IP'dan daqiqasiga 5 ta.
const attempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > 5;
}

function secretOk(given) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(ADMIN_SECRET);
  return Boolean(ADMIN_SECRET) && a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function isAdmin(req) {
  if (auth.hasAdminCookie(req)) return true;
  const uid = auth.sessionUserId(req);
  return Boolean(uid && ADMIN_IDS.has(uid));
}

// Admin bo'lmasa 403 qaytaradi va false beradi.
async function guard(req, res) {
  if (await isAdmin(req)) return true;
  sendJson(res, 403, { error: 'Admin huquqi kerak.' });
  return false;
}

// ---------- Kirish ----------

async function handleLogin(req, res) {
  if (tooManyAttempts(clientIp(req))) {
    sendJson(res, 429, { error: "Juda ko'p urinish. Bir daqiqadan keyin qayta urinib ko'ring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  if (!secretOk(body.secret)) {
    sendJson(res, 401, { error: ADMIN_SECRET ? "Parol noto'g'ri." : "ADMIN_SECRET sozlanmagan." });
    return;
  }
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.adminCookie(req) });
}

async function handleLogout(req, res) {
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.clearAdminCookie(req) });
}

async function handleMe(req, res) {
  sendJson(res, 200, { admin: await isAdmin(req), passwordLogin: Boolean(ADMIN_SECRET), accountAdmins: ADMIN_IDS.size > 0 });
}

// ---------- Statistika ----------

// Toshkent vaqti bo'yicha kun boshi (ms).
function dayStartMs(t = Date.now()) {
  return Date.parse(`${tashkentDay(t)}T00:00:00+05:00`);
}

function countBy(values) {
  const out = {};
  for (const v of values) if (v) out[v] = (out[v] || 0) + 1;
  return Object.entries(out)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
}

async function handleStats(req, res) {
  if (!(await guard(req, res))) return;
  const now = Date.now();
  const counts = await db.adminCounts({ dayStart: dayStartMs(), weekStart: weekStart() });
  const usage = await db.usageOn(tashkentDay());

  // Oxirgi 14 kundagi ro'yxatdan o'tishlar.
  const since = dayStartMs(now - 13 * DAY);
  const times = await db.signupTimes(since);
  const signups = [];
  for (let i = 13; i >= 0; i--) {
    const day = tashkentDay(now - i * DAY);
    signups.push({ day, count: times.filter((t) => tashkentDay(t) === day).length });
  }

  // Anketa va tillar bo'yicha taqsimot (kirgan foydalanuvchilar ma'lumotidan).
  const states = await db.allStates();
  const profiles = [];
  const langs = { ru: 0, de: 0 };
  for (const { data } of states) {
    for (const lang of ['ru', 'de']) {
      const p = data[`tu-profile-${lang}`] && data[`tu-profile-${lang}`].v;
      if (p && p.done) {
        profiles.push(p);
        langs[lang]++;
      }
    }
  }

  sendJson(res, 200, {
    counts,
    usage,
    signups,
    survey: {
      total: profiles.length,
      langs,
      goal: countBy(profiles.map((p) => p.goal)),
      prof: countBy(profiles.map((p) => p.prof)),
      level: countBy(profiles.map((p) => p.level)),
      age: countBy(profiles.map((p) => p.age)),
      interests: countBy(profiles.flatMap((p) => p.interests || [])),
    },
    settings: settings.get(),
  });
}

// ---------- Foydalanuvchilar ----------

async function handleUsers(req, res) {
  if (!(await guard(req, res))) return;
  const url = new URL(req.url, 'http://x');
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 60);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset'), 10) || 0);
  const result = await db.listUsers({ q, offset, limit: 30, week: weekStart() });
  sendJson(res, 200, { ...result, offset });
}

// Bitta foydalanuvchi: anketa, statistika va natijalar xulosasi.
async function handleUser(req, res) {
  if (!(await guard(req, res))) return;
  const id = String(new URL(req.url, 'http://x').searchParams.get('id') || '');
  const user = await db.getUser(id);
  if (!user) {
    sendJson(res, 404, { error: 'Topilmadi.' });
    return;
  }
  const data = await db.getState(id);
  const v = (k) => data[k] && data[k].v;
  const langs = {};
  for (const lang of ['ru', 'de']) {
    const deck = v(`tu-deck-${lang}`) || {};
    const course = v(`tu-course-${lang}`) || {};
    langs[lang] = {
      profile: v(`tu-profile-${lang}`) || null,
      words: Object.keys(deck).length,
      learned: Object.values(deck).filter((c) => c && c.level >= 4).length,
      unitsPassed: Object.values(course).filter((u) => u && u.exam).length,
      lessons: (v(`tu-memory-${lang}`) || {}).lessons || 0,
      certs: Object.keys(v(`tu-certs-${lang}`) || {}),
    };
  }
  const xp = v('tu-xp') || { days: {} };
  const totalXp = Object.values(xp.days || {}).reduce((n, x) => n + (Number(x) || 0), 0);
  sendJson(res, 200, {
    user,
    stats: v('tu-stats') || {},
    totalXp,
    badges: Object.keys(v('tu-badges') || {}).length,
    langs,
  });
}

async function handlePremium(req, res) {
  if (!(await guard(req, res))) return;
  const body = await readJson(req, res);
  if (!body) return;
  const user = await db.getUser(String(body.userId || ''));
  if (!user) {
    sendJson(res, 404, { error: 'Foydalanuvchi topilmadi.' });
    return;
  }
  const days = parseInt(body.days, 10);
  if (body.remove) {
    await db.setPremiumUntil(user.id, 0);
  } else if (Number.isInteger(days) && days > 0 && days <= 3650) {
    await db.addPremiumDays(user.id, days);
  } else {
    sendJson(res, 400, { error: "Kun soni noto'g'ri." });
    return;
  }
  sendJson(res, 200, { ok: true, user: await db.getUser(user.id) });
}

// ---------- Kodlar ----------

async function handleCodes(req, res) {
  if (req.method === 'GET') {
    if (!(await guard(req, res))) return;
    sendJson(res, 200, { codes: await db.listCodes(200) });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  // Eski usul ham ishlaydi: so'rov ichida maxfiy parol (curl orqali).
  if (!(await isAdmin(req)) && !secretOk(body.secret)) {
    sendJson(res, 403, { error: "Ruxsat yo'q." });
    return;
  }
  const count = Math.min(Math.max(parseInt(body.count, 10) || 1, 1), 100);
  const days = Math.min(Math.max(parseInt(body.days, 10) || 30, 1), 3650);
  sendJson(res, 200, { codes: await db.createCodes(count, days), days });
}

// ---------- Sozlamalar ----------

async function handleSettings(req, res) {
  if (!(await guard(req, res))) return;
  if (req.method === 'GET') {
    sendJson(res, 200, { settings: settings.get(), defaults: settings.DEFAULTS });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  sendJson(res, 200, { settings: await settings.update(body.settings) });
}

// Telefon bilan kirgan foydalanuvchi parolini unutsa: admin yangi vaqtinchalik parol beradi.
async function handlePassword(req, res) {
  if (!(await guard(req, res))) return;
  const body = await readJson(req, res);
  if (!body) return;
  const user = await db.getUser(String(body.userId || ''));
  if (!user || !user.id.startsWith('p:')) {
    sendJson(res, 404, { error: 'Telefon bilan kirgan foydalanuvchi topilmadi.' });
    return;
  }
  const password = String(crypto.randomInt(10000000, 100000000));
  await db.setPassword(user.id, auth.hashPassword(password));
  sendJson(res, 200, { ok: true, password });
}

const GET_ROUTES = {
  '/api/admin/me': handleMe,
  '/api/admin/stats': handleStats,
  '/api/admin/users': handleUsers,
  '/api/admin/user': handleUser,
  '/api/admin/codes': handleCodes,
  '/api/admin/settings': handleSettings,
};

const POST_ROUTES = {
  '/api/admin/login': handleLogin,
  '/api/admin/logout': handleLogout,
  '/api/admin/premium': handlePremium,
  '/api/admin/password': handlePassword,
  '/api/admin/codes': handleCodes,
  '/api/admin/settings': handleSettings,
};

module.exports = { GET_ROUTES, POST_ROUTES };
