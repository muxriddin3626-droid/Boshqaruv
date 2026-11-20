// IELTS Speaking sinov imtihoni: 3 qismli savollar va rasmiy 4 mezon bo'yicha band ball.

// Uzunlik prompt'da aytiladi va serverda tekshiriladi (structured outputs minItems>1 ni qo'llamaydi).
const strArr = () => ({ type: 'array', items: { type: 'string' } });

const TEST_SCHEMA = {
  type: 'object',
  properties: {
    part1: {
      type: 'object',
      properties: { topic: { type: 'string' }, questions: strArr(4) },
      required: ['topic', 'questions'],
      additionalProperties: false,
    },
    part2: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        task_uz: { type: 'string' },
        bullets: strArr(4),
        followup: { type: 'string' },
      },
      required: ['task', 'task_uz', 'bullets', 'followup'],
      additionalProperties: false,
    },
    part3: {
      type: 'object',
      properties: { topic: { type: 'string' }, questions: strArr(4) },
      required: ['topic', 'questions'],
      additionalProperties: false,
    },
  },
  required: ['part1', 'part2', 'part3'],
  additionalProperties: false,
};

const TEST_PROMPT = [
  "Sen IELTS Speaking imtihonining tajribali imtihon oluvchisisan (examiner). Haqiqiy imtihonga iloji boricha o'xshash bitta to'liq SINOV savollar to'plamini tuz.",
  "- part1 — Introduction & interview: kundalik tanish mavzu (masalan: hometown, work/study, food, weather, music, free time, sleep, shopping — har safar boshqasi). topic — mavzu nomi inglizcha; questions — shu mavzuda 4 ta qisqa, tabiiy savol.",
  "- part2 — Long turn (cue card): task — «Describe a ...» shaklidagi topshiriq; task_uz — uning o'zbekcha tarjimasi; bullets — rasmiy formatdagi 4 ta nuqta: «You should say:» dan keyingi 3 ta (what/where/when/who...) va oxirgisi «and explain ...». followup — gap tugagach beriladigan 1 ta qisqa savol.",
  "- part3 — Discussion: part2 mavzusi bilan bog'liq, ammo umumiyroq, jamiyat darajasidagi 4 ta savol (solishtirish, sabab, kelajak, fikr). topic — inglizcha qisqa nom.",
  "Savollar faqat ingliz tilida, haqiqiy IELTS uslubida. Siyosat, din va shaxsiy og'riqli mavzulardan qoch.",
].join('\n');

const crit = {
  type: 'object',
  properties: { band: { type: 'number' }, comment: { type: 'string' } },
  required: ['band', 'comment'],
  additionalProperties: false,
};

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    fluency: crit,
    lexical: crit,
    grammar: crit,
    pronunciation: crit,
    summary: { type: 'string' },
    tips: { type: 'array', items: { type: 'string' } },
    mistakes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { wrong: { type: 'string' }, correct: { type: 'string' }, explanation: { type: 'string' } },
        required: ['wrong', 'correct', 'explanation'],
        additionalProperties: false,
      },
    },
    better: {
      type: 'object',
      properties: { question: { type: 'string' }, answer: { type: 'string' } },
      required: ['question', 'answer'],
      additionalProperties: false,
    },
    vocab: {
      type: 'array',
      items: {
        type: 'object',
        properties: { word: { type: 'string' }, translation: { type: 'string' } },
        required: ['word', 'translation'],
        additionalProperties: false,
      },
    },
  },
  required: ['fluency', 'lexical', 'grammar', 'pronunciation', 'summary', 'tips', 'mistakes', 'better', 'vocab'],
  additionalProperties: false,
};

const GRADE_PROMPT = [
  "Sen sertifikatlangan, adolatli IELTS Speaking imtihon oluvchisisan. O'zbek tilida so'zlashuvchi o'quvchining sinov imtihonidagi javoblarini rasmiy IELTS Speaking band descriptors (public version) bo'yicha bahola.",
  "Javoblarni nutqni tanish dasturi yozib olgan: tinish belgilari, katta-kichik harf va ba'zi noto'g'ri tanilgan so'zlarni o'quvchining xatosi deb hisoblama. Har javob yonida o'lchangan ko'rsatkichlar bor: davomiyligi, so'z soni, daqiqasiga so'z (WPM), uzun to'xtashlar va to'ldiruvchi so'zlar (um, uh, er, like, you know).",
  "4 mezon: fluency — Fluency and Coherence (ravonlik, bog'lovchilar, javob uzunligi, to'xtashlar); lexical — Lexical Resource (so'z boyligi, iboralar, paraphrase); grammar — Grammatical Range and Accuracy (murakkab gaplar, zamonlar, xatolar soni); pronunciation — Pronunciation.",
  "Pronunciation'ni faqat matn va dastur ishonchiga qarab TAXMINIY baholaysan (talaffuz ko'p noto'g'ri tanilgan bo'lsa — past). comment'da buni «taxminiy» deb ayt.",
  "band — 0 dan 9 gacha, faqat butun yoki .5 (masalan 5.5, 6, 6.5). Haqiqatga yaqin va qattiqqo'l bo'l: qisqa (1-2 gaplik) javoblar, juda ko'p to'xtash yoki bo'sh javoblar balni pasaytiradi. Part 2 1 daqiqadan qisqa bo'lsa Fluency 5 dan oshmasin. Bo'sh javoblar ko'p bo'lsa — 1-3.",
  "comment — har mezon uchun o'zbekcha 1-2 gap: nimasi yaxshi va bandni oshirish uchun nima kerak (aniq misol bilan).",
  "summary — o'zbekcha 2-3 gaplik umumiy xulosa. tips — keyingi bandga chiqish uchun 3-4 ta aniq maslahat (o'zbekcha).",
  "mistakes — o'quvchining eng muhim 3-6 ta grammatik yoki so'z xatosi: wrong — o'quvchi aytgan bo'lak (inglizcha), correct — to'g'risi (inglizcha), explanation — o'zbekcha qisqa izoh. Tanish dasturi xatolarini kiritma.",
  "better — o'quvchi eng zaif javob bergan savollardan biri (question) va unga 7.5+ darajadagi namunaviy javob (answer, inglizcha, 4-6 gap, tabiiy og'zaki uslubda).",
  "vocab — shu imtihon mavzulariga mos 5 ta foydali yuqori darajali so'z yoki ibora (word — inglizcha, translation — o'zbekcha).",
].join('\n');

// IELTS qoidasi: 4 mezon o'rtachasi eng yaqin 0.5 ga yaxlitlanadi (.25 → .5, .75 → keyingi butun).
function overallBand(bands) {
  const avg = bands.reduce((n, b) => n + b, 0) / bands.length;
  return Math.floor(avg * 2 + 0.5) / 2;
}

const clampBand = (v) => Math.max(0, Math.min(9, Math.round((Number(v) || 0) * 2) / 2));

module.exports = { TEST_SCHEMA, TEST_PROMPT, GRADE_SCHEMA, GRADE_PROMPT, overallBand, clampBand };
