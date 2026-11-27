require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const account = require('./account');
const admin = require('./admin');
const push = require('./push');
const payments = require('./payments');
const fresh = require('./fresh');
const db = require('./db');
const costs = require('./costs');
const pool = require('./pool');
const appSettings = require('./settings');
const auth = require('./auth');
const prep = require('./prep');
const security = require('./security');
const {
  TUTOR_PROMPT,
  LANGUAGES,
  MODES,
  TOPICS,
  LEVELS,
  MOODS,
  REPLY_SCHEMA,
  REPORT_PROMPT,
  REPORT_SCHEMA,
  COURSE,
  SC,
  PROFILE_TEXT,
  EXAMS,
  EXAM_SCHEMAS,
  GRADE_SCHEMA,
  examSectionPrompt,
  examGradePrompt,
  GAMES,
  THEMES,
  VOCAB_SCHEMA,
  vocabPrompt,
  GRAMMAR_SCHEMA,
  grammarPrompt,
  PLACEMENT_SCHEMA,
  PLACEMENT_LEVELS,
  placementPrompt,
  gamePrompt,
  sessionPrompt,
} = require('./prompt');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY topilmadi. .env faylida ANTHROPIC_API_KEY ni belgilang.');
  process.exit(1);
}

// ANTHROPIC_API_KEY muhit o'zgaruvchisidan avtomatik o'qiladi.
const client = new Anthropic();

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.CLAUDE_EFFORT || 'medium';
// Hisobot, grammatika, imtihon topshiriqlari va chek tekshiruvi uchun o'rta model.
const FAST_MODEL = process.env.CLAUDE_FAST_MODEL || 'claude-sonnet-5-5';
const FAST_EFFORT = process.env.CLAUDE_FAST_EFFORT || 'low';
// O'yin va lug'at to'plamlari uchun eng arzon model.
const CHEAP_MODEL = process.env.CLAUDE_CHEAP_MODEL || 'claude-haiku-5-5';
// Bepul va sinov foydalanuvchilarining ovozli darsi uchun model (obunachilarda — asosiy model).
const FREE_MODEL = process.env.CLAUDE_FREE_MODEL || 'claude-sonnet-5-5';
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Azure ovozlari (ixtiyoriy). Kalit bo'lmasa, brauzer o'z ovozida o'qiydi.
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;
// Har bir ustozning ovozi: o'z tili, o'zbekcha tushuntirish va boshqa til uchun.
const VOICES = {
  ru: { ru: 'ru-RU-SvetlanaNeural', uz: 'uz-UZ-MadinaNeural', de: 'de-DE-KatjaNeural', ko: 'ko-KR-SunHiNeural', en: 'en-US-JennyNeural' },
  de: { de: 'de-DE-ConradNeural', uz: 'uz-UZ-SardorNeural', ru: 'ru-RU-DmitryNeural', ko: 'ko-KR-InJoonNeural', en: 'en-US-GuyNeural' },
  ko: { ko: 'ko-KR-SunHiNeural', uz: 'uz-UZ-MadinaNeural', ru: 'ru-RU-SvetlanaNeural', de: 'de-DE-KatjaNeural', en: 'en-US-JennyNeural' },
  en: { en: 'en-GB-SoniaNeural', uz: 'uz-UZ-MadinaNeural', ru: 'ru-RU-SvetlanaNeural', de: 'de-DE-KatjaNeural', ko: 'ko-KR-SunHiNeural' },
};
const VOICE_LOCALES = { ru: 'ru-RU', de: 'de-DE', ko: 'ko-KR', en: 'en-GB', uz: 'uz-UZ' };
const MAX_TTS_CHARS = 600;

// Suhbat tarixi brauzerda saqlanadi va har so'rovda yuboriladi. Server suhbat
// uchun oxirgi MAX_HISTORY ta, hisobot uchun MAX_REPORT_HISTORY ta xabarni oladi.
const MAX_HISTORY = 60;
const MAX_REPORT_HISTORY = 120;
const MAX_MESSAGE_CHARS = 4000;
const MAX_BODY_BYTES = 400 * 1024;

// Darsni boshlash uchun foydalanuvchi nomidan yuboriladigan birinchi xabar.
const STARTER = { role: 'user', content: 'Salom! Darsni boshlaymiz.' };

// Bitta IP manzildan daqiqasiga cheklangan miqdorda so'rov qabul qilinadi.
const LIMITS = { chat: 20, tts: 90 };
const hits = new Map();

function rateLimited(kind, ip) {
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > LIMITS[kind];
}

setInterval(() => {
  const now = Date.now();
  for (const [key, times] of hits) {
    if (times.every((t) => now - t >= 60_000)) hits.delete(key);
  }
}, 60_000).unref();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath));
  const type = MIME_TYPES[path.extname(filePath)];
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) || !type) {
    res.writeHead(404).end('Topilmadi');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end('Topilmadi');
      return;
    }
    // Brauzer har safar yangilanganini tekshiradi; oflayn nusxani sw.js saqlaydi.
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const { clientIp } = security;

// Brauzerdan kelgan tarixni tekshiradi. Noto'g'ri bo'lsa null qaytaradi.
function cleanHistory(raw, limit) {
  if (!Array.isArray(raw)) return null;
  const messages = [];
  for (const m of raw) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null;
    if (typeof m.content !== 'string') return null;
    const content = m.content.trim();
    if (!content) return null;
    messages.push({ role: m.role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  return messages.slice(-limit);
}

function cleanSettings(raw) {
  const s = raw || {};
  return {
    mode: Object.hasOwn(MODES, s.mode) ? s.mode : 'kind',
    topic: Object.hasOwn(TOPICS, s.topic) ? s.topic : 'free',
    level: Object.hasOwn(LEVELS, s.level) ? s.level : 'auto',
    unit: typeof s.unit === 'string' && COURSE.byId(s.unit) ? s.unit : null,
    prof: typeof s.prof === 'string' && SC.findTheme(s.prof) ? s.prof : null,
    scenario: typeof s.scenario === 'string' && SC.findScenario(s.scenario) ? s.scenario : null,
    exam: s.exam === true,
  };
}

async function readJson(req, res) {
  try {
    return JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return null;
  }
}

function sendClaudeError(res, err) {
  if (err instanceof Anthropic.RateLimitError) {
    sendJson(res, 503, { error: "Hozir so'rovlar ko'p, bir daqiqadan keyin yana urinib ko'ring." });
  } else if (err instanceof Anthropic.AuthenticationError) {
    console.error("ANTHROPIC_API_KEY noto'g'ri.");
    sendJson(res, 500, { error: 'Sayt sozlamalarida xatolik bor (API kalit).' });
  } else {
    console.error('Claude xatoligi:', err);
    sendJson(res, 502, { error: "Hozir javob bera olmadim, birozdan keyin yana urinib ko'ring." });
  }
}

// Claude'ga JSON sxemasi bilan so'rov yuboradi va tayyor obyektni qaytaradi.
// Xavfsizlik filtri rad etsa null qaytaradi.
// tier: 'main' (asosiy), 'mid' (fast: true) yoki 'cheap'. model — aniq modelni berish (tarifga qarab).
// cache: true — tizim ko'rsatmasi va suhbat keshlanadi (takroriy qismi ~20 baravar arzon).
async function askJson({ system, messages, schema, fast = false, tier, model, cache = false }) {
  const level = tier || (fast ? 'mid' : 'main');
  const useModel = model || { main: MODEL, mid: FAST_MODEL, cheap: CHEAP_MODEL }[level];
  let sys = system;
  let msgs = messages;
  if (cache) {
    const mark = { cache_control: { type: 'ephemeral' } };
    sys = (Array.isArray(system) ? system : [{ type: 'text', text: system }]).map((blk, i, arr) => (i === arr.length - 1 ? { ...blk, ...mark } : blk));
    msgs = messages.map((m, i) =>
      i === messages.length - 1 && typeof m.content === 'string' ? { ...m, content: [{ type: 'text', text: m.content, ...mark }] } : m
    );
  }
  const params = {
    model: useModel,
    max_tokens: level === 'main' ? 4000 : 8000,
    output_config: {
      effort: level === 'main' ? EFFORT : FAST_EFFORT,
      format: { type: 'json_schema', schema },
    },
    system: sys,
    messages: msgs,
  };
  // Xavfsizlik filtri so'rovni rad etsa, server boshqa modelda qayta urinadi (eng arzon modelda bu yo'q).
  if (!useModel.startsWith('claude-haiku')) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  const response = await client.beta.messages.create(params);
  costs.record(response);
  let out = null;
  if (response.stop_reason !== 'refusal') {
    const text = response.content
      .filter((blk) => blk.type === 'text')
      .map((blk) => blk.text)
      .join('');
    try {
      out = JSON.parse(text);
    } catch (err) {
      if (level !== 'cheap') throw err;
    }
  }
  // Arzon model rad etsa yoki yaroqsiz javob bersa — o'rta modelda bir marta qayta urinamiz.
  if (out === null && level === 'cheap') return askJson({ system, messages, schema, tier: 'mid' });
  return out;
}

payments.setAsker(askJson);
fresh.setup({ client, askJson, model: FAST_MODEL });

const REFUSAL_REPLY = {
  mood: 'calm',
  segments: [{ lang: 'uz', text: "Kechirasiz, bu haqda gaplasha olmayman. Keling, boshqa mavzuda gaplashamiz." }],
};

// Ovozli dars modeli: obunachilarga asosiy, bepul va sinovdagilarga arzonroq (sozlamalarda o'chiriladi).
async function lessonModel(req) {
  const user = await account.currentUser(req);
  const paid = account.isPaid(user);
  // Tejamkor tarif (Mini) — doim o'rta modelda.
  const plan = paid && require('../public/plans.js').byId(user.plan);
  if (plan && plan.economy) return FREE_MODEL;
  if (!appSettings.get().cheapFreeModel) return MODEL;
  return paid ? MODEL : FREE_MODEL;
}

// Ustoz javobi: { mood, segments: [{ lang, text }] }. Brauzer tarixga aynan
// shu JSON matnini yozadi, shunda model o'z formatini ko'radi.
async function handleChat(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p. Bir daqiqadan keyin yana gapiring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;

  const lang = body.lang;
  const history = cleanHistory(body.messages, MAX_HISTORY);
  if (!Object.hasOwn(LANGUAGES, lang) || !history) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const messages = [STARTER, ...history];
  if (messages[messages.length - 1].role !== 'user') {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }

  // Yangi dars kunlik limitdan hisoblanadi; davomidagi xabarlar dars tokeni bilan keladi.
  const isNew = !history.some((m) => m.role === 'assistant');
  let q = null;
  let token = null;
  if (isNew) {
    q = await account.quota(req, 'lesson');
    if (!q.ok) {
      account.sendLimit(res, q);
      return;
    }
  } else {
    token = auth.checkLessonToken(body.lessonToken);
    if (!token) {
      sendJson(res, 403, { error: 'Dars vaqti tugadi. Yangi dars boshlang.', expired: true });
      return;
    }
  }
  // Obunachilar: tarif bo'yicha kunlik ovozli dars daqiqalari.
  const vq = await account.voiceQuota(req);
  if (vq && !vq.ok) {
    account.sendVoiceLimit(res, vq);
    return;
  }
  const now = Date.now();
  const settings = cleanSettings(body.settings);
  const memory = cleanMemory(body.memory);
  const extra = await fresh.lessonContext(lang, settings, memory);

  try {
    const reply = await askJson({
      system: [
        { type: 'text', text: TUTOR_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: sessionPrompt(lang, settings, memory, cleanProfile(body.profile), extra) },
      ],
      messages,
      schema: REPLY_SCHEMA,
      model: await lessonModel(req),
      cache: true,
    });
    const lessonToken = auth.lessonToken(now);
    // Oldingi javobdan beri o'tgan vaqt (uzoq tanaffus 2 daqiqadan ortiq hisoblanmaydi).
    if (vq && token && Number.isFinite(token.last)) await vq.add(Math.round(Math.min(now - token.last, 120000) / 1000));
    if (!reply) {
      sendJson(res, 200, { ...REFUSAL_REPLY, lessonToken });
      return;
    }
    const segments = (reply.segments || []).filter((s) => s && typeof s.text === 'string' && s.text.trim());
    if (!segments.length) throw new Error("Bo'sh javob");
    if (q) await q.commit();
    sendJson(res, 200, {
      mood: MOODS.includes(reply.mood) ? reply.mood : 'calm',
      segments,
      goal_reached: reply.goal_reached === true,
      lessonToken,
    });
  } catch (err) {
    sendClaudeError(res, err);
  }
}

// Ustoz javobini (JSON) oddiy matnga aylantiradi.
function assistantText(content) {
  try {
    const parsed = JSON.parse(content);
    return parsed.segments.map((s) => s.text).join(' ');
  } catch {
    return content;
  }
}

async function handleReport(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;

  const lang = body.lang;
  const history = cleanHistory(body.messages, MAX_REPORT_HISTORY);
  if (!Object.hasOwn(LANGUAGES, lang) || !history || !history.some((m) => m.role === 'user')) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }

  const reportSettings = cleanSettings(body.settings);
  const scenario = SC.findScenario(reportSettings.scenario);
  const scenarioNote =
    (scenario ? `\nBu rolli vaziyat edi: "${scenario.title}". Ustoz rolni o'ynadi: ${scenario.role}. O'quvchining maqsadi: ${scenario.goal}.` : '') +
    (reportSettings.topic === 'vocab' ? "\nBu LUG'AT DARSI edi: words ro'yxatiga darsda o'rgatilgan barcha yangi so'zlarni yoz (40 tagacha)." : '');
  const known = strList(body.facts, 25, 160);
  const factsNote = known.length
    ? `\n\nO'quvchi haqida avval ma'lum bo'lganlar (facts ro'yxatida saqla):\n${known.map((f) => `- ${f}`).join('\n')}`
    : "\n\nO'quvchi haqida avval hech narsa ma'lum emas.";
  const transcript = history
    .map((m) => (m.role === 'user' ? `O'quvchi: ${m.content}` : `Ustoz: ${assistantText(m.content)}`))
    .join('\n');

  try {
    const report = await askJson({
      system: REPORT_PROMPT,
      messages: [
        {
          role: 'user',
          content: `O'rganilayotgan til: ${LANGUAGES[lang]}.${scenarioNote}${factsNote}\n\nDars yozuvi:\n<transcript>\n${transcript}\n</transcript>`,
        },
      ],
      schema: REPORT_SCHEMA,
      fast: true,
    });
    if (!report) {
      sendJson(res, 502, { error: 'Hisobot tayyorlab bo\'lmadi.' });
      return;
    }
    report.facts = strList(report.facts, 20, 160);
    report.topics = strList(report.topics, 3, 80);
    report.weak = strList(report.weak, 3, 80);
    db.addInsights(lang, 'weak', report.weak).catch(() => {});
    sendJson(res, 200, report);
  } catch (err) {
    sendClaudeError(res, err);
  }
}

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Modeldan kelgan o'yin ma'lumotini tekshiradi: bo'sh yoki chala bandlarni tashlaydi,
// noto'g'ri variantlar orasidan to'g'ri javobni va takrorlarni olib tashlaydi.
function cleanWrong(list, correct) {
  const seen = new Set([correct.toLowerCase()]);
  const out = [];
  for (const w of Array.isArray(list) ? list : []) {
    const v = str(w);
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out.slice(0, 3);
}

function cleanGame(type, raw) {
  const count = GAMES[type].count;
  if (type === 'story') {
    const sentences = (raw.sentences || [])
      .map((x) => ({
        text: str(x && x.text, 300),
        translation: str(x && x.translation, 300),
        words: (Array.isArray(x && x.words) ? x.words : [])
          .map((w) => ({ form: str(w && w.form, 60), base: str(w && w.base, 60), translation: str(w && w.translation, 80) }))
          .filter((w) => w.form && w.translation)
          .slice(0, 6),
      }))
      .filter((x) => x.text && x.translation)
      .slice(0, 12);
    const questions = (raw.questions || [])
      .map((q) => {
        const correct = str(q && q.correct, 120);
        return { question: str(q && q.question), correct, wrong: cleanWrong(q && q.wrong, correct) };
      })
      .filter((q) => q.question && q.correct && q.wrong.length === 3)
      .slice(0, 4);
    return { title: str(raw.title, 120), title_uz: str(raw.title_uz, 120), sentences, questions };
  }
  if (type === 'match') {
    const seen = new Set();
    const pairs = (raw.pairs || [])
      .map((p) => ({ word: str(p && p.word, 80), translation: str(p && p.translation, 80) }))
      .filter((p) => {
        const key = p.translation.toLowerCase();
        if (!p.word || !p.translation || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return { pairs: pairs.slice(0, count) };
  }
  const items = (raw.items || []).map((it) => {
    it = it || {};
    if (type === 'quiz') {
      const correct = str(it.correct, 120);
      return { question: str(it.question), correct, wrong: cleanWrong(it.wrong, correct), explanation: str(it.explanation, 400) };
    }
    if (type === 'listen') {
      const text = str(it.text, 120);
      return { text, translation: str(it.translation, 120), wrong: cleanWrong(it.wrong, text) };
    }
    if (type === 'speak') return { text: str(it.text, 160), translation: str(it.translation, 160), tip: str(it.tip, 300) };
    return { sentence: str(it.sentence, 200), translation: str(it.translation, 200) };
  });
  const ok = items.filter((it) => {
    if (type === 'quiz') return it.question && it.correct && it.wrong.length === 3;
    if (type === 'listen') return it.text && it.translation && it.wrong.length === 3;
    if (type === 'speak') return it.text && it.translation;
    return it.sentence.split(/\s+/).length >= 2 && it.translation;
  });
  return { items: ok.slice(0, count) };
}

// Anketa: faqat ma'lum qiymatlar va qisqa matnlar qabul qilinadi.
function cleanProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pick = (map, v) => (typeof v === 'string' && Object.hasOwn(map, v) ? v : null);
  const name = str(raw.name, 40).replace(/[<>{}\[\]`]/g, '');
  const city = str(raw.city, 40).replace(/[<>{}\[\]`]/g, '');
  return {
    name,
    city,
    age: pick(PROFILE_TEXT.age, raw.age),
    goal: pick(PROFILE_TEXT.goal, raw.goal),
    prof: pick(PROFILE_TEXT.prof, raw.prof),
    interests: (Array.isArray(raw.interests) ? raw.interests : []).filter((i) => typeof i === 'string' && Object.hasOwn(PROFILE_TEXT.interests, i)).slice(0, 6),
  };
}

const strList = (v, n, max = 300) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

function cleanMemory(raw) {
  const m = raw || {};
  const lessons = Number.isInteger(m.lessons) && m.lessons > 0 ? Math.min(m.lessons, 10000) : 0;
  return {
    lessons,
    summary: str(m.summary, 400),
    level: str(m.level, 10),
    facts: strList(m.facts, 25, 160),
    topics: strList(m.topics, 10, 80),
    weak: strList(m.weak, 5, 80),
    ...cleanFocus(m),
  };
}

function cleanFocus(raw) {
  const list = (v, n) => (Array.isArray(v) ? v.map((x) => str(x, 120)).filter(Boolean).slice(0, n) : []);
  return { words: list(raw && raw.words, 8), mistakes: list(raw && raw.mistakes, 6) };
}

async function handleGame(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p. Bir daqiqadan keyin yana urinib ko'ring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;

  const { lang, type } = body;
  if (!Object.hasOwn(LANGUAGES, lang) || !Object.hasOwn(GAMES, type)) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  // Kurs bosqichi imtihoni imtihon limitidan, qolganlari mashq limitidan hisoblanadi.
  const settings = cleanSettings(body.settings);
  const q = await account.quota(req, settings.exam ? 'exam' : 'practice');
  if (!q.ok) {
    account.sendLimit(res, q);
    return;
  }

  // Kurs bosqichi va kasb mashqlari, shuningdek shaxsiy ma'lumotsiz so'rovlar — umumiy ombordan.
  // O'quvchining xatolari yoki qiziqishlari bo'lsa — unga moslab yangi tuziladi (eng arzon modelda).
  const focus = cleanFocus(body.focus);
  const profile = cleanProfile(body.profile);
  const personal = focus.words.length || focus.mistakes.length || (profile && profile.interests && profile.interests.length);
  const shared = Boolean(settings.unit || settings.prof || settings.exam || !personal);
  const poolKey = [lang, type, settings.unit || '', settings.prof || '', settings.exam ? 'x' : '', settings.unit || settings.prof ? '' : `${settings.topic}:${settings.level}`].join('|');

  try {
    const hit = shared && (await pool.take('game', poolKey, { target: 6 }));
    if (hit) {
      await q.commit();
      sendJson(res, 200, hit.data);
      return;
    }
    const raw = await askJson({
      system: gamePrompt(lang, type, settings, shared ? { words: [], mistakes: [] } : focus, shared ? null : profile),
      messages: [{ role: 'user', content: "Mashqni tayyorla." }],
      schema: GAMES[type].schema,
      tier: 'cheap',
    });
    const game = raw && cleanGame(type, raw);
    const size = game && (game.pairs || game.items || game.sentences).length;
    if (!size || size < 3) {
      sendJson(res, 502, { error: "Mashqni tayyorlab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    if (shared) await pool.add('game', poolKey, game, 12);
    await q.commit();
    sendJson(res, 200, game);
  } catch (err) {
    sendClaudeError(res, err);
  }
}

// ---------- Bugungi yangiliklar ----------

async function handleNews(req, res) {
  const lang = new URL(req.url, 'http://x').searchParams.get('lang');
  if (!Object.hasOwn(LANGUAGES, lang)) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  try {
    sendJson(res, 200, await fresh.getNews(lang));
  } catch (err) {
    sendJson(res, 503, { error: err.message });
  }
}

// ---------- Lug'at: mavzuli so'z to'plami ----------

async function handleVocab(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p. Bir daqiqadan keyin yana urinib ko'ring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const theme = THEMES.byId(body.theme);
  if (!Object.hasOwn(LANGUAGES, body.lang) || !theme) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const level = Object.hasOwn(LEVELS, body.level) && body.level !== 'auto' ? body.level : 'a1';
  const exclude = (Array.isArray(body.exclude) ? body.exclude : []).map((w) => str(w, 60)).filter(Boolean).slice(-150);
  const q = await account.quota(req, 'practice');
  if (!q.ok) {
    account.sendLimit(res, q);
    return;
  }
  const poolKey = `${body.lang}|${theme.id}|${level}`;
  const known = new Set(exclude.map((w) => w.toLowerCase()));
  const newWords = (pack) => pack.words.filter((w) => !known.has(w.word.toLowerCase()));
  try {
    // Ombordagi to'plamlardan o'quvchi hali ko'rmaganini beramiz (kamida 15 ta yangi so'z bo'lsa).
    const hit = await pool.take('vocab', poolKey, { target: 1, accept: (it) => newWords(it.data).length >= 15 });
    if (hit) {
      await q.commit();
      sendJson(res, 200, { words: newWords(hit.data) });
      return;
    }
    // Yangi to'plam: ombordagi so'zlarni ham takrorlamaslik uchun chiqarib tashlaymiz.
    const pooled = (await pool.list('vocab', poolKey)).flatMap((it) => it.data.words.map((w) => w.word));
    const avoid = [...new Set([...pooled, ...exclude])].slice(-200);
    const raw = await askJson({
      system: vocabPrompt(body.lang, theme, level, avoid, null),
      messages: [{ role: 'user', content: "Lug'at to'plamini tayyorla." }],
      schema: VOCAB_SCHEMA,
      tier: 'cheap',
    });
    const seen = new Set(avoid.map((w) => w.toLowerCase()));
    const words = ((raw && raw.words) || [])
      .map((w) => ({
        word: str(w && w.word, 80),
        translation: str(w && w.translation, 120),
        example: str(w && w.example, 200),
        example_uz: str(w && w.example_uz, 200),
      }))
      .filter((w) => w.word && w.translation && !seen.has(w.word.toLowerCase()) && seen.add(w.word.toLowerCase()))
      .slice(0, THEMES.PACK_SIZE);
    if (words.length < 5) {
      sendJson(res, 502, { error: "So'zlarni tayyorlab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    if (words.length >= 15) await pool.add('vocab', poolKey, { words }, 40);
    await q.commit();
    sendJson(res, 200, { words });
  } catch (err) {
    sendClaudeError(res, err);
  }
}

// ---------- Grammatika kartochkasi va daraja testi ----------

function cleanExercise(x) {
  const correct = str(x && x.correct, 160);
  return { question: str(x && x.question, 400), correct, wrong: correct ? cleanWrong(x.wrong, correct) : [], explanation: str(x && x.explanation, 400) };
}

const goodExercise = (q) => q.question && q.correct && q.wrong.length >= 2;

async function handleGrammar(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p. Bir daqiqadan keyin yana urinib ko'ring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const unit = typeof body.unit === 'string' && COURSE.byId(body.unit);
  if (!Object.hasOwn(LANGUAGES, body.lang) || !unit) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const q = await account.quota(req, 'practice');
  if (!q.ok) {
    account.sendLimit(res, q);
    return;
  }
  const gKey = `${body.lang}|${unit.id}`;
  const notId = Number.isInteger(body.not) ? body.not : -1;
  try {
    // Har bosqich uchun 3 tagacha tushuntirish varianti; «Boshqacha tushuntir» boshqasini beradi.
    const hit = await pool.take('grammar', gKey, { target: notId >= 0 ? 3 : 1, accept: (it) => it.id !== notId });
    if (hit) {
      await q.commit();
      sendJson(res, 200, { ...hit.data, v: hit.id });
      return;
    }
    const raw = await askJson({
      system: grammarPrompt(body.lang, unit),
      messages: [{ role: 'user', content: 'Grammatika kartochkasini tayyorla.' }],
      schema: GRAMMAR_SCHEMA,
      fast: true,
    });
    const card = raw && {
      title: str(raw.title, 120),
      intro: str(raw.intro, 600),
      sections: (raw.sections || []).slice(0, 5).map((s) => ({
        heading: str(s && s.heading, 120),
        text: str(s && s.text, 1200),
        examples: ((s && s.examples) || []).slice(0, 4).map((e) => ({ text: str(e && e.text, 200), uz: str(e && e.uz, 200) })).filter((e) => e.text),
      })).filter((s) => s.text),
      table: {
        headers: ((raw.table && raw.table.headers) || []).slice(0, 6).map((h) => str(h, 60)),
        rows: ((raw.table && raw.table.rows) || []).slice(0, 12).map((r) => (Array.isArray(r) ? r.slice(0, 6).map((c) => str(c, 80)) : [])),
      },
      tip: str(raw.tip, 400),
      exercises: (raw.exercises || []).map(cleanExercise).filter(goodExercise).slice(0, 8),
    };
    if (!card || !card.sections.length || card.exercises.length < 3) {
      sendJson(res, 502, { error: "Qoidani tayyorlab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    const v = await pool.add('grammar', gKey, card, 3);
    await q.commit();
    sendJson(res, 200, { ...card, v });
  } catch (err) {
    sendClaudeError(res, err);
  }
}

async function handlePlacement(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p. Bir daqiqadan keyin yana urinib ko'ring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  if (!Object.hasOwn(LANGUAGES, body.lang)) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const q = await account.quota(req, 'practice');
  if (!q.ok) {
    account.sendLimit(res, q);
    return;
  }
  try {
    const hit = await pool.take('placement', body.lang, { target: 5 });
    if (hit) {
      await q.commit();
      sendJson(res, 200, hit.data);
      return;
    }
    const raw = await askJson({
      system: placementPrompt(body.lang),
      messages: [{ role: 'user', content: 'Daraja testini tayyorla.' }],
      schema: PLACEMENT_SCHEMA,
      fast: true,
    });
    const items = ((raw && raw.items) || [])
      .map((x) => ({ ...cleanExercise(x), level: PLACEMENT_LEVELS.includes(x && x.level) ? x.level : null }))
      .filter((x) => x.level && goodExercise(x))
      .sort((a, b) => PLACEMENT_LEVELS.indexOf(a.level) - PLACEMENT_LEVELS.indexOf(b.level))
      .slice(0, 20);
    const perLevel = PLACEMENT_LEVELS.map((l) => items.filter((x) => x.level === l).length);
    if (perLevel.some((n) => n < 2)) {
      sendJson(res, 502, { error: "Testni tayyorlab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    await pool.add('placement', body.lang, { items }, 5);
    await q.commit();
    sendJson(res, 200, { items });
  } catch (err) {
    sendClaudeError(res, err);
  }
}

// ---------- Sinov imtihonlari ----------

function findSection(lang, examId, sectionId) {
  const exam = Object.hasOwn(LANGUAGES, lang) && EXAMS.find(lang, examId);
  const section = exam && exam.sections.find((x) => x.id === sectionId);
  return section ? { exam, section, kind: EXAMS.SECTION_INFO[section.id].kind } : null;
}

function cleanExamSection(kind, raw) {
  if (kind === 'choice') {
    const passages = (raw.passages || [])
      .map((p) => ({
        title: str(p && p.title, 120),
        text: str(p && p.text, 3000),
        questions: (Array.isArray(p && p.questions) ? p.questions : [])
          .map((q) => {
            const correct = str(q && q.correct, 160);
            return {
              question: str(q && q.question, 400),
              correct,
              wrong: cleanWrong(q && q.wrong, correct),
              explanation: str(q && q.explanation, 400),
            };
          })
          .filter((q) => q.question && q.correct && q.wrong.length >= 2)
          .slice(0, 12),
      }))
      .filter((p) => p.questions.length)
      .slice(0, 5);
    const count = passages.reduce((n, p) => n + p.questions.length, 0);
    return count >= 4 ? { instructions_uz: str(raw.instructions_uz, 400), passages } : null;
  }
  if (kind === 'writing') {
    const task = str(raw.task, 1200);
    const points = (Array.isArray(raw.points) ? raw.points : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 5);
    const minWords = Number.isInteger(raw.min_words) ? Math.min(Math.max(raw.min_words, 20), 250) : 40;
    return task ? { instructions_uz: str(raw.instructions_uz, 400), task, task_uz: str(raw.task_uz, 1200), points, min_words: minWords } : null;
  }
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : [])
    .map((t) => ({ prompt: str(t && t.prompt, 400), prompt_uz: str(t && t.prompt_uz, 400) }))
    .filter((t) => t.prompt)
    .slice(0, 4);
  return tasks.length ? { instructions_uz: str(raw.instructions_uz, 400), tasks } : null;
}

async function handleExamSection(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p. Bir daqiqadan keyin yana urinib ko'ring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const found = findSection(body.lang, body.exam, body.section);
  if (!found) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const q = await account.quota(req, 'exam');
  if (!q.ok) {
    account.sendLimit(res, q);
    return;
  }
  // Imtihon bo'limlari umumiy ombordan (har biriga 8 tagacha variant). Qonunchilik bo'limi bundan
  // mustasno: u yangilanib turadigan qoidalarga tayanadi, shuning uchun har safar yangidan tuziladi.
  const sharedExam = found.section.id !== 'law';
  const examKey = `${body.lang}|${found.exam.id}|${found.section.id}`;
  try {
    const hit = sharedExam && (await pool.take('exam', examKey, { target: 8 }));
    if (hit) {
      await q.commit();
      sendJson(res, 200, hit.data);
      return;
    }
    const raw = await askJson({
      system: [examSectionPrompt(body.lang, found.exam, found.section), ...(await fresh.examContext(body.lang, found.section.id))].join('\n\n'),
      messages: [{ role: 'user', content: "Topshiriqni tayyorla." }],
      schema: EXAM_SCHEMAS[found.kind],
      fast: true,
    });
    const content = raw && cleanExamSection(found.kind, raw);
    if (!content) {
      sendJson(res, 502, { error: "Topshiriqni tayyorlab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    if (sharedExam) await pool.add('exam', examKey, content, 8);
    await q.commit();
    sendJson(res, 200, content);
  } catch (err) {
    sendClaudeError(res, err);
  }
}

// ---------- Imtihonga tayyorgarlik: og'zaki sinov va yozma ish (4 til) ----------

const PREP_LANGS = Object.keys(prep.PREP.EXAMS);
const numIn = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

// Umumiy ombordan oladi yoki yangi variant tuzadi. seenKey — takrorlanmasligi uchun solishtiriladigan maydon.
async function pooled(kind, key, target, seen, seenOf, build) {
  const hit = await pool.take(kind, key, { target, accept: (it) => !seen.includes(seenOf(it.data)) });
  if (hit) return hit.data;
  const fresh = await build();
  if (fresh) await pool.add(kind, key, fresh, target);
  return fresh;
}

const seenList = (v) => (Array.isArray(v) ? v.map((x) => str(x, 160)).slice(0, 40) : []);

async function buildSpeakTest(lang, level, seen) {
  const raw = await askJson({
    system: prep.speakTestPrompt(lang, level),
    messages: [{ role: 'user', content: seen.length ? `Savollar to'plamini tayyorla. Bu mavzular bo'lmasin: ${seen.slice(0, 10).join('; ')}` : "Savollar to'plamini tayyorla." }],
    schema: prep.SPEAK_TEST_SCHEMA,
    fast: true,
  });
  if (!raw) return null;
  const part = (p, n) => {
    const questions = strList(p && p.questions, n);
    const uz = strList(p && p.questions_uz, n);
    return { topic: str(p && p.topic, 80), questions, questions_uz: questions.map((_, i) => uz[i] || '') };
  };
  const test = {
    part1: part(raw.part1, 5),
    part2: {
      task: str(raw.part2 && raw.part2.task, 200),
      task_uz: str(raw.part2 && raw.part2.task_uz, 300),
      bullets: strList(raw.part2 && raw.part2.bullets, 4),
      followup: str(raw.part2 && raw.part2.followup, 200),
    },
    part3: part(raw.part3, 5),
  };
  const ok = test.part1.questions.length >= 3 && test.part2.task && test.part2.bullets.length >= 3 && test.part3.questions.length >= 3;
  return ok ? test : null;
}

async function handleSpeakTest(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p. Bir daqiqadan keyin yana urinib ko'ring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  if (!PREP_LANGS.includes(body.lang)) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const q = await account.quota(req, 'exam');
  if (!q.ok) {
    account.sendLimit(res, q);
    return;
  }
  const level = prep.levelOf(body.level);
  const key = body.lang === 'en' ? 'en' : `${body.lang}|${level}`;
  const seen = seenList(body.seen);
  try {
    const test = await pooled('speak', key, 20, seen, (d) => d.part2.task, () => buildSpeakTest(body.lang, level, seen));
    if (!test) {
      sendJson(res, 502, { error: "Savollarni tayyorlab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    await q.commit();
    sendJson(res, 200, test);
  } catch (err) {
    sendClaudeError(res, err);
  }
}

// AI baholashini tozalaydi; umumiy baho — rasmiy yaxlitlash qoidasi bilan serverda.
function cleanGrade(g, scale, keys) {
  const criteria = {};
  for (const k of keys) criteria[k] = { band: prep.clamp(scale, g[k] && g[k].band), comment: str(g[k] && g[k].comment, 500) };
  const pairs = (v, a, b, n, c) =>
    (Array.isArray(v) ? v : [])
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({ [a]: str(x[a], 300), [b]: str(x[b], 300), ...(c ? { [c]: str(x[c], 300) } : {}) }))
      .filter((x) => x[a] && x[b])
      .slice(0, n);
  return {
    scale,
    overall: prep.PREP.overall(keys.map((k) => criteria[k].band)),
    criteria,
    summary: str(g.summary, 800),
    tips: strList(g.tips, 5),
    mistakes: pairs(g.mistakes, 'wrong', 'correct', 8, 'explanation'),
    vocab: pairs(g.vocab, 'word', 'translation', 6),
  };
}

async function handleSpeakGrade(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 14) : [];
  if (!PREP_LANGS.includes(body.lang) || !answers.length) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const content = answers
    .map((a, i) => {
      const m = a && typeof a === 'object' ? a : {};
      const sec = numIn(m.seconds, 600);
      const words = numIn(m.words, 2000);
      const stats = `${sec} soniya, ${words} so'z, ${sec ? Math.round((words / sec) * 60) : 0} WPM, uzun to'xtashlar: ${numIn(m.pauses, 99)}, to'ldiruvchi so'zlar: ${numIn(m.fillers, 99)}, tanish ishonchi: ${Math.round((Number(m.confidence) || 0) * 100)}%`;
      return `${numIn(m.part, 3)}-qism — savol ${i + 1}: ${str(m.question, 400)}\n[${stats}]\n<answer>\n${str(m.text, 3000) || '(javob berilmagan)'}\n</answer>`;
    })
    .join('\n\n');
  const scale = prep.PREP.EXAMS[body.lang].scale;
  try {
    const g = await askJson({
      system: prep.speakGradePrompt(body.lang, body.level),
      messages: [{ role: 'user', content }],
      schema: prep.SPEAK_GRADE_SCHEMA,
    });
    if (!g) {
      sendJson(res, 502, { error: "Baholab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    sendJson(res, 200, {
      ...cleanGrade(g, scale, ['fluency', 'lexical', 'grammar', 'pronunciation']),
      better: { question: str(g.better && g.better.question, 400), answer: str(g.better && g.better.answer, 1500) },
    });
  } catch (err) {
    sendClaudeError(res, err);
  }
}

async function buildWriteTask(lang, level, kind, seen) {
  const raw = await askJson({
    system: prep.writeTaskPrompt(lang, level, kind),
    messages: [{ role: 'user', content: seen.length ? `Topshiriqni tayyorla. Bu mavzular bo'lmasin: ${seen.slice(0, 10).join('; ')}` : 'Topshiriqni tayyorla.' }],
    schema: prep.WRITE_TASK_SCHEMA,
    fast: true,
  });
  const task = raw && { task: str(raw.task, 1200), task_uz: str(raw.task_uz, 1200), points: strList(raw.points, 4, 200) };
  return task && task.task ? task : null;
}

// Yozma topshiriq. Bepul vositalar sahifasidagi mavzu generatori ham shundan foydalanadi (limitsiz, faqat ombordan).
async function handleWriteTask(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p. Bir daqiqadan keyin yana urinib ko'ring." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  if (!PREP_LANGS.includes(body.lang)) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const kind = prep.writeKind(body.lang, body.kind);
  const level = prep.levelOf(body.level);
  const key = `${body.lang}|${kind.id}|${body.lang === 'en' ? 'all' : level}`;
  const seen = seenList(body.seen);
  try {
    const task = await pooled('write', key, 15, seen, (d) => d.task.slice(0, 160), () => buildWriteTask(body.lang, level, kind.id, seen));
    if (!task) {
      sendJson(res, 502, { error: "Topshiriqni tayyorlab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    sendJson(res, 200, { ...task, kind: kind.id, minWords: kind.minWords, minutes: kind.minutes });
  } catch (err) {
    sendClaudeError(res, err);
  }
}

async function handleWriteGrade(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const text = str(body.text, 6000);
  const task = str(body.task, 1500);
  if (!PREP_LANGS.includes(body.lang) || !task || text.split(/\s+/).filter(Boolean).length < 5) {
    sendJson(res, 400, { error: "Avval topshiriqni tanlang va kamida bir necha gap yozing." });
    return;
  }
  const q = await account.quota(req, 'exam');
  if (!q.ok) {
    account.sendLimit(res, q);
    return;
  }
  const kind = prep.writeKind(body.lang, body.kind);
  const words = text.split(/\s+/).filter(Boolean).length;
  const scale = prep.PREP.EXAMS[body.lang].scale;
  try {
    const g = await askJson({
      system: prep.writeGradePrompt(body.lang, body.level, kind.id),
      messages: [{ role: 'user', content: `Topshiriq:\n${task}\n\nO'quvchi ${numIn(body.minutes, 300)} daqiqada yozdi, ${words} so'z.\n\n<answer>\n${text}\n</answer>` }],
      schema: prep.WRITE_GRADE_SCHEMA,
    });
    if (!g) {
      sendJson(res, 502, { error: "Baholab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    await q.commit();
    sendJson(res, 200, { ...cleanGrade(g, scale, ['task', 'coherence', 'lexical', 'grammar']), corrected: str(g.corrected, 6000), words });
  } catch (err) {
    sendClaudeError(res, err);
  }
}

// Bepul vositalar: og'zaki mavzu (cue card) generatori — faqat ombordan, AI chaqirilmaydi.
async function handleToolTopic(req, res) {
  const u = new URL(req.url, 'http://x');
  const lang = u.searchParams.get('lang');
  const type = u.searchParams.get('type');
  if (!PREP_LANGS.includes(lang) || !['speak', 'write'].includes(type)) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }
  const items = [];
  if (type === 'speak') {
    for (const key of lang === 'en' ? ['en'] : prep.PREP.LEVELS.map((l) => `${lang}|${l}`)) {
      for (const it of await pool.list('speak', key)) items.push({ task: it.data.part2.task, task_uz: it.data.part2.task_uz, points: it.data.part2.bullets, level: key.split('|')[1] || '' });
    }
  } else {
    for (const k of prep.PREP.EXAMS[lang].writing) {
      for (const key of lang === 'en' ? [`${lang}|${k.id}|all`] : prep.PREP.LEVELS.map((l) => `${lang}|${k.id}|${l}`)) {
        for (const it of await pool.list('write', key)) items.push({ ...it.data, kindTitle: k.title, level: key.split('|')[2] === 'all' ? '' : key.split('|')[2] });
      }
    }
  }
  sendJson(res, 200, { topics: items.sort(() => Math.random() - 0.5).slice(0, 12) });
}

async function handleExamGrade(req, res) {
  if (rateLimited('chat', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;
  const found = findSection(body.lang, body.exam, body.section);
  if (!found || found.kind === 'choice') {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }

  // Topshiriq va javoblarni bitta matnga yig'amiz.
  let content;
  if (found.kind === 'writing') {
    const answer = str(body.answer, 4000);
    content = `Topshiriq: ${str(body.task && body.task.task, 1200)}\nKerakli nuqtalar: ${(Array.isArray(body.task && body.task.points) ? body.task.points : []).map((x) => str(x, 200)).join('; ')}\nKamida ${Number(body.task && body.task.min_words) || 40} so'z.\n\n<answer>\n${answer || '(javob yozilmagan)'}\n</answer>`;
  } else {
    const tasks = Array.isArray(body.task && body.task.tasks) ? body.task.tasks.slice(0, 4) : [];
    const answers = Array.isArray(body.answer) ? body.answer : [];
    content = tasks
      .map((t, i) => `${i + 1}-topshiriq: ${str(t && t.prompt, 400)}\n<answer>\n${str(answers[i], 2000) || '(javob berilmagan)'}\n</answer>`)
      .join('\n\n');
  }

  try {
    const g = await askJson({
      system: examGradePrompt(body.lang, found.exam, found.section),
      messages: [{ role: 'user', content }],
      schema: GRADE_SCHEMA,
    });
    if (!g) {
      sendJson(res, 502, { error: "Baholab bo'lmadi." });
      return;
    }
    const list = (v) => (Array.isArray(v) ? v.map((x) => str(x, 300)).filter(Boolean).slice(0, 5) : []);
    sendJson(res, 200, {
      score: Math.max(0, Math.min(100, Math.round(Number(g.score) || 0))),
      feedback: str(g.feedback, 800),
      strengths: list(g.strengths),
      improvements: list(g.improvements),
      corrected: str(g.corrected, 4000),
    });
  } catch (err) {
    sendClaudeError(res, err);
  }
}

function escapeXml(s) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

// Matnni Azure'ning tabiiy ovozida o'qib, mp3 qaytaradi.
async function handleTts(req, res) {
  if (!AZURE_KEY || !AZURE_REGION) {
    sendJson(res, 501, { error: 'Ovoz xizmati sozlanmagan.' });
    return;
  }
  if (rateLimited('tts', clientIp(req))) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p." });
    return;
  }
  const body = await readJson(req, res);
  if (!body) return;

  const { tutor, lang } = body;
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TTS_CHARS) : '';
  if (!Object.hasOwn(VOICES, tutor) || !Object.hasOwn(VOICE_LOCALES, lang) || !text) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }

  // O'quvchi uchun o'rganilayotgan tilni biroz sekinroq o'qiymiz.
  // «Tinglab takrorlash»dagi 🐢 tugmasi — ancha sekin.
  const rate = body.slow === true ? '-35%' : lang === 'uz' ? '0%' : '-8%';
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${VOICE_LOCALES[lang]}">` +
    `<voice name="${VOICES[tutor][lang]}"><prosody rate="${rate}">${escapeXml(text)}</prosody></voice></speak>`;

  try {
    const azure = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'til-sayt',
      },
      body: ssml,
    });
    if (!azure.ok) {
      console.error('Azure ovoz xatoligi:', azure.status, await azure.text().catch(() => ''));
      sendJson(res, 502, { error: 'Ovoz xizmati javob bermadi.' });
      return;
    }
    const audio = Buffer.from(await azure.arrayBuffer());
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length });
    res.end(audio);
  } catch (err) {
    console.error('Azure ovoz xatoligi:', err);
    sendJson(res, 502, { error: 'Ovoz xizmati javob bermadi.' });
  }
}

const GET_ROUTES = {
  '/api/news': handleNews,
  '/api/tools/topics': handleToolTopic,
};

const ROUTES = {
  '/api/chat': handleChat,
  '/api/report': handleReport,
  '/api/game': handleGame,
  '/api/vocab': handleVocab,
  '/api/grammar': handleGrammar,
  '/api/placement': handlePlacement,
  '/api/exam/section': handleExamSection,
  '/api/exam/grade': handleExamGrade,
  '/api/prep/speak-test': handleSpeakTest,
  '/api/prep/speak-grade': handleSpeakGrade,
  '/api/prep/write-task': handleWriteTask,
  '/api/prep/write-grade': handleWriteGrade,
  '/api/tts': handleTts,
};

// AI ishlatadigan yo'llar: xarajat shu bo'lim va foydalanuvchiga yoziladi.
const AI_KINDS = {
  '/api/chat': 'lesson',
  '/api/report': 'report',
  '/api/game': 'practice',
  '/api/vocab': 'vocab',
  '/api/grammar': 'grammar',
  '/api/placement': 'placement',
  '/api/exam/section': 'exam',
  '/api/exam/grade': 'exam-grade',
  '/api/prep/speak-test': 'exam',
  '/api/prep/speak-grade': 'speak-grade',
  '/api/prep/write-task': 'exam',
  '/api/prep/write-grade': 'write-grade',
  '/api/news': 'news',
  '/api/payments': 'receipt',
};
// Kunlik chegara tekshiriladigan (o'quvchi bosib ishlatadigan) yo'llar.
const BUDGETED = new Set(['/api/chat', '/api/game', '/api/vocab', '/api/grammar', '/api/placement', '/api/exam/section', '/api/exam/grade', '/api/prep/speak-test', '/api/prep/speak-grade', '/api/prep/write-task', '/api/prep/write-grade']);

async function guarded(route, url, req, res) {
  if (BUDGETED.has(url)) {
    const user = await account.currentUser(req);
    const b = await costs.checkBudget(req, account.isPremium(user));
    if (!b.ok) {
      sendJson(res, b.status, { error: b.error, budget: true });
      return;
    }
  }
  await route(req, res);
}

function runRoute(route, req, res) {
  const url = req.url.split('?')[0];
  const kind = AI_KINDS[url];
  const job = kind ? costs.run(req, kind, () => guarded(route, url, req, res)) : route(req, res);
  job.catch((err) => {
    console.error('Server xatoligi:', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Server xatoligi.' });
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  security.setHeaders(req, res);
  // Boshqa saytdan yuborilgan POST so'rovlari (CSRF) rad etiladi.
  if (req.method === 'POST' && !security.sameOrigin(req)) {
    sendJson(res, 403, { error: "So'rov rad etildi." });
    return;
  }
  const route =
    req.method === 'POST'
      ? ROUTES[url] || account.POST_ROUTES[url] || admin.POST_ROUTES[url] || push.POST_ROUTES[url] || payments.POST_ROUTES[url]
      : GET_ROUTES[url] || account.GET_ROUTES[url] || admin.GET_ROUTES[url] || push.GET_ROUTES[url] || payments.GET_ROUTES[url];
  if (route) {
    runRoute(route, req, res);
    return;
  }
  if (url === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, { voice: Boolean(AZURE_KEY && AZURE_REGION), ...account.config() });
    return;
  }
  // Admin panel sahifasi (qidiruv tizimlariga ko'rsatilmaydi).
  if (url === '/sitemap.xml' && req.method === 'GET') {
    const proto = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? 'https' : 'http';
    const host = String(req.headers.host || '').replace(/[^a-zA-Z0-9.:-]/g, '');
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${proto}://${host}/</loc><changefreq>weekly</changefreq></url><url><loc>${proto}://${host}/tools.html</loc><changefreq>weekly</changefreq></url></urlset>\n`);
    return;
  }
  if (url === '/admin' && (req.method === 'GET' || req.method === 'HEAD')) {
    fs.readFile(path.join(PUBLIC_DIR, 'admin.html'), (err, data) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
      res.end(data);
    });
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405).end();
});

// Sekin ulanishlar bilan serverni band qilib qo'yishdan himoya.
server.headersTimeout = 20000;
server.requestTimeout = 60000;
server.keepAliveTimeout = 10000;

account.ready.then(() => server.listen(PORT, () => {
  console.log(`Sayt ishga tushdi: http://localhost:${PORT}`);
  fresh.startSchedule();
  if (!auth.enabled) console.log("Telegram orqali kirish sozlanmagan — natijalar faqat brauzerda saqlanadi.");
  else if (auth.secretIsRandom) console.log('Diqqat: SESSION_SECRET berilmagan — server qayta ishga tushsa, hamma qaytadan kirishi kerak.');
  if (!AZURE_KEY || !AZURE_REGION) {
    console.log("Azure ovozi sozlanmagan — brauzer o'z ovozida o'qiydi.");
  }
})).catch((err) => {
  console.error("Bazaga ulanib bo'lmadi:", err);
  process.exit(1);
});
