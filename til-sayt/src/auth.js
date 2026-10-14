// Telegram orqali kirish va imzolangan tokenlar (sessiya, dars).
const crypto = require('crypto');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
// Sessiya imzosi uchun maxfiy kalit. Berilmasa, har ishga tushganda yangisi yaratiladi
// (bunda server qayta ishga tushsa, hamma qaytadan kirishi kerak bo'ladi).
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const SESSION_DAYS = 60;
const SESSION_COOKIE = 'tu_session';

const enabled = Boolean(BOT_TOKEN && BOT_USERNAME);

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
const LESSON_MS = 15 * 60 * 1000;

function lessonToken() {
  return sign({ kind: 'lesson', exp: Date.now() + LESSON_MS });
}

function checkLessonToken(token) {
  const p = verify(token);
  return Boolean(p && p.kind === 'lesson');
}

module.exports = {
  enabled,
  BOT_USERNAME,
  verifyTelegram,
  sessionUserId,
  sessionCookie,
  clearCookie,
  lessonToken,
  checkLessonToken,
  secretIsRandom: !process.env.SESSION_SECRET,
};
