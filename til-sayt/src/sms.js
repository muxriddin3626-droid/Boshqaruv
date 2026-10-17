// SMS yuborish: telefon raqam bilan kirish kodi uchun.
// SMS_PROVIDER: eskiz (O'zbekiston, eskiz.uz), twilio (xalqaro) yoki console (faqat sinov uchun).
const PROVIDER = String(process.env.SMS_PROVIDER || '').toLowerCase();
const TEMPLATE = process.env.SMS_TEMPLATE || 'Til Ustoz: kirish kodingiz {code}';

const ESKIZ_URL = 'https://notify.eskiz.uz/api';
const ESKIZ_EMAIL = process.env.ESKIZ_EMAIL || '';
const ESKIZ_PASSWORD = process.env.ESKIZ_PASSWORD || '';
const ESKIZ_FROM = process.env.ESKIZ_FROM || '4546';

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM || '';

const enabled =
  (PROVIDER === 'eskiz' && Boolean(ESKIZ_EMAIL && ESKIZ_PASSWORD)) ||
  (PROVIDER === 'twilio' && Boolean(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM)) ||
  PROVIDER === 'console';

// Eskiz faqat O'zbekiston raqamlariga yuboradi.
const onlyUzbek = PROVIDER === 'eskiz';

if (PROVIDER === 'console') {
  console.warn('SMS_PROVIDER=console: kodlar SMS bilan yuborilmaydi, server logiga yoziladi (faqat sinov uchun!).');
}

// ---------- Eskiz ----------

let eskizToken = { value: '', until: 0 };

async function eskizLogin() {
  const form = new FormData();
  form.append('email', ESKIZ_EMAIL);
  form.append('password', ESKIZ_PASSWORD);
  const res = await fetch(`${ESKIZ_URL}/auth/login`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  const token = data && data.data && data.data.token;
  if (!res.ok || !token) throw new Error(`Eskiz login xatosi: ${res.status}`);
  // Token ~30 kun amal qiladi; biz 25 kunda yangilaymiz.
  eskizToken = { value: token, until: Date.now() + 25 * 86400000 };
  return token;
}

async function eskizSend(phone, text, retry = true) {
  const token = Date.now() < eskizToken.until ? eskizToken.value : await eskizLogin();
  const form = new FormData();
  form.append('mobile_phone', phone);
  form.append('message', text);
  form.append('from', ESKIZ_FROM);
  const res = await fetch(`${ESKIZ_URL}/message/sms/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (res.status === 401 && retry) {
    eskizToken.until = 0;
    return eskizSend(phone, text, false);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Eskiz SMS xatosi: ${res.status} ${body.slice(0, 200)}`);
  }
}

// ---------- Twilio ----------

async function twilioSend(phone, text) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: `+${phone}`, From: TWILIO_FROM, Body: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Twilio SMS xatosi: ${res.status} ${body.slice(0, 200)}`);
  }
}

// phone — faqat raqamlar, mamlakat kodi bilan (masalan 998901234567).
async function sendCode(phone, code) {
  const text = TEMPLATE.replace('{code}', code);
  if (PROVIDER === 'eskiz') return eskizSend(phone, text);
  if (PROVIDER === 'twilio') return twilioSend(phone, text);
  if (PROVIDER === 'console') {
    console.log(`[SMS sinov] +${phone}: ${text}`);
    return undefined;
  }
  throw new Error('SMS sozlanmagan');
}

module.exports = { enabled, onlyUzbek, sendCode };
