// Kirish (Telegram, Google, telefon va parol) va imzolangan tokenlar (sessiya, dars).
const crypto = require('crypto');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
// Sessiya imzosi uchun maxfiy kalit. Berilmasa, har ishga tushganda yangisi yaratiladi
// (bunda server qayta ishga tushsa, hamma qaytadan kirishi kerak bo'ladi).
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const SESSION_DAYS = 60;
const SESSION_COOKIE = 'tu_session';

const enabled = Boolean(BOT_TOKEN && BOT_USERNAME);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// Telegram Login Widget ma'lumotini tekshiradi: https://core.telegram.org/widgets/login#checking-authorization
function verifyTelegram(data) {
  if (!enabled || !data || typeof data.hash !== 'string') return null;
  const fields = Object.keys(data)
    .filter((k) => k !== 'hash' && data[k] != null)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secret).update(fields).digest('hex');
  const given = Buffer.from(data.hash, 'hex');
  const want = Buffer.from(expected, 'hex');
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;
  // Eski (bir kundan ortiq) kirish ma'lumotini qabul qilmaymiz.
  if (!(Number(data.auth_date) > Date.now() / 1000 - 86400)) return null;
  return {
    id: String(data.id),
    firstName: String(data.first_name || '').slice(0, 64),
    lastName: String(data.last_name || '').slice(0, 64),
    photoUrl: String(data.photo_url || '').slice(0, 300),
  };
}

// ---------- Google ----------

// Google'ning ochiq kalitlari (ID tokenlarni tekshirish uchun) — keshlab turamiz.
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
let googleKeys = { keys: new Map(), until: 0, fetched: 0 };

async function googleKey(kid) {
  // Noma'lum kalit bo'lsa ham daqiqasiga bir martadan ko'p so'ramaymiz.
  const stale = Date.now() > googleKeys.until || (!googleKeys.keys.has(kid) && Date.now() - googleKeys.fetched > 60000);
  if (stale) {
    const res = await fetch(GOOGLE_CERTS);
    if (!res.ok) throw new Error(`Google kalitlari olinmadi: ${res.status}`);
    const { keys } = await res.json();
    const age = Number((/max-age=(\d+)/.exec(res.headers.get('cache-control') || '') || [])[1]) || 3600;
    googleKeys = {
      keys: new Map(keys.map((k) => [k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })])),
      until: Date.now() + age * 1000,
      fetched: Date.now(),
    };
  }
  return googleKeys.keys.get(kid) || null;
}

// "Google bilan kirish" tugmasi bergan ID tokenni tekshiradi:
// https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
async function verifyGoogle(idToken) {
  if (!GOOGLE_CLIENT_ID || typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
  const key = await googleKey(header.kid);
  if (!key) return null;
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
  if (!ok) return null;
  if (claims.aud !== GOOGLE_CLIENT_ID) return null;
  if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') return null;
  if (!(Number(claims.exp) * 1000 > Date.now()) || typeof claims.sub !== 'string') return null;
  const first = claims.given_name || String(claims.name || '').split(' ')[0] || String(claims.email || '').split('@')[0];
  return {
    id: `g:${claims.sub}`,
    firstName: String(first || '').slice(0, 64),
    lastName: String(claims.family_name || '').slice(0, 64),
    photoUrl: String(claims.picture || '').slice(0, 300),
  };
}

// ---------- Telefon raqam + parol ----------

// Parolni scrypt bilan (tuz qo'shib) saqlaymiz: "scrypt$tuz$xesh".
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function checkPassword(password, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const got = crypto.scryptSync(String(password), salt, 32);
  const want = Buffer.from(hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

const b64 = (s) => Buffer.from(s).toString('base64url');

function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionUserId(req) {
  const payload = verify(parseCookies(req)[SESSION_COOKIE]);
  return payload && payload.kind === 'session' ? payload.uid : null;
}

function isHttps(req) {
  return req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
}

function sessionCookie(req, userId) {
  const token = sign({ kind: 'session', uid: userId, exp: Date.now() + SESSION_DAYS * 86400000 });
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isHttps(req) ? '; Secure' : ''}`;
}

function clearCookie(req) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps(req) ? '; Secure' : ''}`;
}

// Ovozli dars tokeni: dars boshlanganda beriladi va keyingi xabarlarda talab qilinadi,
// shunda kunlik limit har bir yangi dars uchun bir marta hisoblanadi.
const LESSON_MS = 45 * 60 * 1000; // eng uzun dars 30 daqiqa + zaxira

// last — oxirgi javob vaqti: obunachilarning kunlik dars daqiqalarini hisoblash uchun.
function lessonToken(last = Date.now()) {
  return sign({ kind: 'lesson', last, exp: Date.now() + LESSON_MS });
}

// Token to'g'ri bo'lsa uning ma'lumotini, aks holda null qaytaradi.
function checkLessonToken(token) {
  const p = verify(token);
  return p && p.kind === 'lesson' ? p : null;
}

// Admin sessiyasi (ADMIN_SECRET paroli bilan kirganda): 12 soat.
const ADMIN_COOKIE = 'tu_admin';
const ADMIN_HOURS = 12;

function adminCookie(req) {
  const token = sign({ kind: 'admin', exp: Date.now() + ADMIN_HOURS * 3600000 });
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_HOURS * 3600}${isHttps(req) ? '; Secure' : ''}`;
}

function clearAdminCookie(req) {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isHttps(req) ? '; Secure' : ''}`;
}

function hasAdminCookie(req) {
  const p = verify(parseCookies(req)[ADMIN_COOKIE]);
  return Boolean(p && p.kind === 'admin');
}

module.exports = {
  adminCookie,
  clearAdminCookie,
  hasAdminCookie,
  enabled,
  BOT_USERNAME,
  verifyTelegram,
  GOOGLE_CLIENT_ID,
  verifyGoogle,
  hashPassword,
  checkPassword,
  sessionUserId,
  sessionCookie,
  clearCookie,
  lessonToken,
  checkLessonToken,
  secretIsRandom: !process.env.SESSION_SECRET,
};
