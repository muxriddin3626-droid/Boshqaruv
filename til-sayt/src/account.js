// Akkaunt: Telegram orqali kirish, ma'lumotlarni sinxronlash, kunlik limitlar,
// Premium kodlari, do'stlar va haftalik reyting.
const db = require('./db');
const auth = require('./auth');

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

async function handleTelegramLogin(req, res) {
  const body = await readJson(req, res);
  if (!body) return;
  const tg = auth.verifyTelegram(body.user);
  if (!tg) {
    sendJson(res, 401, { error: "Telegram ma'lumoti tasdiqlanmadi. Qaytadan urinib ko'ring." });
    return;
  }
  const { user, created } = await db.upsertUser(tg);
  let bonus = 0;
  // Taklif havolasi orqali kelgan yangi foydalanuvchi: ikkalasi do'st bo'ladi va bonus oladi.
  if (created && typeof body.ref === 'string') {
    const inviter = await db.getUserByRef(body.ref.trim().toUpperCase());
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
    sendJson(res, 401, { error: 'Kodni ishlatish uchun avval Telegram orqali kiring.' });
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
