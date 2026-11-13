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
      `CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lang TEXT NOT NULL,
        topic TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'admin',
        source_url TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS kv_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS insights (
        lang TEXT NOT NULL,
        kind TEXT NOT NULL,
        text_key TEXT NOT NULL,
        text TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        last_at INTEGER NOT NULL,
        PRIMARY KEY (lang, kind, text_key)
      )`,
      `CREATE TABLE IF NOT EXISTS ai_usage (
        day TEXT NOT NULL,
        subject TEXT NOT NULL,
        kind TEXT NOT NULL,
        calls INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read INTEGER NOT NULL DEFAULT 0,
        cache_write INTEGER NOT NULL DEFAULT 0,
        searches INTEGER NOT NULL DEFAULT 0,
        cost_micros INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, subject, kind)
      )`,
      `CREATE TABLE IF NOT EXISTS content_pool (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        key TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS content_pool_key ON content_pool (kind, key)',
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
    'ALTER TABLE users ADD COLUMN trial_until INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE payments ADD COLUMN auto INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE payments ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE payments ADD COLUMN check_json TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE payments ADD COLUMN file_hash TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE payments ADD COLUMN txn_id TEXT NOT NULL DEFAULT ''",
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
    trialUntil: Number(r.trial_until || 0),
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

// Bepul sinov: yangi foydalanuvchiga bir marta beriladi (Standard tarif).
async function startTrial(userId, days) {
  const until = Date.now() + days * DAY;
  await client.execute({
    sql: "UPDATE users SET premium_until = ?, trial_until = ?, plan = 'standard' WHERE id = ? AND trial_until = 0 AND premium_until < ?",
    args: [until, until, userId, Date.now()],
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
    auto: Number(x.auto || 0) === 1,
    reviewed: Number(x.reviewed || 0) === 1,
    check: (() => {
      try {
        return x.check_json ? JSON.parse(String(x.check_json)) : null;
      } catch {
        return null;
      }
    })(),
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

const PAY_COLS = `p.id, p.user_id, p.plan, p.months, p.days, p.amount, p.status, p.file_mime, p.note, p.created_at, p.decided_at,
                 p.auto, p.reviewed, p.check_json, u.first_name, u.last_name`;

// Ro'yxat (chek faylisiz). status: pending / approved / rejected / review (avtomatik tasdiqlangan, ko'rilmagan).
async function listPayments({ status = '', userId = '', limit = 100 } = {}) {
  const review = status === 'review' ? 1 : 0;
  const st = review ? '' : status;
  const r = await client.execute({
    sql: `SELECT ${PAY_COLS}
          FROM payments p LEFT JOIN users u ON u.id = p.user_id
          WHERE (? = '' OR p.status = ?) AND (? = '' OR p.user_id = ?)
            AND (? = 0 OR (p.status = 'approved' AND p.auto = 1 AND p.reviewed = 0))
          ORDER BY p.created_at DESC LIMIT ?`,
    args: [st, st, userId, userId, review, limit],
  });
  return r.rows.map(rowToPayment);
}

async function setPaymentCheck(id, { check, fileHash, txnId }) {
  await client.execute({
    sql: 'UPDATE payments SET check_json = ?, file_hash = ?, txn_id = ? WHERE id = ?',
    args: [JSON.stringify(check || {}), fileHash || '', txnId || '', id],
  });
}

// Shu chek (fayl yoki tranzaksiya raqami) oldin ishlatilganmi — rad etilmaganlar orasida.
async function findDuplicatePayment(id, fileHash, txnId) {
  const r = await client.execute({
    sql: `SELECT id FROM payments WHERE id != ? AND status != 'rejected'
            AND ((? != '' AND file_hash = ?) OR (? != '' AND txn_id = ?)) LIMIT 1`,
    args: [id, fileHash || '', fileHash || '', txnId || '', txnId || ''],
  });
  return r.rows[0] ? Number(r.rows[0].id) : null;
}

async function autoApprovePayment(id) {
  const r = await client.execute({
    sql: "UPDATE payments SET status = 'approved', auto = 1, reviewed = 0, decided_at = ? WHERE id = ? AND status = 'pending' RETURNING id",
    args: [Date.now(), id],
  });
  return r.rows.length > 0;
}

async function markPaymentReviewed(id) {
  await client.execute({ sql: 'UPDATE payments SET reviewed = 1 WHERE id = ?', args: [id] });
}

// Avtomatik tasdiqlangan to'lovni admin bekor qiladi.
async function revokePayment(id, note) {
  const r = await client.execute({
    sql: "UPDATE payments SET status = 'rejected', note = ?, reviewed = 1, decided_at = ? WHERE id = ? AND status = 'approved' RETURNING id",
    args: [note, Date.now(), id],
  });
  return r.rows.length > 0;
}

async function removePremiumDays(userId, days) {
  await client.execute({
    sql: 'UPDATE users SET premium_until = MAX(0, premium_until - ?) WHERE id = ?',
    args: [days * DAY, userId],
  });
}

async function getPaymentFile(id) {
  const r = await client.execute({ sql: 'SELECT file_mime, file_data FROM payments WHERE id = ?', args: [id] });
  const x = r.rows[0];
  return x ? { mime: String(x.file_mime), data: Buffer.from(String(x.file_data), 'base64') } : null;
}

async function getPayment(id) {
  const r = await client.execute({
    sql: `SELECT ${PAY_COLS} FROM payments p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    args: [id],
  });
  return rowToPayment(r.rows[0]);
}

// Faqat kutilayotgan to'lovni o'zgartiradi (ikki marta tasdiqlanmasligi uchun).
async function decidePayment(id, status, note = '') {
  const r = await client.execute({
    sql: "UPDATE payments SET status = ?, note = ?, reviewed = 1, decided_at = ? WHERE id = ? AND status = 'pending' RETURNING id",
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

async function countPaymentsToReview() {
  const r = await client.execute("SELECT COUNT(*) AS n FROM payments WHERE status = 'approved' AND auto = 1 AND reviewed = 0");
  return Number(r.rows[0].n);
}

async function countPaymentsSince(userId, since) {
  const r = await client.execute({ sql: 'SELECT COUNT(*) AS n FROM payments WHERE user_id = ? AND created_at >= ?', args: [userId, since] });
  return Number(r.rows[0].n);
}

// ---------- Bilim bazasi (admin materiallari va internetdan yangilangan qoidalar) ----------

const rowToKnowledge = (x) => ({
  id: Number(x.id),
  lang: String(x.lang),
  topic: String(x.topic),
  title: String(x.title),
  body: String(x.body),
  source: String(x.source),
  sourceUrl: String(x.source_url),
  enabled: Number(x.enabled) === 1,
  updatedAt: Number(x.updated_at),
});

async function listKnowledge({ lang = '', enabledOnly = false } = {}) {
  const r = await client.execute({
    sql: `SELECT * FROM knowledge WHERE (? = '' OR lang = ? OR lang = 'all') AND (? = 0 OR enabled = 1)
          ORDER BY source = 'admin' DESC, updated_at DESC LIMIT 300`,
    args: [lang, lang, enabledOnly ? 1 : 0],
  });
  return r.rows.map(rowToKnowledge);
}

async function saveKnowledge({ id, lang, topic, title, body, source = 'admin', sourceUrl = '', enabled = true }) {
  if (id) {
    await client.execute({
      sql: 'UPDATE knowledge SET lang = ?, topic = ?, title = ?, body = ?, source_url = ?, enabled = ?, updated_at = ? WHERE id = ?',
      args: [lang, topic, title, body, sourceUrl, enabled ? 1 : 0, Date.now(), id],
    });
    return id;
  }
  const r = await client.execute({
    sql: `INSERT INTO knowledge (lang, topic, title, body, source, source_url, enabled, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [lang, topic, title, body, source, sourceUrl, enabled ? 1 : 0, Date.now()],
  });
  return Number(r.rows[0].id);
}

async function setKnowledgeEnabled(id, enabled) {
  await client.execute({ sql: 'UPDATE knowledge SET enabled = ? WHERE id = ?', args: [enabled ? 1 : 0, id] });
}

async function deleteKnowledge(id) {
  await client.execute({ sql: 'DELETE FROM knowledge WHERE id = ?', args: [id] });
}

// Internetdan yangilangan yozuvlar: shu til uchun eskilarini almashtiradi.
async function replaceAutoKnowledge(lang, items) {
  await client.batch(
    [
      { sql: "DELETE FROM knowledge WHERE lang = ? AND source = 'auto'", args: [lang] },
      ...items.map((it) => ({
        sql: `INSERT INTO knowledge (lang, topic, title, body, source, source_url, enabled, updated_at)
              VALUES (?, ?, ?, ?, 'auto', ?, 1, ?)`,
        args: [lang, it.topic, it.title, it.body, it.sourceUrl || '', Date.now()],
      })),
    ],
    'write'
  );
}

// ---------- Kesh (kunlik yangiliklar va h.k.) ----------

async function cacheGet(key) {
  const r = await client.execute({ sql: 'SELECT value, updated_at FROM kv_cache WHERE key = ?', args: [key] });
  const x = r.rows[0];
  if (!x) return null;
  try {
    return { value: JSON.parse(String(x.value)), updatedAt: Number(x.updated_at) };
  } catch {
    return null;
  }
}

async function cacheSet(key, value) {
  await client.execute({
    sql: `INSERT INTO kv_cache (key, value, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [key, JSON.stringify(value), Date.now()],
  });
}

async function cacheCleanup(prefix, keepAfter) {
  await client.execute({ sql: 'DELETE FROM kv_cache WHERE key LIKE ? AND updated_at < ?', args: [`${prefix}%`, keepAfter] });
}

// ---------- O'quvchilar qiynaladigan joylar (hamma darslardan) ----------

async function addInsights(lang, kind, texts) {
  const now = Date.now();
  const list = texts.map((t) => String(t).trim()).filter((t) => t.length >= 3 && t.length <= 120);
  if (!list.length) return;
  await client.batch(
    list.map((t) => ({
      sql: `INSERT INTO insights (lang, kind, text_key, text, count, last_at) VALUES (?, ?, ?, ?, 1, ?)
            ON CONFLICT(lang, kind, text_key) DO UPDATE SET count = count + 1, last_at = excluded.last_at, text = excluded.text`,
      args: [lang, kind, t.toLowerCase().replace(/\s+/g, ' '), t, now],
    })),
    'write'
  );
}

async function topInsights(lang, kind, limit = 10) {
  const r = await client.execute({
    sql: 'SELECT text, count, last_at FROM insights WHERE lang = ? AND kind = ? ORDER BY count DESC, last_at DESC LIMIT ?',
    args: [lang, kind, limit],
  });
  return r.rows.map((x) => ({ text: String(x.text), count: Number(x.count), lastAt: Number(x.last_at) }));
}

// ---------- Umumiy materiallar ombori ----------

async function poolList(kind, key) {
  const r = await client.execute({ sql: 'SELECT id, data FROM content_pool WHERE kind = ? AND key = ? ORDER BY id', args: [kind, key] });
  const out = [];
  for (const x of r.rows) {
    try {
      out.push({ id: Number(x.id), data: JSON.parse(String(x.data)) });
    } catch {}
  }
  return out;
}

async function poolAdd(kind, key, data) {
  const r = await client.execute({
    sql: 'INSERT INTO content_pool (kind, key, data, created_at) VALUES (?, ?, ?, ?) RETURNING id',
    args: [kind, key, JSON.stringify(data), Date.now()],
  });
  return Number(r.rows[0].id);
}

async function poolCounts() {
  const r = await client.execute('SELECT kind, COUNT(*) AS n FROM content_pool GROUP BY kind');
  return r.rows.map((x) => ({ kind: String(x.kind), count: Number(x.n) }));
}

// ---------- AI xarajati ----------

async function addAiUsage({ day, subject, kind, input, output, cacheRead, cacheWrite, searches, usd }) {
  await client.execute({
    sql: `INSERT INTO ai_usage (day, subject, kind, calls, input_tokens, output_tokens, cache_read, cache_write, searches, cost_micros)
          VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(day, subject, kind) DO UPDATE SET calls = calls + 1,
            input_tokens = input_tokens + excluded.input_tokens, output_tokens = output_tokens + excluded.output_tokens,
            cache_read = cache_read + excluded.cache_read, cache_write = cache_write + excluded.cache_write,
            searches = searches + excluded.searches, cost_micros = cost_micros + excluded.cost_micros`,
    args: [day, subject, kind, input, output, cacheRead, cacheWrite, searches, Math.round(usd * 1e6)],
  });
}

const usd = (micros) => Number(micros || 0) / 1e6;

async function aiDayTotal(day) {
  const r = await client.execute({ sql: 'SELECT COALESCE(SUM(cost_micros), 0) AS c FROM ai_usage WHERE day = ?', args: [day] });
  return usd(r.rows[0].c);
}

async function aiSubjectDay(subject, day) {
  const r = await client.execute({ sql: 'SELECT COALESCE(SUM(cost_micros), 0) AS c FROM ai_usage WHERE day = ? AND subject = ?', args: [day, subject] });
  return usd(r.rows[0].c);
}

async function aiByDay(sinceDay) {
  const r = await client.execute({
    sql: 'SELECT day, SUM(cost_micros) AS c, SUM(calls) AS n FROM ai_usage WHERE day >= ? GROUP BY day ORDER BY day',
    args: [sinceDay],
  });
  return r.rows.map((x) => ({ day: String(x.day), usd: usd(x.c), calls: Number(x.n) }));
}

async function aiByKind(sinceDay) {
  const r = await client.execute({
    sql: `SELECT kind, SUM(cost_micros) AS c, SUM(calls) AS n, SUM(searches) AS s FROM ai_usage WHERE day >= ?
          GROUP BY kind ORDER BY c DESC`,
    args: [sinceDay],
  });
  return r.rows.map((x) => ({ kind: String(x.kind), usd: usd(x.c), calls: Number(x.n), searches: Number(x.s) }));
}

async function aiTopSubjects(sinceDay, today, limit = 20) {
  const r = await client.execute({
    sql: `SELECT a.subject, SUM(a.cost_micros) AS c, SUM(CASE WHEN a.day = ? THEN a.cost_micros ELSE 0 END) AS t, SUM(a.calls) AS n,
                 u.first_name, u.last_name, u.premium_until, u.plan
          FROM ai_usage a LEFT JOIN users u ON a.subject = 'u:' || u.id
          WHERE a.day >= ? AND a.subject != 'system'
          GROUP BY a.subject ORDER BY c DESC LIMIT ?`,
    args: [today, sinceDay, limit],
  });
  return r.rows.map((x) => ({
    subject: String(x.subject),
    usd: usd(x.c),
    todayUsd: usd(x.t),
    calls: Number(x.n),
    name: x.first_name == null ? '' : [x.first_name, x.last_name].filter(Boolean).join(' '),
    premium: x.premium_until != null && Number(x.premium_until) > Date.now(),
    plan: x.plan == null ? null : String(x.plan),
  }));
}

async function aiSubjectSince(subject, sinceDay) {
  const r = await client.execute({
    sql: 'SELECT COALESCE(SUM(cost_micros), 0) AS c, COALESCE(SUM(calls), 0) AS n FROM ai_usage WHERE subject = ? AND day >= ?',
    args: [subject, sinceDay],
  });
  return { usd: usd(r.rows[0].c), calls: Number(r.rows[0].n) };
}

async function activeSubscriptions() {
  const r = await client.execute({ sql: 'SELECT plan, COUNT(*) AS n FROM users WHERE premium_until > ? AND premium_until > trial_until GROUP BY plan', args: [Date.now()] });
  return r.rows.map((x) => ({ plan: String(x.plan || 'standard'), count: Number(x.n) }));
}

module.exports = {
  poolList,
  poolAdd,
  poolCounts,
  addAiUsage,
  aiDayTotal,
  aiSubjectDay,
  aiByDay,
  aiByKind,
  aiTopSubjects,
  aiSubjectSince,
  activeSubscriptions,
  listKnowledge,
  saveKnowledge,
  setKnowledgeEnabled,
  deleteKnowledge,
  replaceAutoKnowledge,
  cacheGet,
  cacheSet,
  cacheCleanup,
  addInsights,
  topInsights,
  createPayment,
  listPayments,
  getPaymentFile,
  getPayment,
  decidePayment,
  countPayments,
  countPaymentsSince,
  countPaymentsToReview,
  setPaymentCheck,
  findDuplicatePayment,
  autoApprovePayment,
  markPaymentReviewed,
  revokePayment,
  removePremiumDays,
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
  startTrial,
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
