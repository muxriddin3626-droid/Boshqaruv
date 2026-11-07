// Karta orqali to'lov: foydalanuvchi kartaga pul o'tkazib, chek rasmini (yoki PDF) yuklaydi.
// Chekni avval sun'iy intellekt o'qiydi (summa, qabul qiluvchi karta, sana, holat); server qat'iy
// qoidalar bo'yicha solishtiradi va hammasi mos kelsa obunani darhol yoqadi — admin keyin ko'rib
// chiqadi va kerak bo'lsa bekor qiladi. Mos kelmasa yoki shubhali bo'lsa — admin qo'lda tekshiradi.
const crypto = require('crypto');
const db = require('./db');
const settings = require('./settings');
const PLANS = require('../public/plans.js');
const { sendJson, readJson, currentUser, clientIp } = require('./account');
const { guard } = require('./admin');

const MAX_FILE = 4 * 1024 * 1024; // 4 MB
const MAX_AGE_DAYS = 3; // chek shu kundan eski bo'lmasin

// Server AI funksiyasini beradi (server.js dagi askJson).
let ask = null;
const setAsker = (fn) => {
  ask = fn;
};

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    is_receipt: { type: 'boolean' },
    success: { type: 'boolean' },
    amount: { type: 'integer' },
    currency: { type: 'string' },
    recipient_last4: { type: 'string' },
    recipient_name: { type: 'string' },
    date: { type: 'string' },
    time: { type: 'string' },
    transaction_id: { type: 'string' },
    edited_suspicion: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['is_receipt', 'success', 'amount', 'currency', 'recipient_last4', 'recipient_name', 'date', 'time', 'transaction_id', 'edited_suspicion', 'notes'],
  additionalProperties: false,
};

const RECEIPT_PROMPT = `Sen bank to'lov cheklarini tekshiradigan diqqatli yordamchisan. Senga O'zbekistondagi to'lov ilovasi (Click, Payme, Uzum, bank ilovasi va h.k.) yoki bankning kartadan kartaga o'tkazma cheki (skrinshot yoki PDF) beriladi. Undagi ma'lumotlarni FAQAT ko'ringanicha o'qi, taxmin qilma:
- is_receipt — bu haqiqatan to'lov/o'tkazma cheki yoki tasdig'imi.
- success — to'lov muvaffaqiyatli bajarilganmi (masalan «Muvaffaqiyatli», «Успешно», «O'tkazildi», yashil belgi). Kutilmoqda/rad etilgan bo'lsa — false.
- amount — o'tkazilgan summa butun son ko'rinishida (so'm; masalan «540 000,00» → 540000). Komissiyani qo'shma. Ko'rinmasa — 0.
- currency — valyuta (UZS, so'm, RUB...), ko'rinmasa bo'sh.
- recipient_last4 — QABUL QILUVCHI kartaning oxirgi 4 raqami (yuboruvchinikini emas). Ko'rinmasa bo'sh.
- recipient_name — qabul qiluvchining ismi (ko'ringanicha), bo'lmasa bo'sh.
- date — sana YYYY-MM-DD ko'rinishida, time — HH:MM; ko'rinmasa bo'sh.
- transaction_id — tranzaksiya/chek raqami (ID), bo'lmasa bo'sh.
- edited_suspicion — rasm tahrirlangan, yig'ilgan yoki soxta ko'rinadimi (shriftlar mos emas, raqamlar ustidan yozilgan, ilova interfeysiga o'xshamaydi va h.k.).
- notes — o'zbekcha 1 gaplik izoh.`;

const last4 = (s) => String(s || '').replace(/\D/g, '').slice(-4);
const tashkentDay = (t = Date.now()) => new Date(t + 5 * 3600 * 1000).toISOString().slice(0, 10);

// AI o'qigan ma'lumotni server qoidalari bilan solishtiradi. Har tekshiruv: { ok, text }.
function evaluate(r, pay, cardNumber) {
  const items = [];
  const add = (ok, text) => items.push({ ok, text });
  add(Boolean(r.is_receipt), r.is_receipt ? "To'lov cheki" : "To'lov chekiga o'xshamaydi");
  add(Boolean(r.success), r.success ? 'Holati: muvaffaqiyatli' : "Muvaffaqiyatli to'lov ko'rinmadi");
  const uzs = !r.currency || /uzs|so.?m|сум|sum/i.test(r.currency);
  add(uzs && r.amount >= pay.amount && pay.amount > 0, `Summa: ${r.amount ? r.amount.toLocaleString('ru-RU') : "o'qilmadi"} (kerak ${pay.amount.toLocaleString('ru-RU')})${uzs ? '' : ` — valyuta ${r.currency}`}`);
  const want = last4(cardNumber);
  const got = last4(r.recipient_last4);
  add(Boolean(got) && got === want, `Qabul qiluvchi karta: ${got ? `*${got}` : "ko'rinmadi"} (kerak *${want})`);
  const today = tashkentDay();
  const oldest = tashkentDay(Date.now() - MAX_AGE_DAYS * 86400000);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= today && r.date >= oldest;
  add(dateOk, `Sana: ${r.date || "ko'rinmadi"}${dateOk ? '' : ` (oxirgi ${MAX_AGE_DAYS} kun ichida bo'lishi kerak)`}`);
  add(!r.edited_suspicion, r.edited_suspicion ? 'Rasm tahrirlanganga o\'xshaydi' : "Tahrir belgilari yo'q");
  return items;
}

async function verify(id, pay, buf, mime) {
  const cardNumber = settings.get().cardNumber;
  const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
  const check = { at: Date.now(), items: [], auto: false, summary: '' };
  let txnId = '';
  try {
    if (!ask) throw new Error('AI ulanmagan');
    const media =
      mime === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }
        : { type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } };
    const r = await ask({
      system: RECEIPT_PROMPT,
      messages: [{ role: 'user', content: [media, { type: 'text', text: "Shu chekni o'qi." }] }],
      schema: RECEIPT_SCHEMA,
    });
    if (!r) throw new Error("AI chekni o'qimadi");
    txnId = String(r.transaction_id || '').trim().slice(0, 80);
    check.read = { amount: r.amount, recipient: r.recipient_last4, name: r.recipient_name, date: r.date, time: r.time, txn: txnId, notes: String(r.notes || '').slice(0, 200) };
    check.items = evaluate(r, pay, cardNumber);
  } catch (err) {
    check.summary = `Avtomatik tekshirib bo'lmadi: ${err.message}`;
  }
  const dup = await db.findDuplicatePayment(id, fileHash, txnId);
  if (dup) check.items.push({ ok: false, text: `Bu chek oldin yuborilgan (#${dup})` });
  const allOk = check.items.length > 0 && check.items.every((x) => x.ok);
  if (allOk && settings.get().autoApprove && (await db.autoApprovePayment(id))) {
    await db.addPremiumDays(pay.userId, pay.days, pay.plan);
    check.auto = true;
    check.summary = "Hammasi mos — obuna avtomatik yoqildi. Admin keyin ko'rib chiqadi.";
  } else if (!check.summary) {
    check.summary = allOk ? "Hammasi mos, lekin avtomatik tasdiqlash o'chirilgan — admin tasdiqlaydi." : "Mos kelmagan joylar bor — admin qo'lda tekshiradi.";
  }
  await db.setPaymentCheck(id, { check, fileHash, txnId });
  return check;
}
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
  auto: p.auto,
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
  const check = await verify(id, { userId: user.id, plan: plan.id, days: period.days, amount }, buf, mime);
  sendJson(res, 200, { ok: true, auto: check.auto, payment: publicPayment(await db.getPayment(id)) });
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
  const valid2 = status === 'review' ? 'review' : valid;
  const payments = await db.listPayments({ status: valid2, limit: 200 });
  sendJson(res, 200, { payments, pending: await db.countPayments('pending'), review: await db.countPaymentsToReview() });
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
  // Avtomatik tasdiqlangan to'lov: admin «to'g'ri» deb belgilaydi yoki bekor qiladi.
  if (body.action === 'reviewed') {
    await db.markPaymentReviewed(id);
    return sendJson(res, 200, { ok: true });
  }
  if (body.action === 'revoke') {
    const note = String(body.note || '').trim().slice(0, 200) || 'Chek tekshiruvdan o\'tmadi';
    if (!(await db.revokePayment(id, note))) return sendJson(res, 409, { error: "Bu to'lovni bekor qilib bo'lmaydi." });
    await db.removePremiumDays(pay.userId, pay.days);
    return sendJson(res, 200, { ok: true });
  }
  if (body.action === 'reject') {
    const note = String(body.note || '').trim().slice(0, 200) || "Chek tasdiqlanmadi";
    if (!(await db.decidePayment(id, 'rejected', note))) return sendJson(res, 409, { error: "Bu to'lov allaqachon ko'rib chiqilgan." });
    return sendJson(res, 200, { ok: true });
  }
  sendJson(res, 400, { error: "Noto'g'ri so'rov." });
}

module.exports = {
  setAsker,
  evaluate,
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
