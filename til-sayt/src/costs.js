// AI xarajati: har bir Claude chaqiruvi narxi (tokenlar va internet qidiruvlari) foydalanuvchi va
// bo'lim bo'yicha yoziladi. Admin panelda ko'rinadi; ixtiyoriy kunlik chegaralar ortiqcha sarfni to'xtatadi.
const { AsyncLocalStorage } = require('async_hooks');
const db = require('./db');
const auth = require('./auth');
const settings = require('./settings');

// Narxlar: $ / 1M token (kirish, chiqish, keshdan o'qish, keshga yozish). Fallback modellar ham bor.
const PRICES = {
  'claude-opus-5-5': [4, 20, 0.2, 5],
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
  'claude-fable-5-1': [10, 50, 0.25, 12.5],
  'claude-opus-5': [5, 25, 0.5, 6.25],
  'claude-opus-4-8': [5, 25, 0.5, 6.25],
  'claude-sonnet-5': [2, 10, 0.2, 2.5],
};
const SEARCH_USD = 0.01; // $10 / 1000 qidiruv

const als = new AsyncLocalStorage();
const tashkentDay = (t = Date.now()) => new Date(t + 5 * 3600 * 1000).toISOString().slice(0, 10);

function priceFor(model) {
  const m = String(model || '');
  const key = Object.keys(PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => m.startsWith(k));
  return PRICES[key] || PRICES['claude-opus-5-5'];
}

function costOf(response) {
  const u = (response && response.usage) || {};
  const [pin, pout, pcr, pcw] = priceFor(response && response.model);
  const input = u.input_tokens || 0;
  const output = u.output_tokens || 0;
  const cacheRead = u.cache_read_input_tokens || 0;
  const cacheWrite = u.cache_creation_input_tokens || 0;
  const searches = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  const usd = (input * pin + output * pout + cacheRead * pcr + cacheWrite * pcw) / 1e6 + searches * SEARCH_USD;
  return { input, output, cacheRead, cacheWrite, searches, usd };
}

// So'rov kimniki: kirgan foydalanuvchi yoki IP (mehmon).
function subjectFor(req) {
  const uid = auth.sessionUserId(req);
  if (uid) return `u:${uid}`;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  return `ip:${ip}`;
}

// Bugungi xarajat (tezkor tekshiruv uchun xotirada).
const today = { day: '', total: 0, subjects: new Map(), loaded: false };

async function ensureToday() {
  const d = tashkentDay();
  if (today.day === d && today.loaded) return;
  today.day = d;
  today.subjects = new Map();
  today.total = await db.aiDayTotal(d).catch(() => 0);
  today.loaded = true;
}

async function subjectToday(subject) {
  await ensureToday();
  if (!today.subjects.has(subject)) today.subjects.set(subject, await db.aiSubjectDay(subject, today.day).catch(() => 0));
  return today.subjects.get(subject);
}

// Har bir Claude javobidan keyin chaqiriladi.
async function record(response, fallbackKind = 'other') {
  try {
    const ctx = als.getStore() || { subject: 'system', kind: fallbackKind };
    const c = costOf(response);
    if (!c.usd) return;
    await ensureToday();
    today.total += c.usd;
    if (today.subjects.has(ctx.subject)) today.subjects.set(ctx.subject, today.subjects.get(ctx.subject) + c.usd);
    await db.addAiUsage({ day: today.day, subject: ctx.subject, kind: ctx.kind || fallbackKind, ...c });
  } catch (err) {
    console.error('Xarajat yozilmadi:', err.message);
  }
}

// So'rovni kontekst bilan bajaradi: ichidagi barcha AI chaqiruvlari shu foydalanuvchiga yoziladi.
const run = (req, kind, fn) => als.run({ subject: subjectFor(req), kind }, fn);
const runSystem = (kind, fn) => als.run({ subject: 'system', kind }, fn);

// Kunlik chegaralar. { ok: true } yoki { ok: false, status, error }.
async function checkBudget(req, isPremium) {
  const s = settings.get();
  const subject = subjectFor(req);
  if (s.userDailyCapUsd > 0 && (await subjectToday(subject)) >= s.userDailyCapUsd) {
    return { ok: false, status: 429, error: "Bugungi foydalanish chegarasiga yetdingiz. Ertaga yana davom etamiz! Takrorlash va daftar ishlayveradi." };
  }
  await ensureToday();
  if (s.dailyBudgetUsd > 0 && today.total >= s.dailyBudgetUsd && !isPremium) {
    return { ok: false, status: 503, error: "Bugun saytda yuklama juda yuqori. Ertaga urinib ko'ring yoki obuna bilan davom eting." };
  }
  return { ok: true };
}

module.exports = { record, run, runSystem, checkBudget, costOf, PRICES, tashkentDay };
