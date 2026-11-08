// Admin panel: statistika, foydalanuvchilar, Premium, kodlar va sozlamalar.
// Kirish: ADMIN_SECRET paroli bilan yoki akkaunt ID'si ADMIN_USER_IDS (yoki ADMIN_TELEGRAM_IDS) ro'yxatida bo'lsa.
// ID: Telegram — raqam, Google — "g:...", telefon — "p:998901234567".
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');
const settings = require('./settings');
const PLANS = require('../public/plans.js');
const fresh = require('./fresh');
const account = require('./account');

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_IDS = new Set(
  `${process.env.ADMIN_USER_IDS || ''},${process.env.ADMIN_TELEGRAM_IDS || ''}`
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
);
const DAY = 86400000;
const { sendJson, readJson, clientIp, tashkentDay, weekStart } = account;

// Parolni taxmin qilishga urinishlarni cheklaymiz: bir IP'dan daqiqasiga 5 ta.
const attempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > 5;
}

function secretOk(given) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(ADMIN_SECRET);
  return Boolean(ADMIN_SECRET) && a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function isAdmin(req) {
  if (auth.hasAdminCookie(req)) return true;
  const uid = auth.sessionUserId(req);
  return Boolean(uid && ADMIN_IDS.has(uid));
}

// Admin bo'lmasa 403 qaytaradi va false beradi.
async function guard(req, res) {
  if (await isAdmin(req)) return true;
  sendJson(res, 403, { error: 'Admin huquqi kerak.' });
  return false;
}

// ---------- Kirish ----------

async function handleLogin(req, res) {
  if (tooManyAttempts(clientIp(req))) {
    sendJson(res, 429, { error: "Juda ko'p urinish. Bir daqiqadan keyin qayta urinib ko'ring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  if (!secretOk(body.secret)) {
    sendJson(res, 401, { error: ADMIN_SECRET ? "Parol noto'g'ri." : "ADMIN_SECRET sozlanmagan." });
    return;
  }
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.adminCookie(req) });
}

async function handleLogout(req, res) {
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.clearAdminCookie(req) });
}

async function handleMe(req, res) {
  sendJson(res, 200, { admin: await isAdmin(req), passwordLogin: Boolean(ADMIN_SECRET), accountAdmins: ADMIN_IDS.size > 0 });
}

// ---------- Statistika ----------

// Toshkent vaqti bo'yicha kun boshi (ms).
function dayStartMs(t = Date.now()) {
  return Date.parse(`${tashkentDay(t)}T00:00:00+05:00`);
}

function countBy(values) {
  const out = {};
  for (const v of values) if (v) out[v] = (out[v] || 0) + 1;
  return Object.entries(out)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
}

async function handleStats(req, res) {
  if (!(await guard(req, res))) return;
  const now = Date.now();
  const counts = await db.adminCounts({ dayStart: dayStartMs(), weekStart: weekStart() });
  const usage = await db.usageOn(tashkentDay());

  // Oxirgi 14 kundagi ro'yxatdan o'tishlar.
  const since = dayStartMs(now - 13 * DAY);
  const times = await db.signupTimes(since);
  const signups = [];
  for (let i = 13; i >= 0; i--) {
    const day = tashkentDay(now - i * DAY);
    signups.push({ day, count: times.filter((t) => tashkentDay(t) === day).length });
  }

  // Anketa va tillar bo'yicha taqsimot (kirgan foydalanuvchilar ma'lumotidan).
  const states = await db.allStates();
  const profiles = [];
  const langs = { ru: 0, de: 0, ko: 0, en: 0 };
  for (const { data } of states) {
    for (const lang of ['ru', 'de', 'ko', 'en']) {
      const p = data[`tu-profile-${lang}`] && data[`tu-profile-${lang}`].v;
      if (p && p.done) {
        profiles.push(p);
        langs[lang]++;
      }
    }
  }

  sendJson(res, 200, {
    counts,
    usage,
    signups,
    survey: {
      total: profiles.length,
      langs,
      goal: countBy(profiles.map((p) => p.goal)),
      prof: countBy(profiles.map((p) => p.prof)),
      level: countBy(profiles.map((p) => p.level)),
      age: countBy(profiles.map((p) => p.age)),
      interests: countBy(profiles.flatMap((p) => p.interests || [])),
    },
    settings: settings.get(),
  });
}

// ---------- Foydalanuvchilar ----------

async function handleUsers(req, res) {
  if (!(await guard(req, res))) return;
  const url = new URL(req.url, 'http://x');
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 60);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset'), 10) || 0);
  const result = await db.listUsers({ q, offset, limit: 30, week: weekStart() });
  sendJson(res, 200, { ...result, offset });
}

// Bitta foydalanuvchi: anketa, statistika va natijalar xulosasi.
async function handleUser(req, res) {
  if (!(await guard(req, res))) return;
  const id = String(new URL(req.url, 'http://x').searchParams.get('id') || '');
  const user = await db.getUser(id);
  if (!user) {
    sendJson(res, 404, { error: 'Topilmadi.' });
    return;
  }
  const data = await db.getState(id);
  const v = (k) => data[k] && data[k].v;
  const langs = {};
  for (const lang of ['ru', 'de', 'ko', 'en']) {
    const deck = v(`tu-deck-${lang}`) || {};
    const course = v(`tu-course-${lang}`) || {};
    langs[lang] = {
      profile: v(`tu-profile-${lang}`) || null,
      words: Object.keys(deck).length,
      learned: Object.values(deck).filter((c) => c && c.level >= 4).length,
      unitsPassed: Object.values(course).filter((u) => u && u.exam).length,
      lessons: (v(`tu-memory-${lang}`) || {}).lessons || 0,
      certs: Object.keys(v(`tu-certs-${lang}`) || {}),
    };
  }
  const xp = v('tu-xp') || { days: {} };
  const totalXp = Object.values(xp.days || {}).reduce((n, x) => n + (Number(x) || 0), 0);
  sendJson(res, 200, {
    user,
    stats: v('tu-stats') || {},
    totalXp,
    badges: Object.keys(v('tu-badges') || {}).length,
    cost: {
      today: (await db.aiSubjectSince(`u:${id}`, tashkentDay())).usd,
      d30: await db.aiSubjectSince(`u:${id}`, tashkentDay(Date.now() - 29 * DAY)),
    },
    memory: (() => {
      const l = v('tu-learner') || {};
      return [...(l.pinned || []), ...(l.auto || l.facts || [])].slice(0, 25);
    })(),
    langs,
  });
}

async function handlePremium(req, res) {
  if (!(await guard(req, res))) return;
  const body = await readJson(req, res);
  if (!body) return;
  const user = await db.getUser(String(body.userId || ''));
  if (!user) {
    sendJson(res, 404, { error: 'Foydalanuvchi topilmadi.' });
    return;
  }
  const days = parseInt(body.days, 10);
  const plan = PLANS.byId(body.plan) ? body.plan : undefined;
  if (body.remove) {
    await db.setPremiumUntil(user.id, 0);
  } else if (Number.isInteger(days) && days > 0 && days <= 3650) {
    await db.addPremiumDays(user.id, days, plan);
  } else {
    sendJson(res, 400, { error: "Kun soni noto'g'ri." });
    return;
  }
  sendJson(res, 200, { ok: true, user: await db.getUser(user.id) });
}

// ---------- Sozlamalar ----------

async function handleSettings(req, res) {
  if (!(await guard(req, res))) return;
  if (req.method === 'GET') {
    sendJson(res, 200, { settings: settings.get(), defaults: settings.DEFAULTS });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  sendJson(res, 200, { settings: await settings.update(body.settings) });
}

// Telefon bilan kirgan foydalanuvchi parolini unutsa: admin yangi vaqtinchalik parol beradi.
async function handlePassword(req, res) {
  if (!(await guard(req, res))) return;
  const body = await readJson(req, res);
  if (!body) return;
  const user = await db.getUser(String(body.userId || ''));
  if (!user || !user.id.startsWith('p:')) {
    sendJson(res, 404, { error: 'Telefon bilan kirgan foydalanuvchi topilmadi.' });
    return;
  }
  const password = String(crypto.randomInt(10000000, 100000000));
  await db.setPassword(user.id, auth.hashPassword(password));
  sendJson(res, 200, { ok: true, password });
}

// ---------- AI xarajati ----------

const KIND_LABELS = {
  lesson: '🎙️ Ovozli darslar',
  report: '📋 Dars hisobotlari',
  practice: "🎮 O'yinlar va hikoyalar",
  vocab: "📚 Lug'at to'plamlari",
  grammar: '📘 Grammatika',
  placement: '📊 Daraja testi',
  exam: '🎓 Imtihon topshiriqlari',
  'exam-grade': '✍️ Imtihon baholash',
  news: '📰 Yangiliklar',
  rules: '🌐 Qoidalarni yangilash',
  receipt: '💳 Chek tekshiruvi',
  other: 'Boshqa',
};

async function handleCosts(req, res) {
  if (!(await guard(req, res))) return;
  const s = settings.get();
  const today = tashkentDay();
  const since30 = tashkentDay(Date.now() - 29 * DAY);
  const since7 = tashkentDay(Date.now() - 6 * DAY);
  const byDayRaw = await db.aiByDay(since30);
  const byDay = [];
  for (let i = 29; i >= 0; i--) {
    const day = tashkentDay(Date.now() - i * DAY);
    const hit = byDayRaw.find((d) => d.day === day);
    byDay.push({ day, usd: hit ? hit.usd : 0, calls: hit ? hit.calls : 0 });
  }
  const sum = (from) => byDay.filter((d) => d.day >= from).reduce((n, d) => n + d.usd, 0);
  const total30 = sum(since30);
  // Daromad taxmini: faol obunachilar × oylik narx (3 va 12 oylik chegirmalar hisobga olinmagan).
  const subs = await db.activeSubscriptions();
  const monthlyUzs = subs.reduce((n, x) => n + x.count * (Number(((s.prices || {})[x.plan] || {})[1]) || 0), 0);
  const top = await db.aiTopSubjects(since7, today, 25);
  sendJson(res, 200, {
    today: sum(today),
    d7: sum(since7),
    d30: total30,
    // Prognoz: xarajat boshlangan kundan beri o'rtacha kunlik × 30.
    forecastMonth: (() => {
      const first = byDay.findIndex((d) => d.usd > 0);
      const days = first < 0 ? 30 : byDay.length - first;
      return (total30 / Math.max(1, days)) * 30;
    })(),
    usdRate: s.usdRate,
    byDay,
    byKind: (await db.aiByKind(since30)).map((k) => ({ ...k, label: KIND_LABELS[k.kind] || k.kind })),
    top,
    alerts: top.filter((t) => s.costAlertUsd > 0 && t.todayUsd >= s.costAlertUsd),
    revenue: { monthlyUzs, subs },
    settings: { usdRate: s.usdRate, costAlertUsd: s.costAlertUsd, userDailyCapUsd: s.userDailyCapUsd, dailyBudgetUsd: s.dailyBudgetUsd },
  });
}

// ---------- Bilim bazasi va o'quvchilar qiynaladigan joylar ----------

const KB_LANGS = ['all', 'ru', 'de', 'ko', 'en'];

async function handleKnowledge(req, res) {
  if (!(await guard(req, res))) return;
  if (req.method === 'GET') {
    const lang = String(new URL(req.url, 'http://x').searchParams.get('lang') || '');
    const items = await db.listKnowledge({ lang: KB_LANGS.includes(lang) && lang !== 'all' ? lang : '' });
    const updated = {};
    for (const l of fresh.LANGS) {
      const c = await db.cacheGet(`rules:${l}`);
      updated[l] = c ? c.value.at : null;
    }
    sendJson(res, 200, { items: lang === 'all' ? items.filter((k) => k.lang === 'all') : items, rulesUpdated: updated });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const id = parseInt(body.id, 10) || null;
  if (body.action === 'delete' && id) {
    await db.deleteKnowledge(id);
  } else if (body.action === 'toggle' && id) {
    await db.setKnowledgeEnabled(id, Boolean(body.enabled));
  } else {
    const lang = KB_LANGS.includes(body.lang) ? body.lang : 'all';
    const title = String(body.title || '').trim().slice(0, 160);
    const text = String(body.body || '').trim().slice(0, 2000);
    if (!title || !text) {
      sendJson(res, 400, { error: 'Sarlavha va matnni yozing.' });
      return;
    }
    await db.saveKnowledge({ id, lang, topic: String(body.topic || '').trim().slice(0, 40), title, body: text, sourceUrl: String(body.sourceUrl || '').trim().slice(0, 400), enabled: body.enabled !== false });
  }
  fresh.clearCache();
  sendJson(res, 200, { ok: true });
}

// Qoidalarni hozir internetdan yangilash (30-90 soniya davom etadi).
async function handleKnowledgeRefresh(req, res) {
  if (!(await guard(req, res))) return;
  const body = await readJson(req, res);
  if (!body) return;
  try {
    const count = await fresh.refreshRules(body.lang);
    sendJson(res, 200, { ok: true, count });
  } catch (err) {
    sendJson(res, 502, { error: `Yangilab bo'lmadi: ${err.message}` });
  }
}

async function handleInsights(req, res) {
  if (!(await guard(req, res))) return;
  const out = {};
  for (const l of fresh.LANGS) out[l] = await db.topInsights(l, 'weak', 10);
  sendJson(res, 200, { weak: out });
}

const GET_ROUTES = {
  '/api/admin/costs': handleCosts,
  '/api/admin/knowledge': handleKnowledge,
  '/api/admin/insights': handleInsights,
  '/api/admin/me': handleMe,
  '/api/admin/stats': handleStats,
  '/api/admin/users': handleUsers,
  '/api/admin/user': handleUser,
  '/api/admin/settings': handleSettings,
};

const POST_ROUTES = {
  '/api/admin/knowledge': handleKnowledge,
  '/api/admin/knowledge/refresh': handleKnowledgeRefresh,
  '/api/admin/login': handleLogin,
  '/api/admin/logout': handleLogout,
  '/api/admin/premium': handlePremium,
  '/api/admin/password': handlePassword,
  '/api/admin/settings': handleSettings,
};

module.exports = { GET_ROUTES, POST_ROUTES, guard };
