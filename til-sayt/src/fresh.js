// Yangi bilimlar: kunlik yangiliklar (internetdan qidirib), haftalik yangilanadigan qoidalar
// (patent, EPS-TOPIK, vizalar), admin bilim bazasi va hamma o'quvchilar qiynaladigan joylar.
// Yangiliklar har til uchun kuniga bir marta tuziladi va hamma o'quvchilarga umumiy — shuning
// uchun internet qidiruvi kam ishlatiladi.
const db = require('./db');

const LANGS = ['ru', 'de', 'ko'];
const COUNTRY = { ru: 'Rossiya', de: 'Germaniya', ko: 'Janubiy Koreya' };
const LANG_NAME = { ru: 'rus tili', de: 'nemis tili', ko: 'koreys tili' };
const RULE_TOPICS = {
  ru: "Rossiyada chet el fuqarolari (ayniqsa O'zbekiston fuqarolari) uchun: patent olish tartibi va hujjatlar, patent imtihoni (rus tili, tarix, qonunchilik asoslari) talablari va o'tish bali, patent uchun oylik to'lov (Moskva va boshqa hududlar), migratsiya hisobiga turish muddatlari, so'nggi o'zgarishlar va yangi qoidalar.",
  de: "Germaniyaga O'zbekiston fuqarolari uchun: ishlash va o'qish vizalari, Chancenkarte, malakali mutaxassislar uchun talablar, Goethe-Zertifikat imtihonlari (A1-B1) tartibi, oila birlashuvi uchun til talabi, so'nggi o'zgarishlar.",
  ko: "Janubiy Koreyaga O'zbekistondan EPS (Employment Permit System) orqali ishlashga borish: EPS-TOPIK imtihoni tartibi, ball talablari, ro'yxatdan o'tish (Tashqi mehnat migratsiyasi agentligi), TOPIK imtihoni sanalari va darajalari, E-9 viza, so'nggi o'zgarishlar.",
};
const RULES_MAX_AGE = 7 * 86400000;
const RETRY_AFTER = 12 * 3600000;

let client = null;
let ask = null;
let model = '';
const setup = (opts) => {
  ({ client, askJson: ask, model } = opts);
};

const tashkentDay = (t = Date.now()) => new Date(t + 5 * 3600 * 1000).toISOString().slice(0, 10);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ---------- Internetda qidirib matn olish ----------

async function searchText(system, prompt, maxUses = 5) {
  const messages = [{ role: 'user', content: prompt }];
  const sources = new Map();
  let text = '';
  for (let round = 0; round < 4; round++) {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxUses }],
      messages,
    });
    if (res.stop_reason === 'refusal') throw new Error('rad etildi');
    for (const b of res.content) {
      if (b.type === 'text') text += b.text;
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const r of b.content) if (r && r.url) sources.set(r.url, r.title || r.url);
      }
    }
    // Server qidiruv tsiklini to'xtatib qo'ygan bo'lsa — davom ettiramiz.
    if (res.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: res.content });
  }
  if (!text.trim()) throw new Error("bo'sh javob");
  return { text, sources: [...sources].map(([url, title]) => ({ url, title })) };
}

// ---------- Kunlik yangiliklar ----------

const NEWS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          text: { type: 'string' },
          summary_uz: { type: 'string' },
          words: {
            type: 'array',
            items: {
              type: 'object',
              properties: { word: { type: 'string' }, translation: { type: 'string' } },
              required: ['word', 'translation'],
              additionalProperties: false,
            },
          },
          source_url: { type: 'string' },
          source_name: { type: 'string' },
        },
        required: ['title', 'text', 'summary_uz', 'words', 'source_url', 'source_name'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const inflight = new Map();

async function buildNews(lang, day) {
  const found = await searchText(
    "Sen yangiliklar muharririsan. Internetdan qidirib, faqat haqiqiy va tekshirilgan yangiliklarni topasan, har biri uchun manba havolasini yozasan.",
    `Bugun ${day}. ${COUNTRY[lang]}dagi so'nggi 1-2 kunning 5 ta qiziqarli va foydali yangiligini top: kundalik hayot, madaniyat, sport, fan va texnologiya, ob-havo, transport, chet elliklar va migrantlar uchun foydali yangiliklar (qonun o'zgarishlari, ish, ta'lim). Urush, terror, siyosiy janjal, zo'ravonlik va jinoyat tafsilotlaridan qoch. Har biri uchun: sarlavha, 3-4 gaplik mazmun, sana va manba havolasi.`
  );
  const sourceList = found.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n');
  const out = await ask({
    system: `Sen ${LANG_NAME[lang]} o'qituvchisisan va o'zbek o'quvchilari uchun yangiliklarni soddalashtirasan.`,
    messages: [
      {
        role: 'user',
        content: `Quyidagi yangiliklardan 4-5 tasini tanla va o'quv materialiga aylantir:\n- title — ${LANG_NAME[lang]}da qisqa sarlavha;\n- text — ${LANG_NAME[lang]}da 3-5 ta qisqa, sodda gap (A2-B1 daraja, kundalik so'zlar);\n- summary_uz — o'zbekcha 1-2 gaplik mazmun (lotin yozuvida);\n- words — matndagi 4-6 ta foydali so'z va o'zbekcha tarjimasi;\n- source_url va source_name — manba (faqat quyidagi ro'yxatdan yoki matndagi havola).\n\nYANGILIKLAR:\n${found.text.slice(0, 12000)}\n\nMANBALAR:\n${sourceList.slice(0, 4000)}`,
      },
    ],
    schema: NEWS_SCHEMA,
    fast: true,
  });
  const items = ((out && out.items) || [])
    .map((x) => ({
      title: str(x.title, 200),
      text: str(x.text, 1200),
      summaryUz: str(x.summary_uz, 500),
      words: (x.words || []).slice(0, 6).map((w) => ({ word: str(w.word, 60), translation: str(w.translation, 80) })).filter((w) => w.word && w.translation),
      sourceUrl: /^https?:\/\//.test(x.source_url || '') ? str(x.source_url, 400) : '',
      sourceName: str(x.source_name, 80),
    }))
    .filter((x) => x.title && x.text)
    .slice(0, 5);
  if (items.length < 2) throw new Error('yangilik topilmadi');
  return { day, items };
}

// Bugungi yangiliklar: keshdan, bo'lmasa tuziladi (bir vaqtda bitta so'rov). Xato bo'lsa — kechagisi.
async function getNews(lang) {
  if (!LANGS.includes(lang)) throw new Error("Noto'g'ri til");
  const day = tashkentDay();
  const key = `news:${lang}:${day}`;
  const cached = await db.cacheGet(key);
  if (cached) return cached.value;
  if (!inflight.has(key)) {
    inflight.set(
      key,
      buildNews(lang, day)
        .then(async (news) => {
          await db.cacheSet(key, news);
          db.cacheCleanup(`news:${lang}:`, Date.now() - 7 * 86400000).catch(() => {});
          return news;
        })
        .finally(() => inflight.delete(key))
    );
  }
  try {
    return await inflight.get(key);
  } catch (err) {
    console.error(`Yangiliklar (${lang}):`, err.message);
    const yesterday = await db.cacheGet(`news:${lang}:${tashkentDay(Date.now() - 86400000)}`);
    if (yesterday) return { ...yesterday.value, stale: true };
    throw new Error("Yangiliklarni hozir olib bo'lmadi. Birozdan keyin urinib ko'ring.");
  }
}

// ---------- Haftalik yangilanadigan qoidalar ----------

const RULES_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          source_url: { type: 'string' },
        },
        required: ['topic', 'title', 'body', 'source_url'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

async function refreshRules(lang) {
  if (!LANGS.includes(lang)) throw new Error("Noto'g'ri til");
  await db.cacheSet(`rules-try:${lang}`, { at: Date.now() });
  const found = await searchText(
    "Sen migratsiya va til imtihonlari bo'yicha maslahatchisan. Faqat rasmiy va ishonchli manbalardan (davlat saytlari, imtihon markazlari, yirik ommaviy axborot vositalari) eng so'nggi ma'lumotni topasan va har fakt uchun manbani yozasan.",
    `Bugun ${tashkentDay()}. Quyidagilar bo'yicha eng so'nggi, amaldagi qoidalarni internetdan tekshir: ${RULE_TOPICS[lang]} Har bir fakt uchun qachondan amal qilishini va manbasini yoz.`,
    8
  );
  const sourceList = found.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n');
  const out = await ask({
    system: "Sen o'zbek tilida aniq va qisqa yozadigan maslahatchisan.",
    messages: [
      {
        role: 'user',
        content: `Quyidagi ma'lumotdan o'quvchilar uchun 4-8 ta qisqa ma'lumot kartochkasi tuz (o'zbek tilida, lotin yozuvida):\n- topic — qisqa teg (masalan: patent, imtihon, viza, to'lov, hujjatlar);\n- title — sarlavha;\n- body — 2-5 gaplik aniq ma'lumot: raqamlar, talablar, qachondan amal qiladi. Ishonchsiz narsani yozma;\n- source_url — manba havolasi (faqat quyidagi ro'yxatdan).\n\nMA'LUMOT:\n${found.text.slice(0, 14000)}\n\nMANBALAR:\n${sourceList.slice(0, 4000)}`,
      },
    ],
    schema: RULES_SCHEMA,
    fast: true,
  });
  const items = ((out && out.items) || [])
    .map((x) => ({
      topic: str(x.topic, 40),
      title: str(x.title, 160),
      body: str(x.body, 1200),
      sourceUrl: /^https?:\/\//.test(x.source_url || '') ? str(x.source_url, 400) : '',
    }))
    .filter((x) => x.title && x.body)
    .slice(0, 8);
  if (!items.length) throw new Error("ma'lumot topilmadi");
  await db.replaceAutoKnowledge(lang, items);
  await db.cacheSet(`rules:${lang}`, { at: Date.now(), count: items.length });
  contextCache.clear();
  return items.length;
}

// Har soatda tekshiramiz: qoidalar 7 kundan eski bo'lsa — yangilaymiz (xato bo'lsa 12 soatdan keyin qayta).
async function rulesTick() {
  for (const lang of LANGS) {
    const done = await db.cacheGet(`rules:${lang}`);
    if (done && Date.now() - done.value.at < RULES_MAX_AGE) continue;
    const tried = await db.cacheGet(`rules-try:${lang}`);
    if (tried && Date.now() - tried.value.at < RETRY_AFTER) continue;
    try {
      const n = await refreshRules(lang);
      console.log(`Qoidalar yangilandi (${lang}): ${n} ta`);
    } catch (err) {
      console.error(`Qoidalarni yangilab bo'lmadi (${lang}):`, err.message);
    }
  }
}

function startSchedule() {
  if (process.env.FRESH_AUTO === 'off') return;
  setTimeout(() => rulesTick().catch(() => {}), 60000).unref();
  setInterval(() => rulesTick().catch(() => {}), 3600000).unref();
}

// ---------- Darsga qo'shiladigan kontekst ----------

const contextCache = new Map(); // `${lang}` -> { at, knowledge, weak }

async function baseContext(lang) {
  const hit = contextCache.get(lang);
  if (hit && Date.now() - hit.at < 5 * 60000) return hit;
  const [knowledge, weak] = await Promise.all([db.listKnowledge({ lang, enabledOnly: true }), db.topInsights(lang, 'weak', 6)]);
  const ctx = { at: Date.now(), knowledge, weak };
  contextCache.set(lang, ctx);
  return ctx;
}

function knowledgeLines(knowledge, max = 3000) {
  let used = 0;
  const lines = [];
  for (const k of knowledge) {
    const line = `- [${k.topic || 'umumiy'}] ${k.title}: ${k.body}`;
    if (used + line.length > max) break;
    used += line.length;
    lines.push(line);
  }
  return lines;
}

// Ustoz uchun qo'shimcha qatorlar: bilim bazasi, umumiy qiyinchiliklar, yangiliklar darsi.
async function lessonContext(lang, settings, memory) {
  const out = [];
  try {
    const { knowledge, weak } = await baseContext(lang);
    const kl = knowledgeLines(knowledge);
    if (kl.length) {
      out.push(
        "ENG SO'NGGI MA'LUMOTLAR (sayt egasi tasdiqlagan yoki internetdan yangilangan; o'z bilimingdan farq qilsa — SHULARGA ishon). Mavzuga tegishli bo'lsa yoki o'quvchi so'rasa ishlat, bo'lmasa zo'rlab gapirma:\n" +
          kl.join('\n')
      );
    }
    if (weak.length && (!memory || (memory.lessons || 0) < 5)) {
      out.push(
        `Bu tilni o'rganayotgan o'zbek o'quvchilar eng ko'p qiynaladigan joylar (hamma darslardan yig'ilgan): ${weak.map((w) => w.text).join('; ')}. Shu o'quvchida ham shu joylarga oldindan e'tibor ber va tabiiy mashq qildir.`
      );
    }
    if (settings && settings.topic === 'news') {
      const news = await getNews(lang);
      out.push(
        `BUGUNGI YANGILIKLAR (${news.day}${news.stale ? ', kechagi' : ''}):\n` +
          news.items.map((n, i) => `${i + 1}. ${n.title} — ${n.text}`).join('\n') +
          "\nShu yangiliklarni o'quvchi bilan o'rganilayotgan tilda muhokama qil: birini qisqa aytib ber, fikrini so'ra, yangi so'zlarni tushuntir. Bir yangilikdan keyin keyingisiga o't."
      );
    }
  } catch (err) {
    console.error('Dars konteksti:', err.message);
  }
  return out;
}

async function examContext(lang, sectionId) {
  if (!['law', 'history', 'reading'].includes(sectionId)) return [];
  const { knowledge } = await baseContext(lang).catch(() => ({ knowledge: [] }));
  const kl = knowledgeLines(knowledge, 2000);
  return kl.length ? [`Eng so'nggi qoidalar (savollar shularga zid bo'lmasin):\n${kl.join('\n')}`] : [];
}

module.exports = {
  setup,
  getNews,
  refreshRules,
  startSchedule,
  lessonContext,
  examContext,
  clearCache: () => contextCache.clear(),
  LANGS,
};
