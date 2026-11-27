// Xavfsizlik: haqiqiy IP manzil, himoya sarlavhalari (CSP va b.) va boshqa saytdan kelgan so'rovlarni bloklash.

// Server oldida nechta ishonchli proksi turibdi (Render — 1 ta; Cloudflare + Render — 2 ta).
// X-Forwarded-For'ning boshidagi qiymatlarni foydalanuvchi o'zi yozib yuborishi mumkin, shuning uchun
// proksi qo'shgan oxirgi qiymatni olamiz. Proksisiz (lokal) ishga tushirilganda — TRUST_PROXY=0.
const HOPS = (() => {
  const v = process.env.TRUST_PROXY;
  if (v === undefined || v === '') return process.env.RENDER ? 1 : 0;
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 0;
})();

function clientIp(req) {
  const socketIp = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (!HOPS) return socketIp;
  const list = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const ip = list[list.length - HOPS];
  return ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip.replace(/^::ffff:/, '') : socketIp;
}

const isHttps = (req) => (HOPS ? req.headers['x-forwarded-proto'] === 'https' : Boolean(req.socket.encrypted));

// Content-Security-Policy: sahifa faqat o'z skriptlari, Telegram va Google kirish tugmalarini yuklaydi.
// Telegram tugmasi data-onauth'ni Function() orqali chaqiradi — shuning uchun faqat Telegram yoqilganda 'unsafe-eval'.
function csp() {
  const telegram = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME);
  const google = Boolean(process.env.GOOGLE_CLIENT_ID);
  const script = ["'self'", telegram && 'https://telegram.org', google && 'https://accounts.google.com/gsi/client', telegram && "'unsafe-eval'"];
  const frame = [telegram && 'https://oauth.telegram.org', google && 'https://accounts.google.com/gsi/'];
  const connect = ["'self'", google && 'https://accounts.google.com/gsi/'];
  const style = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', google && 'https://accounts.google.com/gsi/style'];
  const list = (a) => a.filter(Boolean).join(' ');
  return [
    "default-src 'self'",
    `script-src ${list(script)}`,
    `style-src ${list(style)}`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data:",
    `connect-src ${list(connect)}`,
    `frame-src ${frame.some(Boolean) ? list(frame) : "'none'"}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
const CSP = csp();

function setHeaders(req, res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=(), payment=(), usb=()');
  // Google kirish oynasi (popup) ishlashi uchun allow-popups.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

// CSRF: brauzer boshqa saytdan yuborgan POST so'rovini rad etamiz (Origin yoki Referer bizning manzil bo'lishi kerak).
function sameOrigin(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const from = req.headers.origin || req.headers.referer;
  if (!from) return !req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site']);
  try {
    return new URL(from).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

module.exports = { clientIp, isHttps, setHeaders, sameOrigin, HOPS, CSP };
