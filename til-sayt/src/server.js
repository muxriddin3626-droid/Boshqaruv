require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT, LANGUAGES, MOODS, REPLY_SCHEMA } = require('./prompt');

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

// Suhbat tarixi brauzerda saqlanadi va har so'rovda yuboriladi. Server faqat
// oxirgi MAX_HISTORY ta xabarni Claude'ga uzatadi.
const MAX_HISTORY = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_BODY_BYTES = 200 * 1024;

// Bitta IP manzildan daqiqasiga RATE_LIMIT tadan ortiq so'rov qabul qilinmaydi.
const RATE_LIMIT = 20;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    if (times.every((t) => now - t >= 60_000)) hits.delete(ip);
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

// Brauzerdan kelgan tarixni tekshiradi va Claude uchun tayyorlaydi.
// Noto'g'ri bo'lsa null qaytaradi.
function cleanMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  let messages = [];
  for (const m of raw) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null;
    if (typeof m.content !== 'string') return null;
    const content = m.content.trim();
    if (!content) return null;
    messages.push({ role: m.role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  messages = messages.slice(-MAX_HISTORY);
  // Tarix doim foydalanuvchi xabari bilan boshlanib, u bilan tugashi kerak.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  return messages;
}

const REFUSAL_REPLY = {
  mood: 'calm',
  segments: [{ lang: 'uz', text: "Kechirasiz, bu haqda gaplasha olmayman. Keling, boshqa mavzuda gaplashamiz." }],
};

// Claude javobi JSON ko'rinishida keladi: { mood, segments: [{ lang, text }] }.
// Tarixga ham aynan shu JSON matni yoziladi, shunda model o'z formatini ko'radi.
async function askTutor(lang, messages) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: {
      effort: EFFORT,
      format: { type: 'json_schema', schema: REPLY_SCHEMA },
    },
    // Xavfsizlik filtri so'rovni rad etsa, server boshqa modelda qayta urinadi.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `Foydalanuvchi tanlagan til: ${LANGUAGES[lang]}. Suhbatni shu tilda olib bor.` },
    ],
    messages,
  });

  if (response.stop_reason === 'refusal') return REFUSAL_REPLY;

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const reply = JSON.parse(text);
  const segments = (reply.segments || []).filter((s) => s && typeof s.text === 'string' && s.text.trim());
  if (!segments.length) throw new Error("Bo'sh javob");
  return { mood: MOODS.includes(reply.mood) ? reply.mood : 'calm', segments };
}

async function handleChat(req, res) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (rateLimited(ip)) {
    sendJson(res, 429, { error: "So'rovlar juda ko'p. Bir daqiqadan keyin yana yozing." });
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }

  const lang = body && body.lang;
  const messages = cleanMessages(body && body.messages);
  if (!Object.hasOwn(LANGUAGES, lang) || !messages) {
    sendJson(res, 400, { error: "Noto'g'ri so'rov." });
    return;
  }

  try {
    const reply = await askTutor(lang, messages);
    sendJson(res, 200, reply);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      sendJson(res, 503, { error: "Hozir so'rovlar ko'p, bir daqiqadan keyin yana yozing." });
    } else if (err instanceof Anthropic.AuthenticationError) {
      console.error("ANTHROPIC_API_KEY noto'g'ri.");
      sendJson(res, 500, { error: 'Sayt sozlamalarida xatolik bor (API kalit).' });
    } else {
      console.error('Claude xatoligi:', err);
      sendJson(res, 502, { error: "Hozir javob bera olmadim, birozdan keyin yana urinib ko'ring." });
    }
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/chat' && req.method === 'POST') {
    handleChat(req, res).catch((err) => {
      console.error('Server xatoligi:', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Server xatoligi.' });
    });
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
});
