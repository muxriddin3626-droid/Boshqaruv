// Karta orqali to'lov: foydalanuvchi kartaga pul o'tkazib, chek rasmini (yoki PDF) yuklaydi;
// admin chekni tekshirib tasdiqlaydi — obuna avtomatik yoqiladi — yoki sababini yozib rad etadi.
const db = require('./db');
const settings = require('./settings');
const PLANS = require('../public/plans.js');
const { sendJson, readJson, currentUser, clientIp } = require('./account');
const { guard } = require('./admin');

const MAX_FILE = 4 * 1024 * 1024; // 4 MB
const MAX_PENDING = 3;
const MAX_PER_DAY = 10;
const DAY = 86400000;

// Fayl turini mazmunidan tekshiramiz (kengaytmaga ishonmaymiz).
function sniff(buf) {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.length > 5 && buf.slice(0, 5).toString() === '%PDF-') return 'application/pdf';
  return null;
}

const publicPayment = (p) => ({
  id: p.id,
  plan: PLANS.byId(p.plan),
  months: p.months,
  amount: p.amount,
  status: p.status,
  note: p.note,
  createdAt: p.createdAt,
  decidedAt: p.decidedAt,
});

// ---------- Foydalanuvchi ----------

async function handleCreate(req, res) {
  const user = await currentUser(req);
  if (!user) return sendJson(res, 401, { error: "To'lov uchun avval akkauntga kiring." });
  if (!settings.get().cardNumber) return sendJson(res, 400, { error: "Karta orqali to'lov hali sozlanmagan." });
  const body = await readJson(req, res, Math.ceil(MAX_FILE * 1.4) + 4096);
  if (!body) return;
  const plan = PLANS.byId(body.plan);
  const period = PLANS.PERIODS.find((p) => p.months === Number(body.months));
  if (!plan || !period) return sendJson(res, 400, { error: "Tarif noto'g'ri." });
  const b64 = String(body.file || '').replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(b64, 'base64');
  const mime = sniff(buf);
  if (!mime) return sendJson(res, 400, { error: 'Chekni rasm (JPG, PNG) yoki PDF ko\'rinishida yuklang.' });
  if (buf.length > MAX_FILE) return sendJson(res, 400, { error: 'Fayl juda katta (4 MB gacha).' });
  if ((await db.countPayments('pending', user.id)) >= MAX_PENDING) {
    return sendJson(res, 429, { error: "Oldingi to'lovlaringiz hali tekshirilmoqda. Biroz kuting." });
  }
  if ((await db.countPaymentsSince(user.id, Date.now() - DAY)) >= MAX_PER_DAY) {
    return sendJson(res, 429, { error: "Bugun juda ko'p chek yuborildi. Ertaga urinib ko'ring." });
  }
  const amount = Number(((settings.get().prices || {})[plan.id] || {})[period.months]) || 0;
  const id = await db.createPayment({
    userId: user.id,
    plan: plan.id,
    months: period.months,
    days: period.days,
    amount,
    fileMime: mime,
    fileData: buf.toString('base64'),
  });
  console.log(`To'lov #${id}: ${user.id} — ${plan.name}, ${period.label}, ${amount} so'm (${clientIp(req)})`);
  sendJson(res, 200, { ok: true, payment: publicPayment(await db.getPayment(id)) });
}

async function handleMine(req, res) {
  const user = await currentUser(req);
  if (!user) return sendJson(res, 200, { payments: [] });
  const list = await db.listPayments({ userId: user.id, limit: 10 });
  sendJson(res, 200, { payments: list.map(publicPayment) });
}

// ---------- Admin ----------

async function handleAdminList(req, res) {
  if (!(await guard(req, res))) return;
  const status = String(new URL(req.url, 'http://x').searchParams.get('status') || '');
  const valid = ['pending', 'approved', 'rejected'].includes(status) ? status : '';
  const payments = await db.listPayments({ status: valid, limit: 200 });
  sendJson(res, 200, { payments, pending: await db.countPayments('pending') });
}

async function handleAdminFile(req, res) {
  if (!(await guard(req, res))) return;
  const id = parseInt(new URL(req.url, 'http://x').searchParams.get('id'), 10);
  const file = Number.isInteger(id) && (await db.getPaymentFile(id));
  if (!file) return sendJson(res, 404, { error: 'Topilmadi.' });
  res.writeHead(200, {
    'Content-Type': file.mime,
    'Content-Length': file.data.length,
    'Content-Disposition': `inline; filename="chek-${id}.${file.mime === 'application/pdf' ? 'pdf' : file.mime.split('/')[1]}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  });
  res.end(file.data);
}

async function handleAdminDecide(req, res) {
  if (!(await guard(req, res))) return;
  const body = await readJson(req, res);
  if (!body) return;
  const id = parseInt(body.id, 10);
  const pay = Number.isInteger(id) && (await db.getPayment(id));
  if (!pay) return sendJson(res, 404, { error: "To'lov topilmadi." });
  if (body.action === 'approve') {
    if (!(await db.decidePayment(id, 'approved'))) return sendJson(res, 409, { error: "Bu to'lov allaqachon ko'rib chiqilgan." });
    const until = await db.addPremiumDays(pay.userId, pay.days, pay.plan);
    return sendJson(res, 200, { ok: true, premiumUntil: until });
  }
  if (body.action === 'reject') {
    const note = String(body.note || '').trim().slice(0, 200) || "Chek tasdiqlanmadi";
    if (!(await db.decidePayment(id, 'rejected', note))) return sendJson(res, 409, { error: "Bu to'lov allaqachon ko'rib chiqilgan." });
    return sendJson(res, 200, { ok: true });
  }
  sendJson(res, 400, { error: "Noto'g'ri so'rov." });
}

module.exports = {
  GET_ROUTES: {
    '/api/payments/mine': handleMine,
    '/api/admin/payments': handleAdminList,
    '/api/admin/payment-file': handleAdminFile,
  },
  POST_ROUTES: {
    '/api/payments': handleCreate,
    '/api/admin/payment': handleAdminDecide,
  },
};
