// Imtihonga tayyorgarlik: og'zaki sinov (Speaking mock) va yozma ish tekshiruvi — 4 til uchun.
// IELTS (ingliz) — band 0-9; ТРКИ / Goethe / TOPIK — CEFR shkalasi (1 = A1 ... 6 = C2).
const PREP = require('../public/prep-data.js');
const { LANGUAGES } = require('./prompt');

// Uzunlik prompt'da aytiladi va serverda tekshiriladi (structured outputs minItems>1 ni qo'llamaydi).
const strArr = { type: 'array', items: { type: 'string' } };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

const SCALE_TEXT = {
  band: "band — 0 dan 9 gacha, faqat butun yoki .5 (masalan 5.5, 6, 6.5) — rasmiy IELTS band descriptors (public version) bo'yicha.",
  cefr: "band — CEFR darajasi raqam bilan: 1 = A1, 2 = A2, 3 = B1, 4 = B2, 5 = C1, 6 = C2; .5 — shu darajaning yuqori qismi (masalan 3.5 = B1+). 0 — javob yo'q yoki tushunarsiz.",
};

const levelOf = (level) => (PREP.LEVELS.includes(level) ? level : 'B1');

// ---------- Og'zaki sinov ----------

const SPEAK_TEST_SCHEMA = obj({
  part1: obj({ topic: { type: 'string' }, questions: strArr, questions_uz: strArr }),
  part2: obj({ task: { type: 'string' }, task_uz: { type: 'string' }, bullets: strArr, followup: { type: 'string' } }),
  part3: obj({ topic: { type: 'string' }, questions: strArr, questions_uz: strArr }),
});

function speakTestPrompt(lang, level) {
  const e = PREP.EXAMS[lang];
  const lv = levelOf(level);
  const common = [
    `Savollar faqat ${LANGUAGES[lang]}da. questions_uz — har savolning o'zbekcha tarjimasi (xuddi shu tartibda). Siyosat, din va shaxsiy og'riqli mavzulardan qoch. Har safar boshqa mavzu tanla.`,
  ];
  if (lang === 'en') {
    return [
      "Sen IELTS Speaking imtihonining tajribali imtihon oluvchisisan (examiner). Haqiqiy imtihonga iloji boricha o'xshash bitta to'liq SINOV savollar to'plamini tuz.",
      "- part1 — Introduction & interview: kundalik tanish mavzu (hometown, work/study, food, weather, music, free time, sleep, shopping...). topic — mavzu nomi inglizcha; questions — 4 ta qisqa, tabiiy savol.",
      "- part2 — Long turn (cue card): task — «Describe a ...» shaklidagi topshiriq; task_uz — o'zbekcha tarjimasi; bullets — rasmiy formatdagi 4 ta nuqta: 3 tasi (what/where/when/who...) va oxirgisi «and explain ...». followup — gap tugagach beriladigan 1 ta qisqa savol.",
      "- part3 — Discussion: part2 mavzusi bilan bog'liq, umumiyroq, jamiyat darajasidagi 4 ta savol (solishtirish, sabab, kelajak, fikr). topic — inglizcha qisqa nom.",
      ...common,
    ].join('\n');
  }
  return [
    `Sen ${e.exam} imtihonining og'zaki qismini o'tkazadigan tajribali imtihon oluvchisan. O'zbek tilida so'zlashuvchi o'quvchi uchun ${lv} darajasiga mos, haqiqiy imtihonga o'xshash bitta SINOV og'zaki imtihon savollarini tuz.`,
    `- part1 — tanishuv: kundalik tanish mavzu (oila, ish/o'qish, shahar, bo'sh vaqt, ovqat...). topic — mavzu nomi ${LANGUAGES[lang]}da; questions — ${lv} darajasiga mos 4 ta qisqa savol.`,
    `- part2 — monolog: task — ${LANGUAGES[lang]}da mavzu (masalan «Расскажите о...», «Erzählen Sie von...», «...에 대해 이야기해 보세요»); task_uz — o'zbekcha tarjimasi; bullets — monologda aytilishi kerak bo'lgan 4 ta nuqta (${LANGUAGES[lang]}da). followup — monologdan keyin 1 ta qisqa savol.`,
    `- part3 — suhbat: part2 mavzusi bilan bog'liq 4 ta savol — fikr, solishtirish, sabab (${lv} darajasidan biroz qiyinroq bo'lishi mumkin). topic — qisqa nom.`,
    lv === 'A1' || lv === 'A2' ? "Boshlang'ich daraja: savollar juda sodda, qisqa, kundalik so'zlar bilan bo'lsin." : '',
    ...common,
  ]
    .filter(Boolean)
    .join('\n');
}

const crit = obj({ band: { type: 'number' }, comment: { type: 'string' } });
const mistakes = { type: 'array', items: obj({ wrong: { type: 'string' }, correct: { type: 'string' }, explanation: { type: 'string' } }) };
const vocab = { type: 'array', items: obj({ word: { type: 'string' }, translation: { type: 'string' } }) };

const SPEAK_GRADE_SCHEMA = obj({
  fluency: crit,
  lexical: crit,
  grammar: crit,
  pronunciation: crit,
  summary: { type: 'string' },
  tips: strArr,
  mistakes,
  better: obj({ question: { type: 'string' }, answer: { type: 'string' } }),
  vocab,
});

function speakGradePrompt(lang, level) {
  const e = PREP.EXAMS[lang];
  const band = e.scale === 'band';
  return [
    band
      ? "Sen sertifikatlangan, adolatli IELTS Speaking imtihon oluvchisisan. O'zbek tilida so'zlashuvchi o'quvchining sinov imtihonidagi javoblarini rasmiy IELTS Speaking band descriptors bo'yicha bahola."
      : `Sen ${e.exam} imtihonining tajribali, adolatli imtihon oluvchisisan. O'zbek tilida so'zlashuvchi o'quvchining ${LANGUAGES[lang]}dagi og'zaki javoblarini CEFR mezonlari bo'yicha bahola. O'quvchi ${levelOf(level)} darajasiga tayyorlanmoqda, lekin javoblar qaysi darajani ko'rsatsa, shuni qo'y.`,
    "Javoblarni nutqni tanish dasturi yozib olgan: tinish belgilari, katta-kichik harf va ba'zi noto'g'ri tanilgan so'zlarni o'quvchining xatosi deb hisoblama. Har javob yonida o'lchangan ko'rsatkichlar bor: davomiyligi, so'z soni, daqiqasiga so'z (WPM), uzun to'xtashlar, to'ldiruvchi so'zlar va tanish ishonchi.",
    "4 mezon: fluency — ravonlik va bog'liqlik (bog'lovchilar, javob uzunligi, to'xtashlar); lexical — so'z boyligi (iboralar, aniq so'zlar); grammar — grammatika (gap tuzilishi, zamonlar, xatolar soni); pronunciation — talaffuz.",
    "Pronunciation'ni faqat matn va dastur ishonchiga qarab TAXMINIY baholaysan (talaffuz ko'p noto'g'ri tanilgan bo'lsa — past). comment'da buni «taxminiy» deb ayt.",
    SCALE_TEXT[e.scale],
    "Haqiqatga yaqin va qattiqqo'l bo'l: qisqa (1-2 gaplik) javoblar, juda ko'p to'xtash yoki bo'sh javoblar bahoni pasaytiradi. 2-qism (monolog) 1 daqiqadan qisqa bo'lsa, fluency yuqori bo'lmasin.",
    "comment — har mezon uchun o'zbekcha 1-2 gap: nimasi yaxshi va keyingi darajaga chiqish uchun nima kerak (aniq misol bilan).",
    "summary — o'zbekcha 2-3 gaplik umumiy xulosa. tips — keyingi darajaga chiqish uchun 3-4 ta aniq maslahat (o'zbekcha).",
    `mistakes — eng muhim 3-6 ta grammatik yoki so'z xatosi: wrong — o'quvchi aytgan bo'lak, correct — to'g'risi (${LANGUAGES[lang]}da), explanation — o'zbekcha qisqa izoh. Tanish dasturi xatolarini kiritma.`,
    `better — o'quvchi eng zaif javob bergan savollardan biri (question) va unga ${band ? '7.5+ band' : "bir daraja yuqori (masalan B2)"} namunaviy javob (answer, ${LANGUAGES[lang]}da, 4-6 gap, tabiiy og'zaki uslubda).`,
    `vocab — shu mavzularga mos 5 ta foydali so'z yoki ibora (word — ${LANGUAGES[lang]}da, translation — o'zbekcha).`,
  ].join('\n');
}

// ---------- Yozma ish ----------

const WRITE_TASK_SCHEMA = obj({ task: { type: 'string' }, task_uz: { type: 'string' }, points: strArr });

function writeKind(lang, kind) {
  const list = PREP.EXAMS[lang].writing;
  return list.find((k) => k.id === kind) || list[0];
}

function writeTaskPrompt(lang, level, kind) {
  const e = PREP.EXAMS[lang];
  const k = writeKind(lang, kind);
  return [
    `Sen ${e.exam} imtihonining yozma qismini tuzuvchi tajribali mutaxassissan. O'zbek tilida so'zlashuvchi o'quvchi uchun haqiqiy imtihonga o'xshash bitta SINOV yozma topshiriq tuz.`,
    `Format: ${k.format}`,
    lang === 'en' ? '' : `Daraja: ${levelOf(level)} — topshiriq shu darajaga mos bo'lsin.`,
    `task — topshiriq matni ${LANGUAGES[lang]}da, haqiqiy imtihondagidek (vaziyat yoki savol). task_uz — uning o'zbekcha tarjimasi. points — javobda bo'lishi kerak bo'lgan 3 ta nuqta (o'zbekcha, qisqa). Har safar yangi mavzu; siyosat va din mavzularidan qoch.`,
  ]
    .filter(Boolean)
    .join('\n');
}

const WRITE_GRADE_SCHEMA = obj({
  task: crit,
  coherence: crit,
  lexical: crit,
  grammar: crit,
  summary: { type: 'string' },
  tips: strArr,
  mistakes,
  corrected: { type: 'string' },
  vocab,
});

function writeGradePrompt(lang, level, kind) {
  const e = PREP.EXAMS[lang];
  const k = writeKind(lang, kind);
  const band = e.scale === 'band';
  return [
    band
      ? `Sen sertifikatlangan, adolatli IELTS Writing imtihon oluvchisisan. O'quvchining ishini rasmiy IELTS Writing band descriptors (${k.id === 'task2' ? 'Task 2' : 'Task 1 General Training'}) bo'yicha bahola.`
      : `Sen ${e.exam} imtihonining yozma qismini baholovchi tajribali imtihon oluvchisisan. O'quvchining ${LANGUAGES[lang]}dagi yozma ishini CEFR mezonlari bo'yicha bahola. O'quvchi ${levelOf(level)} darajasiga tayyorlanmoqda, lekin ish qaysi darajani ko'rsatsa, shuni qo'y.`,
    `Topshiriq turi: ${k.format} Tavsiya etilgan hajm: kamida ${k.minWords} so'z.`,
    `4 mezon: task — ${band ? 'Task Response / Task Achievement' : 'topshiriqni bajarish'} (barcha nuqtalar yoritilganmi, fikr aniqmi, hajm yetarlimi); coherence — tuzilish va bog'liqlik (paragraflar, bog'lovchilar, mantiq); lexical — so'z boyligi; grammar — grammatika xilma-xilligi va to'g'riligi.`,
    SCALE_TEXT[e.scale],
    `Qattiqqo'l va haqiqatga yaqin bo'l. Hajm tavsiya etilganidan ancha kam bo'lsa — task past. Mavzuga aloqasiz yoki bo'sh ish — 0-2${band ? '' : ' (A0-A1)'}.`,
    "comment — har mezon uchun o'zbekcha 1-2 gap: nimasi yaxshi va keyingi darajaga chiqish uchun nima kerak (aniq misol bilan).",
    "summary — o'zbekcha 2-3 gaplik umumiy xulosa. tips — keyingi darajaga chiqish uchun 3-4 ta aniq maslahat (o'zbekcha).",
    `mistakes — eng muhim 3-8 ta xato: wrong — o'quvchi yozgan bo'lak, correct — to'g'risi (${LANGUAGES[lang]}da), explanation — o'zbekcha qisqa izoh.`,
    `corrected — o'quvchi ishining to'liq tuzatilgan va biroz yaxshilangan varianti (${LANGUAGES[lang]}da), o'quvchining fikri va tuzilishi saqlangan holda; ${band ? 'Band 7.5+' : 'bir daraja yuqori'} uslubda.`,
    `vocab — shu mavzuga mos 5 ta foydali so'z yoki ibora (word — ${LANGUAGES[lang]}da, translation — o'zbekcha).`,
  ].join('\n');
}

// Baho shkalada qoladi va 0.5 ga yaxlitlanadi.
const clamp = (scale, v) => Math.max(0, Math.min(PREP.maxOf(scale), Math.round((Number(v) || 0) * 2) / 2));

module.exports = {
  PREP,
  levelOf,
  writeKind,
  SPEAK_TEST_SCHEMA,
  speakTestPrompt,
  SPEAK_GRADE_SCHEMA,
  speakGradePrompt,
  WRITE_TASK_SCHEMA,
  writeTaskPrompt,
  WRITE_GRADE_SCHEMA,
  writeGradePrompt,
  clamp,
};
