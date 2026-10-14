require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
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
  EXAMS,
  EXAM_SCHEMAS,
  GRADE_SCHEMA,
  examSectionPrompt,
  examGradePrompt,
  GAMES,
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
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Azure ovozlari (ixtiyoriy). Kalit bo'lmasa, brauzer o'z ovozida o'qiydi.
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;
// Har bir ustozning ovozi: o'z tili, o'zbekcha tushuntirish va boshqa til uchun.
const VOICES = {
  ru: { ru: 'ru-RU-SvetlanaNeural', uz: 'uz-UZ-MadinaNeural', de: 'de-DE-KatjaNeural' },
  de: { de: 'de-DE-ConradNeural', uz: 'uz-UZ-SardorNeural', ru: 'ru-RU-DmitryNeural' },
};
const VOICE_LOCALES = { ru: 'ru-RU', de: 'de-DE', uz: 'uz-UZ' };
const MAX_TTS_CHARS = 600;

// Suhbat tarixi brauzerda saqlanadi va har so'rovda yuboriladi. Server suhbat
// uchun oxirgi MAX_HISTORY ta, hisobot uchun MAX_REPORT_HISTORY ta xabarni oladi.
const MAX_HISTORY = 40;
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
    res.writeHead(200, { 'Content-Type': type });
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

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
}

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
async function askJson({ system, messages, schema }) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: {
      effort: EFFORT,
      format: { type: 'json_schema', schema },
    },
    // Xavfsizlik filtri so'rovni rad etsa, server boshqa modelda qayta urinadi.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages,
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return JSON.parse(text);
}

const REFUSAL_REPLY = {
  mood: 'calm',
  segments: [{ lang: 'uz', text: "Kechirasiz, bu haqda gaplasha olmayman. Keling, boshqa mavzuda gaplashamiz." }],
};

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

  try {
    const reply = await askJson({
      system: [
        { type: 'text', text: TUTOR_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: sessionPrompt(lang, cleanSettings(body.settings), cleanMemory(body.memory)) },
      ],
      messages,
      schema: REPLY_SCHEMA,
    });
    if (!reply) {
      sendJson(res, 200, REFUSAL_REPLY);
      return;
    }
    const segments = (reply.segments || []).filter((s) => s && typeof s.text === 'string' && s.text.trim());
    if (!segments.length) throw new Error("Bo'sh javob");
    sendJson(res, 200, { mood: MOODS.includes(reply.mood) ? reply.mood : 'calm', segments });
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

  const transcript = history
    .map((m) => (m.role === 'user' ? `O'quvchi: ${m.content}` : `Ustoz: ${assistantText(m.content)}`))
    .join('\n');

  try {
    const report = await askJson({
      system: REPORT_PROMPT,
      messages: [
        {
          role: 'user',
          content: `O'rganilayotgan til: ${LANGUAGES[lang]}.\n\nDars yozuvi:\n<transcript>\n${transcript}\n</transcript>`,
        },
      ],
      schema: REPORT_SCHEMA,
    });
    if (!report) {
      sendJson(res, 502, { error: 'Hisobot tayyorlab bo\'lmadi.' });
      return;
    }
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

function cleanMemory(raw) {
  const m = raw || {};
  const lessons = Number.isInteger(m.lessons) && m.lessons > 0 ? Math.min(m.lessons, 10000) : 0;
  return { lessons, summary: str(m.summary, 400), level: str(m.level, 10), ...cleanFocus(m) };
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

  try {
    const raw = await askJson({
      system: gamePrompt(lang, type, cleanSettings(body.settings), cleanFocus(body.focus)),
      messages: [{ role: 'user', content: "Mashqni tayyorla." }],
      schema: GAMES[type].schema,
    });
    const game = raw && cleanGame(type, raw);
    const size = game && (game.pairs || game.items || game.sentences).length;
    if (!size || size < 3) {
      sendJson(res, 502, { error: "Mashqni tayyorlab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    sendJson(res, 200, game);
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
  try {
    const raw = await askJson({
      system: examSectionPrompt(body.lang, found.exam, found.section),
      messages: [{ role: 'user', content: "Topshiriqni tayyorla." }],
      schema: EXAM_SCHEMAS[found.kind],
    });
    const content = raw && cleanExamSection(found.kind, raw);
    if (!content) {
      sendJson(res, 502, { error: "Topshiriqni tayyorlab bo'lmadi, qayta urinib ko'ring." });
      return;
    }
    sendJson(res, 200, content);
  } catch (err) {
    sendClaudeError(res, err);
  }
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
  const rate = lang === 'uz' ? '0%' : '-8%';
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

const ROUTES = {
  '/api/chat': handleChat,
  '/api/report': handleReport,
  '/api/game': handleGame,
  '/api/exam/section': handleExamSection,
  '/api/exam/grade': handleExamGrade,
  '/api/tts': handleTts,
};

const server = http.createServer((req, res) => {
  const route = ROUTES[req.url];
  if (route && req.method === 'POST') {
    route(req, res).catch((err) => {
      console.error('Server xatoligi:', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Server xatoligi.' });
    });
    return;
  }
  if (req.url === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, { voice: Boolean(AZURE_KEY && AZURE_REGION) });
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405).end();
});

server.listen(PORT, () => {
  console.log(`Sayt ishga tushdi: http://localhost:${PORT}`);
  if (!AZURE_KEY || !AZURE_REGION) {
    console.log("Azure ovozi sozlanmagan — brauzer o'z ovozida o'qiydi.");
  }
});
