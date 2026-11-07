// Ma'lumotlar bazasi: foydalanuvchilar, ularning o'rganish ma'lumotlari, kunlik limitlar,
// obunalar va do'stlar. Lokal faylga (test uchun) yoki Turso'ga ulanadi.
const path = require('path');
const { createClient } = require('@libsql/client');

const url =
  process.env.TURSO_DATABASE_URL || `file:${process.env.DB_PATH || path.join(__dirname, '..', 'til-sayt.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

const ready = (async () => {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        photo_url TEXT NOT NULL DEFAULT '',
        ref_code TEXT NOT NULL UNIQUE,
        referred_by TEXT,
        premium_until INTEGER NOT NULL DEFAULT 0,
        show_in_rating INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS user_state (
        user_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS weekly_xp (
        user_id TEXT NOT NULL,
        week TEXT NOT NULL,
        xp INTEGER NOT NULL,
        PRIMARY KEY (user_id, week)
      )`,
      `CREATE TABLE IF NOT EXISTS usage (
        subject TEXT NOT NULL,
        day TEXT NOT NULL,
        kind TEXT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (subject, day, kind)
      )`,
      `CREATE TABLE IF NOT EXISTS codes (
        code TEXT PRIMARY KEY,
        days INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        used_by TEXT,
        used_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS friends (
        a TEXT NOT NULL,
        b TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (a, b)
      )`,
      `CREATE TABLE IF NOT EXISTS push_subs (
        endpoint TEXT PRIMARY KEY,
        sub TEXT NOT NULL,
        user_id TEXT,
        lang TEXT NOT NULL,
        time TEXT NOT NULL,
        tz INTEGER NOT NULL,
        active_day TEXT NOT NULL DEFAULT '',
        sent_day TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        plan TEXT NOT NULL,
        months INTEGER NOT NULL,
        days INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        file_mime TEXT NOT NULL,
        file_data TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        decided_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS passwords (
        user_id TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ],
    'write'
  );
  // Eski bazalarga yangi ustunlar (bor bo'lsa — xato e'tiborsiz qoldiriladi).
  for (const sql of [
    "ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'standard'",
  ]) {
    await client.execute(sql).catch(() => {});
  }
})();

const DAY = 24 * 60 * 60 * 1000;

function randomCode(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const rowToUser = (r) =>
  r && {
    id: String(r.id),
    firstName: String(r.first_name),
    lastName: String(r.last_name),
    photoUrl: String(r.photo_url),
    refCode: String(r.ref_code),
    referredBy: r.referred_by == null ? null : String(r.referred_by),
    premiumUntil: Number(r.premium_until),
    plan: r.plan == null ? 'standard' : String(r.plan),
    showInRating: Number(r.show_in_rating) === 1,
  };

async function getUser(id) {
  const r = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return rowToUser(r.rows[0]);
}

async function getUserByRef(code) {
  const r = await client.execute({ sql: 'SELECT * FROM users WHERE ref_code = ?', args: [code] });
  return rowToUser(r.rows[0]);
}

// Foydalanuvchini yaratadi yoki ismini yangilaydi. Yangi bo'lsa { user, created: true }.
async function upsertUser({ id, firstName, lastName, photoUrl }) {
  const existing = await getUser(id);
  if (existing) {
    await client.execute({
      sql: 'UPDATE users SET first_name = ?, last_name = ?, photo_url = ? WHERE id = ?',
      args: [firstName, lastName, photoUrl, id],
    });
    return { user: await getUser(id), created: false };
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await client.execute({
        sql: 'INSERT INTO users (id, first_name, last_name, photo_url, ref_code, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, firstName, lastName, photoUrl, randomCode(6), Date.now()],
      });
      return { user: await getUser(id), created: true };
    } catch (err) {
      if (!String(err.message).includes('UNIQUE')) throw err;
    }
  }
  throw new Error("Foydalanuvchini yaratib bo'lmadi");
}

// Obuna kunlarini qo'shadi. plan berilsa — tarif ham shunga o'zgaradi (berilmasa, avvalgisi qoladi).
async function addPremiumDays(userId, days, plan) {
  const user = await getUser(userId);
  if (!user) return null;
  const from = Math.max(Date.now(), user.premiumUntil);
  const until = from + days * DAY;
  await client.execute({
    sql: 'UPDATE users SET premium_until = ?, plan = ? WHERE id = ?',
    args: [until, plan || user.plan || 'standard', userId],
  });
  return until;
}

async function setShowInRating(userId, show) {
  await client.execute({ sql: 'UPDATE users SET show_in_rating = ? WHERE id = ?', args: [show ? 1 : 0, userId] });
}

// ---------- O'rganish ma'lumotlari (kalit bo'yicha: { key: { v, t } }) ----------

async function getState(userId) {
  const r = await client.execute({ sql: 'SELECT data FROM user_state WHERE user_id = ?', args: [userId] });
  if (!r.rows[0]) return {};
  try {
    return JSON.parse(String(r.rows[0].data));
  } catch {
    return {};
  }
}

// Kelgan ma'lumotni saqlanganiga qo'shadi: har kalit uchun eng yangisi qoladi.
async function mergeState(userId, incoming) {
  const current = await getState(userId);
  for (const [key, entry] of Object.entries(incoming)) {
    if (!entry || typeof entry.t !== 'number') continue;
    if (!current[key] || entry.t > current[key].t) current[key] = { v: entry.v, t: entry.t };
  }
  await client.execute({
    sql: `INSERT INTO user_state (user_id, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: [userId, JSON.stringify(current), Date.now()],
  });
  return current;
}

async function setWeeklyXp(userId, week, xp) {
  await client.execute({
    sql: `INSERT INTO weekly_xp (user_id, week, xp) VALUES (?, ?, ?)
          ON CONFLICT(user_id, week) DO UPDATE SET xp = excluded.xp`,
    args: [userId, week, xp],
  });
}

async function leaderboard(week, userIds) {
  const filter = userIds ? `AND w.user_id IN (${userIds.map(() => '?').join(',')})` : 'AND u.show_in_rating = 1';
  const r = await client.execute({
    sql: `SELECT u.id, u.first_name, u.last_name, u.photo_url, w.xp
          FROM weekly_xp w JOIN users u ON u.id = w.user_id
          WHERE w.week = ? AND w.xp > 0 ${filter}
          ORDER BY w.xp DESC LIMIT 50`,
    args: [week, ...(userIds || [])],
  });
  return r.rows.map((x) => ({
    id: String(x.id),
    firstName: String(x.first_name),
    lastName: String(x.last_name),
    photoUrl: String(x.photo_url),
    xp: Number(x.xp),
  }));
}

// ---------- Do'stlar ----------

async function addFriends(a, b) {
  if (a === b) return;
  const now = Date.now();
  await client.batch(
    [
      { sql: 'INSERT OR IGNORE INTO friends (a, b, created_at) VALUES (?, ?, ?)', args: [a, b, now] },
      { sql: 'INSERT OR IGNORE INTO friends (a, b, created_at) VALUES (?, ?, ?)', args: [b, a, now] },
    ],
    'write'
  );
}

async function friendIds(userId) {
  const r = await client.execute({ sql: 'SELECT b FROM friends WHERE a = ?', args: [userId] });
  return r.rows.map((x) => String(x.b));
}

async function setReferredBy(userId, refUserId) {
  await client.execute({
    sql: 'UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL',
    args: [refUserId, userId],
  });
}

// ---------- Kunlik limitlar ----------

async function getUsage(subject, day) {
  const r = await client.execute({ sql: 'SELECT kind, count FROM usage WHERE subject = ? AND day = ?', args: [subject, day] });
  const out = {};
  for (const x of r.rows) out[String(x.kind)] = Number(x.count);
  return out;
}

async function incrementUsage(subject, day, kind, n = 1) {
  await client.execute({
    sql: `INSERT INTO usage (subject, day, kind, count) VALUES (?, ?, ?, ?)
          ON CONFLICT(subject, day, kind) DO UPDATE SET count = count + excluded.count`,
    args: [subject, day, kind, n],
  });
}

async function cleanupUsage(beforeDay) {
  await client.execute({ sql: 'DELETE FROM usage WHERE day < ?', args: [beforeDay] });
}

// ---------- Sozlamalar (admin panelidan o'zgartiriladi) ----------

async function getSettings() {
  const r = await client.execute('SELECT key, value FROM settings');
  const out = {};
  for (const x of r.rows) {
    try {
      out[String(x.key)] = JSON.parse(String(x.value));
    } catch {}
  }
  return out;
}

async function setSettings(patch) {
  await client.batch(
    Object.entries(patch).map(([key, value]) =>
      value === null
        ? { sql: 'DELETE FROM settings WHERE key = ?', args: [key] }
        : {
            sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            args: [key, JSON.stringify(value)],
          }
    ),
    'write'
  );
}

// ---------- Admin: statistika va foydalanuvchilar ----------

const num = (r) => Number(r.rows[0] && Object.values(r.rows[0])[0]) || 0;

async function adminCounts({ dayStart, weekStart }) {
  const now = Date.now();
  const q = (sql, args = []) => client.execute({ sql, args }).then(num);
  return {
    users: await q('SELECT COUNT(*) FROM users'),
    newToday: await q('SELECT COUNT(*) FROM users WHERE created_at >= ?', [dayStart]),
    new7d: await q('SELECT COUNT(*) FROM users WHERE created_at >= ?', [now - 7 * DAY]),
    activeToday: await q('SELECT COUNT(*) FROM user_state WHERE updated_at >= ?', [dayStart]),
    active7d: await q('SELECT COUNT(*) FROM user_state WHERE updated_at >= ?', [now - 7 * DAY]),
    premium: await q('SELECT COUNT(*) FROM users WHERE premium_until > ?', [now]),
    referred: await q('SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL'),
    weekXp: await q('SELECT COALESCE(SUM(xp), 0) FROM weekly_xp WHERE week = ?', [weekStart]),
    // Kirish usullari: id "g:" — Google, "p:" — telefon, qolganlari — Telegram.
    google: await q("SELECT COUNT(*) FROM users WHERE id LIKE 'g:%'"),
    phone: await q("SELECT COUNT(*) FROM users WHERE id LIKE 'p:%'"),
  };
}

async function usageOn(day) {
  const r = await client.execute({
    sql: `SELECT kind, SUM(count) AS n, COUNT(DISTINCT subject) AS people,
                 SUM(CASE WHEN subject LIKE 'ip:%' THEN 1 ELSE 0 END) AS guests
          FROM usage WHERE day = ? GROUP BY kind`,
    args: [day],
  });
  const out = {};
  for (const x of r.rows) out[String(x.kind)] = { count: Number(x.n), people: Number(x.people), guests: Number(x.guests) };
  return out;
}

async function signupTimes(since) {
  const r = await client.execute({ sql: 'SELECT created_at FROM users WHERE created_at >= ?', args: [since] });
  return r.rows.map((x) => Number(x.created_at));
}

// Barcha foydalanuvchilarning saqlangan ma'lumotlari (anketa statistikasi uchun).
async function allStates(limit = 5000) {
  const r = await client.execute({ sql: 'SELECT user_id, data FROM user_state LIMIT ?', args: [limit] });
  return r.rows.map((x) => {
    try {
      return { userId: String(x.user_id), data: JSON.parse(String(x.data)) };
    } catch {
      return { userId: String(x.user_id), data: {} };
    }
  });
}

async function listUsers({ q = '', offset = 0, limit = 30, week }) {
  const like = `%${q}%`;
  const r = await client.execute({
    sql: `SELECT u.*, s.updated_at AS active_at, COALESCE(w.xp, 0) AS week_xp,
                 (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id) AS invited
          FROM users u
          LEFT JOIN user_state s ON s.user_id = u.id
          LEFT JOIN weekly_xp w ON w.user_id = u.id AND w.week = ?
          WHERE (? = '' OR u.id LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.ref_code LIKE ?)
          ORDER BY u.created_at DESC
          LIMIT ? OFFSET ?`,
    args: [week, q, like, like, like, like, limit, offset],
  });
  const total = await client.execute({
    sql: `SELECT COUNT(*) FROM users u WHERE (? = '' OR u.id LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.ref_code LIKE ?)`,
    args: [q, like, like, like, like],
  });
  return {
    total: num(total),
    users: r.rows.map((x) => ({
      ...rowToUser(x),
      createdAt: Number(x.created_at),
      activeAt: x.active_at == null ? null : Number(x.active_at),
      weekXp: Number(x.week_xp),
      invited: Number(x.invited),
    })),
  };
}

async function setPremiumUntil(userId, until) {
  await client.execute({ sql: 'UPDATE users SET premium_until = ? WHERE id = ?', args: [until, userId] });
}

// ---------- Telefon raqam bilan kirish: parollar ----------

async function getPassword(userId) {
  const r = await client.execute({ sql: 'SELECT hash FROM passwords WHERE user_id = ?', args: [userId] });
  return r.rows[0] ? String(r.rows[0].hash) : null;
}

async function setPassword(userId, hash) {
  await client.execute({
    sql: `INSERT INTO passwords (user_id, hash, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET hash = excluded.hash, updated_at = excluded.updated_at`,
    args: [userId, hash, Date.now()],
  });
}

// ---------- Bildirishnoma obunalari ----------

const rowToPush = (x) =>
  x && {
    endpoint: String(x.endpoint),
    sub: JSON.parse(String(x.sub)),
    userId: x.user_id == null ? null : String(x.user_id),
    lang: String(x.lang),
    time: String(x.time),
    tz: Number(x.tz),
    activeDay: String(x.active_day),
    sentDay: String(x.sent_day),
  };

async function savePushSub({ endpoint, sub, userId, lang, time, tz, activeDay }) {
  await client.execute({
    sql: `INSERT INTO push_subs (endpoint, sub, user_id, lang, time, tz, active_day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET sub = excluded.sub, user_id = COALESCE(excluded.user_id, push_subs.user_id),
            lang = excluded.lang, time = excluded.time, tz = excluded.tz, active_day = excluded.active_day`,
    args: [endpoint, JSON.stringify(sub), userId || null, lang, time, tz, activeDay || '', Date.now()],
  });
}

async function getPushSub(endpoint) {
  const r = await client.execute({ sql: 'SELECT * FROM push_subs WHERE endpoint = ?', args: [endpoint] });
  return rowToPush(r.rows[0]);
}

async function listPushSubs(limit = 20000) {
  const r = await client.execute({ sql: 'SELECT * FROM push_subs LIMIT ?', args: [limit] });
  return r.rows.map(rowToPush);
}

async function updatePushSub(endpoint, { activeDay, sentDay }) {
  if (activeDay != null) await client.execute({ sql: 'UPDATE push_subs SET active_day = ? WHERE endpoint = ?', args: [activeDay, endpoint] });
  if (sentDay != null) await client.execute({ sql: 'UPDATE push_subs SET sent_day = ? WHERE endpoint = ?', args: [sentDay, endpoint] });
}

async function deletePushSub(endpoint) {
  await client.execute({ sql: 'DELETE FROM push_subs WHERE endpoint = ?', args: [endpoint] });
}

async function countPushSubs() {
  const r = await client.execute('SELECT COUNT(*) AS n FROM push_subs');
  return Number(r.rows[0].n);
}

// ---------- To'lovlar (karta orqali o'tkazma va chek) ----------

const rowToPayment = (x) =>
  x && {
    id: Number(x.id),
    userId: String(x.user_id),
    plan: String(x.plan),
    months: Number(x.months),
    days: Number(x.days),
    amount: Number(x.amount),
    status: String(x.status),
    fileMime: String(x.file_mime),
    note: String(x.note || ''),
    createdAt: Number(x.created_at),
    decidedAt: x.decided_at == null ? null : Number(x.decided_at),
    userName: x.first_name == null ? '' : [x.first_name, x.last_name].filter(Boolean).join(' '),
  };

async function createPayment({ userId, plan, months, days, amount, fileMime, fileData }) {
  const r = await client.execute({
    sql: `INSERT INTO payments (user_id, plan, months, days, amount, file_mime, file_data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [userId, plan, months, days, amount, fileMime, fileData, Date.now()],
  });
  return Number(r.rows[0].id);
}

// Ro'yxat (chek faylisiz). status yoki userId bo'yicha.
async function listPayments({ status = '', userId = '', limit = 100 } = {}) {
  const r = await client.execute({
    sql: `SELECT p.id, p.user_id, p.plan, p.months, p.days, p.amount, p.status, p.file_mime, p.note, p.created_at, p.decided_at,
                 u.first_name, u.last_name
          FROM payments p LEFT JOIN users u ON u.id = p.user_id
          WHERE (? = '' OR p.status = ?) AND (? = '' OR p.user_id = ?)
          ORDER BY p.created_at DESC LIMIT ?`,
    args: [status, status, userId, userId, limit],
  });
  return r.rows.map(rowToPayment);
}

async function getPaymentFile(id) {
  const r = await client.execute({ sql: 'SELECT file_mime, file_data FROM payments WHERE id = ?', args: [id] });
  const x = r.rows[0];
  return x ? { mime: String(x.file_mime), data: Buffer.from(String(x.file_data), 'base64') } : null;
}

async function getPayment(id) {
  const r = await client.execute({
    sql: `SELECT p.id, p.user_id, p.plan, p.months, p.days, p.amount, p.status, p.file_mime, p.note, p.created_at, p.decided_at,
                 u.first_name, u.last_name FROM payments p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    args: [id],
  });
  return rowToPayment(r.rows[0]);
}

// Faqat kutilayotgan to'lovni o'zgartiradi (ikki marta tasdiqlanmasligi uchun).
async function decidePayment(id, status, note = '') {
  const r = await client.execute({
    sql: "UPDATE payments SET status = ?, note = ?, decided_at = ? WHERE id = ? AND status = 'pending' RETURNING id",
    args: [status, note, Date.now(), id],
  });
  return r.rows.length > 0;
}

async function countPayments(status, userId = '') {
  const r = await client.execute({
    sql: "SELECT COUNT(*) AS n FROM payments WHERE status = ? AND (? = '' OR user_id = ?)",
    args: [status, userId, userId],
  });
  return Number(r.rows[0].n);
}

async function countPaymentsSince(userId, since) {
  const r = await client.execute({ sql: 'SELECT COUNT(*) AS n FROM payments WHERE user_id = ? AND created_at >= ?', args: [userId, since] });
  return Number(r.rows[0].n);
}

module.exports = {
  createPayment,
  listPayments,
  getPaymentFile,
  getPayment,
  decidePayment,
  countPayments,
  countPaymentsSince,
  savePushSub,
  getPushSub,
  listPushSubs,
  updatePushSub,
  deletePushSub,
  countPushSubs,
  getPassword,
  setPassword,
  getSettings,
  setSettings,
  adminCounts,
  usageOn,
  signupTimes,
  allStates,
  listUsers,
  setPremiumUntil,
  ready,
  getUser,
  getUserByRef,
  upsertUser,
  addPremiumDays,
  setShowInRating,
  getState,
  mergeState,
  setWeeklyXp,
  leaderboard,
  addFriends,
  friendIds,
  setReferredBy,
  getUsage,
  incrementUsage,
  cleanupUsage,
};
