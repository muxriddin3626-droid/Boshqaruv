const COURSE = require('../public/course.js');
const SC = require('../public/scenarios.js');

const TUTOR_PROMPT = `Sen professional va tajribali rus, nemis va koreys tili o'qituvchisisiz. Sening vazifang foydalanuvchiga rus, nemis yoki koreys tillarini jonli muloqot orqali o'rgatish.

Quyidagi qoidalarga qat'iy amal qil:
1. Til tanlash: Foydalanuvchi qaysi tilda muloqot qilishni xohlasa (rus, nemis yoki koreys tili), suhbatni o'sha tilda olib borasan.
2. Tushuntirish tili: Foydalanuvchining grammatik xatolarini, so'zlar ma'nosini va qoidalarni doimo O'ZBEK TILIDA tushuntirasan.
3. Xatolarni tuzatish: Foydalanuvchi xato gapirsa, uni darhol qo'pol bo'lmagan tarzda to'g'rilab, to'g'ri variantini o'zbek tilida qisqacha tushuntirib o'tasan.
4. Muloqot uslubi: Do'stona, sabrli va rag'batlantiruvchi tarzda muloqot qilasan. Har bir javobing oxirida suhbat davom etishi uchun foydalanuvchiga o'sha tilda qiziqarli savol berasan.
5. Daraja: Foydalanuvchining darajasiga moslash (boshlanishida oddiy so'zlar va qisqa gaplardan foydalan).

Bu OVOZLI dars: foydalanuvchi mikrofon orqali gapiradi, sening javobing esa ovoz chiqarib o'qiladi.
- Jonli suhbatdagidek qisqa gapir: bir javobda 1-4 ta qisqa gap. Uzun ro'yxat va ma'ruzalardan qoch.
- Emoji, Markdown, qavs ichidagi transliteratsiya va maxsus belgilar ishlatma — ular ovozda o'qilmaydi.
- Javobni "segments" ro'yxatiga bo'l: har bir bo'lak bitta tilda bo'lsin ("ru", "de", "ko" yoki "uz"), shunda har birini to'g'ri talaffuz bilan o'qiymiz. O'zbekcha bo'laklarni lotin yozuvida yoz.
- Foydalanuvchining gapi nutqni tanish dasturi orqali yoziladi, shuning uchun unda tinish belgilari yoki kichik xatolar bo'lishi mumkin — bunday narsalarni xato deb hisoblama, faqat aniq grammatik va so'z xatolarini tuzat.
- "mood" — yuzchaning kayfiyati, javobingga mos tanla:
  calm — oddiy suhbat; happy — foydalanuvchi to'g'ri aytdi; excited — juda yaxshi javob yoki yutuq;
  thinking — biror narsani tushuntiryapsan; surprised — kutilmagan yoki qiziq javob;
  angry — foydalanuvchi bir xil xatoni takrorladi yoki hazillashib tentaklik qildi. Bunda o'yinchoq, hazil aralash "jahl" qil, lekin hech qachon haqorat qilma va qo'pol so'z ishlatma.
- Dars foydalanuvchining "Salom" xabari bilan boshlanadi: o'zingni ismingni aytib tanishtir, mavzuni qisqa e'lon qil va birinchi oddiy savolni ber.
- "goal_reached" — faqat rolli vaziyatda ishlatiladi (pastda aytiladi); oddiy darsda doim false.`;

const LANGUAGES = {
  ru: 'rus tili',
  de: 'nemis tili',
  ko: 'koreys tili',
};

// Tilga xos qo'shimcha ko'rsatmalar.
const LANG_NOTES = {
  ko: "Koreys tilida faqat Hangul (한글) bilan yoz, romanizatsiya ishlatma. Hurmatli-norasmiy 해요체 uslubida gapir. Boshlovchiga so'z va qo'shimchalarni (은/는, 이/가, 을/를, 에, 에서) o'zbek tilidagi qo'shimchalarga qiyoslab tushuntir — so'z tartibi o'zbek tiliga o'xshashligini (ega — to'ldiruvchi — fe'l) eslatib tur.",
};

const PERSONAS = {
  ru: { name: 'Anna', about: "Moskvalik rus tili o'qituvchisi, ayol" },
  de: { name: 'Hans', about: "Berlinlik nemis tili o'qituvchisi, erkak" },
  ko: { name: 'Minji', about: "Seullik koreys tili o'qituvchisi, ayol" },
};

const MODES = {
  kind: `Mehribon ustoz rejimi: yuqoridagi qoidalardagidek juda do'stona, sabrli va iliq bo'l. Ko'p maqta, xatoni yumshoq tuzat.`,
  strict: `Qattiqqo'l ustoz rejimi: sen talabchan, o'tkir tilli va hazilkash ustozsan — xuddi kulgili videolardagi qattiqqo'l o'qituvchidek. Bu rejim 4-qoidadagi "do'stona" ohangni almashtiradi:
- Xato qilinsa, hazil aralash koyi ("Yana-a? Buni hozirgina o'tdik-ku!"), takroriy xatoda "angry", kutilmagan xatoda "surprised" kayfiyatini tanla.
- Maqtovni kam, lekin o'rinli ber — haqiqatan yaxshi javobga "excited".
- Hech qachon haqorat qilma, so'kinma, shaxsiyatga, tashqi ko'rinishga yoki millatga tegma — jahling o'yinchoq va kulgili bo'lsin.
- Xatoni baribir o'zbek tilida aniq tushuntir va oxirida savol ber.`,
};

const TOPICS = {
  free: 'Erkin suhbat — foydalanuvchiga qiziq bo\'lgan har qanday mavzu',
  meet: 'Tanishuv — ism, yosh, qayerdan, oila, sevimli mashg\'ulotlar',
  shop: "Do'konda xarid — narx so'rash, kiyim va oziq-ovqat sotib olish",
  food: 'Restoranda — taom buyurtma qilish, hisob so\'rash',
  travel: "Sayohat — aeroport, mehmonxona, yo'l so'rash",
  job: "Ish suhbati — o'zini tanishtirish, tajriba, kuchli tomonlar",
  migrant:
    "Chet elda ishlovchi migrant hayoti (Rossiya, Germaniya yoki Janubiy Koreyada — tanlangan tilga qarab) — politsiya hujjat tekshiruvi, ish beruvchi bilan suhbat va ish haqi, migratsiya xizmati (Rossiyada MFC/МВД, Germaniyada Ausländerbehörde, Koreyada 출입국관리사무소 va 고용센터), shifokor, kvartira ijarasi, bank va pul o'tkazmasi. Amaliy, kundalik iboralar.",
};

const LEVELS = {
  auto: "Foydalanuvchi o'z darajasini bilmaydi. Dastlabki 3-4 savolda oddiydan qiyinga qarab uning darajasini aniqla, so'ng o'zbek tilida taxminiy darajasini (A1, A2, B1...) aytib, shu darajada davom et.",
  a1: "Boshlang'ich (A1): juda oddiy so'zlar, 3-6 so'zli gaplar, sekin va aniq.",
  b1: "O'rta (A2-B1): kundalik mavzular, oddiy o'tgan va kelasi zamon.",
  b2: "Yuqori (B2+): tabiiy tezlikda, idiomalar va murakkab grammatika bilan.",
};

// Kurs bosqichi tanlangan bo'lsa, mavzu va daraja o'sha bosqichdan olinadi.
function topicLines(lang, settings, levels) {
  const unit = settings.unit && COURSE.byId(settings.unit);
  if (unit) {
    return [
      `Kurs bosqichi: "${unit.title}" (${unit.level}). Mavzu: ${unit.topic}.`,
      `Shu bosqichning grammatikasi: ${unit.grammar[lang]}. Mashqda shu grammatikani albatta ishlat.`,
      `Daraja: ${unit.level}.`,
    ];
  }
  const found = settings.prof && SC.findTheme(settings.prof);
  if (found) {
    return [
      `Kasbiy kurs: ${found.prof.title}. Mavzu: "${found.theme.title}" — ${found.theme.topic}. O'quvchi chet elda shu kasbda ishlaydi yoki ishlamoqchi: ish joyida kerak bo'ladigan amaliy so'z va iboralarni o'rgat.`,
      `Daraja: ${levels[settings.level]}`,
    ];
  }
  return [`Mavzu: ${TOPICS[settings.topic]}.`, `Daraja: ${levels[settings.level]}`];
}

// Rolli vaziyat: ustoz rolni o'ynaydi, o'quvchi maqsadga erishishga harakat qiladi.
function roleplayLines(scenario) {
  return [
    `ROLLI VAZIYAT: "${scenario.title}". Bu safar sen oddiy ustoz emassan — quyidagi rolni o'ynaysan: ${scenario.role}.`,
    `O'quvchining maqsadi: ${scenario.goal}.`,
    [
      'Qoidalar:',
      `- Rolda qol: qisqa (1-2 gap), tabiiy, faqat o'rganilayotgan tilda gapir. Haqiqiy hayotdagidek savol ber, aniqlashtir, kerak bo'lsa biroz qiyinchilik tug'dir, lekin o'quvchi to'g'ri harakat qilsa — yon ber.`,
      `- Xatolarni darhol tuzatma (ular dars oxiridagi hisobotda tuzatiladi). Faqat o'quvchi tushunmasa, 'yordam' so'rasa yoki o'zbekcha gapirsa — bitta qisqa 'uz' segmentida qanday aytish mumkinligini maslahat ber, so'ng rolga qayt.`,
      `- Birinchi javobingda salomlashishni kutma: darhol rolingdagi birinchi gap bilan vaziyatni boshla (masalan, politsiyachi: «Здравствуйте, ваши документы, пожалуйста»).`,
      `- mood: rolingga mos (qattiq politsiyachi — calm yoki angry, xursand mijoz — happy).`,
      `- O'quvchi maqsadga to'liq erishganda goal_reached: true qo'y va rolni yakunlovchi qisqa gap ayt, oxirida bitta 'uz' segmentida tabrikla. Aks holda goal_reached: false.`,
      `- Har javob oxirida savol berish shart emas — rolga mos bo'lsa bo'ldi.`,
    ].join('\n'),
  ];
}

function memoryLines(memory) {
  if (!memory || (!memory.lessons && !memory.mistakes.length && !memory.words.length)) {
    return ["Bu o'quvchi bilan birinchi darsing."];
  }
  const lines = [`Bu o'quvchi bilan oldin ${memory.lessons} ta ovozli dars o'tgansan — sen uni eslaysan.`];
  if (memory.summary) lines.push(`O'tgan darsdan xulosa: ${memory.summary}`);
  if (memory.level) lines.push(`O'tgan safar taxminiy darajasi: ${memory.level}.`);
  if (memory.mistakes.length) {
    lines.push(
      "Uning oldingi xatolari (darsda tabiiy tarzda qayta mashq qildir: o'sha shakl kerak bo'ladigan savollar ber, to'g'ri aytsa — maqta, yana xato qilsa — o'tgan safar ham shunday bo'lganini hazil aralash eslat):\n" +
        memory.mistakes.map((m) => `- ${m}`).join('\n')
    );
  }
  if (memory.words.length) lines.push(`U yaxshi yodlamagan so'zlar (suhbatda ishlatib, takrorlat): ${memory.words.join(', ')}.`);
  lines.push("Darsni boshlaganda o'quvchini qaytgani bilan qisqa tabrikla va o'tgan darsni bir gap bilan eslatib o't.");
  return lines;
}

// Ro'yxatdan o'tish anketasidan o'quvchi haqida.
const PROFILE_TEXT = {
  age: { u18: '18 yoshgacha', '18_25': '18-25 yosh', '26_35': '26-35 yosh', '36_50': '36-50 yosh', '50p': "50 yoshdan katta" },
  goal: {
    patent: 'Rossiyada ishlash uchun patent olish',
    eps: "Janubiy Koreyada ishlash (EPS-TOPIK imtihoni orqali)",
    work: 'chet elda ishlash',
    study: "o'qish",
    family: "oila, ko'chib o'tish",
    exam: 'til imtihonini topshirish',
    travel: 'sayohat',
    self: "o'zi uchun",
  },
  prof: {
    builder: 'quruvchi', driver: 'haydovchi', cook: 'oshpaz yoki ofitsiant', seller: 'sotuvchi yoki kassir',
    courier: 'kuryer yoki omborchi', nurse: 'hamshira yoki parvarishchi', factory: 'zavod ishchisi',
    cleaner: 'tozalash xizmati', student: 'talaba', other: '',
  },
  interests: {
    football: 'futbol', sport: 'sport', films: 'kino', music: 'musiqa', food: 'ovqat va oshpazlik', travel: 'sayohat',
    tech: 'texnologiya', cars: 'mashinalar', family: 'oila', nature: 'tabiat', books: 'kitoblar', games: "o'yinlar",
  },
};

function profileLines(profile) {
  if (!profile) return [];
  const parts = [];
  if (profile.name) parts.push(`ismi ${profile.name}`);
  if (profile.age) parts.push(PROFILE_TEXT.age[profile.age]);
  if (profile.city) parts.push(`${profile.city}dan`);
  if (profile.goal) parts.push(`maqsadi: ${PROFILE_TEXT.goal[profile.goal]}`);
  if (profile.prof && PROFILE_TEXT.prof[profile.prof]) parts.push(`kasbi: ${PROFILE_TEXT.prof[profile.prof]}`);
  const interests = (profile.interests || []).map((i) => PROFILE_TEXT.interests[i]).filter(Boolean);
  if (interests.length) parts.push(`qiziqishlari: ${interests.join(', ')}`);
  if (!parts.length) return [];
  return [
    `O'quvchi haqida (ro'yxatdan o'tishdagi anketadan): ${parts.join('; ')}.`,
    "Unga ismi bilan murojaat qil, misol va savollarni uning maqsadi, kasbi va qiziqishlariga yaqin qil (lekin har gapda emas, tabiiy).",
  ];
}

function sessionPrompt(lang, settings, memory, profile) {
  const p = PERSONAS[lang];
  const scenario = settings.scenario && SC.findScenario(settings.scenario);
  if (scenario) {
    return [
      `Foydalanuvchi tanlagan til: ${LANGUAGES[lang]}. Suhbatni shu tilda olib bor.`,
      LANG_NOTES[lang] || '',
      `Sening asl isming ${p.name} (ustoz), lekin hozir rol o'ynaysan.`,
      ...roleplayLines(scenario),
      `Foydalanuvchi darajasi: ${LEVELS[settings.level]} Darajaga mos so'zlar ishlat.`,
      ...profileLines(profile),
    ].filter(Boolean).join('\n\n');
  }
  const [topic, ...rest] = topicLines(lang, settings, LEVELS);
  return [
    `Foydalanuvchi tanlagan til: ${LANGUAGES[lang]}. Suhbatni shu tilda olib bor.`,
    LANG_NOTES[lang] || '',
    `Sening isming ${p.name}, sen ${p.about}.`,
    MODES[settings.mode],
    `${topic} Suhbatni shu mavzu atrofida olib bor, rolli o'yin qilsa ham bo'ladi.`,
    ...rest,
    ...profileLines(profile),
    memoryLines(memory).join('\n'),
  ].filter(Boolean).join('\n\n');
}

const MOODS = ['calm', 'happy', 'excited', 'thinking', 'surprised', 'angry'];

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    mood: { type: 'string', enum: MOODS },
    goal_reached: { type: 'boolean' },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lang: { type: 'string', enum: ['ru', 'de', 'ko', 'uz'] },
          text: { type: 'string' },
        },
        required: ['lang', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['mood', 'segments', 'goal_reached'],
  additionalProperties: false,
};

const REPORT_PROMPT = `Sen tajribali til o'qituvchisisan. Senga o'quvchi bilan o'tgan ovozli darsning yozuvi beriladi. O'quvchining gaplari nutqni tanish dasturi orqali yozilgan, shuning uchun tinish belgilari va katta-kichik harf xatolarini hisobga olma.

O'ZBEK TILIDA (lotin yozuvida) qisqa hisobot tayyorla:
- summary: 1-2 gap — nimalar haqida gaplashildi va o'quvchi qanday ishladi. Rag'batlantiruvchi bo'lsin.
- level: o'quvchining taxminiy CEFR darajasi, masalan "A1" yoki "A2".
- mistakes: o'quvchining eng muhim xatolari, ko'pi bilan 6 ta. wrong — o'quvchi aytgan variant, correct — to'g'ri variant, explanation — o'zbekcha bir gaplik izoh. Xato bo'lmasa, bo'sh ro'yxat.
- words: darsda uchragan, o'quvchiga foydali yangi so'z yoki iboralar, ko'pi bilan 8 ta, o'zbekcha tarjimasi bilan.
- tip: keyingi dars uchun bitta aniq maslahat.
- score: dars natijasi 0 dan 100 gacha butun son (topshiriq yoki maqsadga erishish, til sifati, ravonlik). Rolli vaziyat bo'lsa, asosan o'quvchi maqsadga qanchalik erishgani va qanchalik tushunarli gapirganiga qarab bahola.`;

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    level: { type: 'string' },
    mistakes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          wrong: { type: 'string' },
          correct: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['wrong', 'correct', 'explanation'],
        additionalProperties: false,
      },
    },
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          translation: { type: 'string' },
        },
        required: ['word', 'translation'],
        additionalProperties: false,
      },
    },
    tip: { type: 'string' },
    score: { type: 'integer' },
  },
  required: ['summary', 'level', 'mistakes', 'words', 'tip', 'score'],
  additionalProperties: false,
};

// ---------- O'yinlar va testlar ----------

const GAME_LEVELS = {
  auto: 'A1-A2 (boshlovchi va biroz bilgan o\'quvchi uchun aralash)',
  a1: "A1 (boshlang'ich)",
  b1: "A2-B1 (o'rta)",
  b2: 'B2+ (yuqori)',
};

const GAMES = {
  quiz: {
    count: 8,
    task: `8 ta test savoli tuz. Aralash bo'lsin: so'z ma'nosi, grammatika (kelishik, artikl, fe'l shakli, zamon) va bo'sh joyni to'ldirish (bo'sh joyni ___ bilan belgila). Savol matni o'zbekcha yoki o'rganilayotgan tilda bo'lishi mumkin.
- question: savol matni
- correct: yagona to'g'ri javob
- wrong: 3 ta ishonarli, lekin aniq noto'g'ri javob
- explanation: nega shu javob to'g'ri — o'zbekcha bir-ikki gap`,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              correct: { type: 'string' },
              wrong: { type: 'array', items: { type: 'string' } },
              explanation: { type: 'string' },
            },
            required: ['question', 'correct', 'wrong', 'explanation'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
  match: {
    count: 8,
    task: `8 ta so'z yoki qisqa ibora va ularning o'zbekcha tarjimasini ber. Tarjimalar bir-biriga o'xshamasin, har biri faqat bitta so'zga mos kelsin.
- word: o'rganilayotgan tildagi so'z (nemis otlari artikli bilan, masalan "der Tisch"; koreyscha — Hangul bilan)
- translation: o'zbekcha tarjima`,
    schema: {
      type: 'object',
      properties: {
        pairs: {
          type: 'array',
          items: {
            type: 'object',
            properties: { word: { type: 'string' }, translation: { type: 'string' } },
            required: ['word', 'translation'],
            additionalProperties: false,
          },
        },
      },
      required: ['pairs'],
      additionalProperties: false,
    },
  },
  order: {
    count: 6,
    task: `O'rganilayotgan tilda 6 ta gap ber (darajaga qarab 3-9 so'zli). So'zlar tartibi bir ma'noli bo'lsin — boshqa tartibda ham to'g'ri bo'ladigan gaplarni berma.
- sentence: gap
- translation: gapning o'zbekcha tarjimasi`,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { sentence: { type: 'string' }, translation: { type: 'string' } },
            required: ['sentence', 'translation'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
  listen: {
    count: 8,
    task: `Eshitib topish mashqi uchun 8 ta so'z yoki qisqa ibora ber. O'quvchi ovozni eshitadi va 4 ta variantdan eshitganini tanlaydi.
- text: o'rganilayotgan tildagi so'z yoki ibora (ovoz chiqarib o'qiladi)
- translation: o'zbekcha tarjimasi
- wrong: o'rganilayotgan tildagi 3 ta talaffuzi yoki yozilishi o'xshash, lekin boshqa so'z`,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              translation: { type: 'string' },
              wrong: { type: 'array', items: { type: 'string' } },
            },
            required: ['text', 'translation', 'wrong'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
  speak: {
    count: 6,
    task: `Talaffuz mashqi uchun o'rganilayotgan tilda 6 ta qisqa ibora yoki gap ber (darajaga qarab 2-8 so'z). O'quvchi ularni ovoz chiqarib takrorlaydi. Talaffuzi qiyin tovushli so'zlarni ham qo'sh. Raqamlarni so'z bilan yoz.
- text: ibora yoki gap
- translation: o'zbekcha tarjimasi
- tip: talaffuz bo'yicha qisqa o'zbekcha maslahat (qaysi tovushga e'tibor berish, urg'u qayerda)`,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { text: { type: 'string' }, translation: { type: 'string' }, tip: { type: 'string' } },
            required: ['text', 'translation', 'tip'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
  story: {
    count: 8,
    task: `O'quvchi darajasiga mos qisqa, qiziqarli hikoya yoki dialog yoz (6-8 gap). Oxirida kutilmagan yoki kulgili burilish bo'lsa yaxshi.
- title: hikoya nomi (o'rganilayotgan tilda), title_uz: o'zbekcha nomi
- sentences: gaplar ro'yxati. Har birida text (gap), translation (o'zbekcha tarjima) va words — shu gapdagi o'quvchi bilmasligi mumkin bo'lgan 1-4 ta so'z: form (matnda qanday yozilgan bo'lsa, aynan shunday), base (lug'at shakli), translation (o'zbekcha)
- questions: hikoya bo'yicha 3 ta tushunish savoli (o'zbekcha savol, javoblar o'rganilayotgan tilda yoki o'zbekcha): question, correct, wrong (3 ta noto'g'ri)`,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        title_uz: { type: 'string' },
        sentences: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              translation: { type: 'string' },
              words: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { form: { type: 'string' }, base: { type: 'string' }, translation: { type: 'string' } },
                  required: ['form', 'base', 'translation'],
                  additionalProperties: false,
                },
              },
            },
            required: ['text', 'translation', 'words'],
            additionalProperties: false,
          },
        },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              correct: { type: 'string' },
              wrong: { type: 'array', items: { type: 'string' } },
            },
            required: ['question', 'correct', 'wrong'],
            additionalProperties: false,
          },
        },
      },
      required: ['title', 'title_uz', 'sentences', 'questions'],
      additionalProperties: false,
    },
  },
};

function gamePrompt(lang, type, settings, focus, profile) {
  const parts = [
    `Sen tajribali ${LANGUAGES[lang]} o'qituvchisisan va o'zbek tilida so'zlashuvchi o'quvchi uchun qiziqarli mashq tuzasan.`,
    LANG_NOTES[lang] || '',
    ...topicLines(lang, settings, GAME_LEVELS),
    "Barcha izoh va tarjimalar o'zbek tilida, lotin yozuvida bo'lsin. Har bir savolning faqat bitta to'g'ri javobi bo'lsin. Har safar yangi, takrorlanmaydigan misollar o'yla.",
    GAMES[type].task,
  ];
  const interests = ((profile && profile.interests) || []).map((i) => PROFILE_TEXT.interests[i]).filter(Boolean);
  if (interests.length && !settings.exam) {
    parts.push(`O'quvchining qiziqishlari: ${interests.join(', ')}. Mavzuga mos kelsa, ba'zi misollarni shulardan ol.`);
  }
  if (settings.exam) {
    parts.push("Bu bosqich IMTIHONI: savollar faqat shu bosqich mavzusi va grammatikasi bo'yicha bo'lsin, osondan qiyinga qarab.");
  } else if (focus.words.length || focus.mistakes.length) {
    parts.push(
      "O'quvchi quyidagi so'zlarni hali yaxshi yodlamagan yoki shu xatolarni qilgan. Agar mavzuga mos kelsa, mashqning bir qismini shularni takrorlashga bag'ishla:\n" +
        [...focus.words.map((w) => `- so'z: ${w}`), ...focus.mistakes.map((m) => `- xato: ${m}`)].join('\n')
    );
  }
  return parts.filter(Boolean).join('\n\n');
}

// ---------- Sinov imtihonlari ----------

const EXAMS = require('../public/exams.js');

const CHOICE_SCHEMA = {
  type: 'object',
  properties: {
    instructions_uz: { type: 'string' },
    passages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          text: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                correct: { type: 'string' },
                wrong: { type: 'array', items: { type: 'string' } },
                explanation: { type: 'string' },
              },
              required: ['question', 'correct', 'wrong', 'explanation'],
              additionalProperties: false,
            },
          },
        },
        required: ['title', 'text', 'questions'],
        additionalProperties: false,
      },
    },
  },
  required: ['instructions_uz', 'passages'],
  additionalProperties: false,
};

const WRITING_SCHEMA = {
  type: 'object',
  properties: {
    instructions_uz: { type: 'string' },
    task: { type: 'string' },
    task_uz: { type: 'string' },
    points: { type: 'array', items: { type: 'string' } },
    min_words: { type: 'integer' },
  },
  required: ['instructions_uz', 'task', 'task_uz', 'points', 'min_words'],
  additionalProperties: false,
};

const SPEAKING_SCHEMA = {
  type: 'object',
  properties: {
    instructions_uz: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { prompt: { type: 'string' }, prompt_uz: { type: 'string' } },
        required: ['prompt', 'prompt_uz'],
        additionalProperties: false,
      },
    },
  },
  required: ['instructions_uz', 'tasks'],
  additionalProperties: false,
};

const SECTION_TASKS = {
  grammar: `1 ta passage ber: title bo'sh qolishi mumkin, text — bo'sh satr (""). questions — 10 ta gap; har birida bo'sh joy ___ bilan belgilangan, correct — to'g'ri shakl, wrong — 3 ta noto'g'ri shakl.`,
  reading: `2-3 ta passage ber: har birida title va o'rganilayotgan tildagi matn (darajaga mos uzunlikda), va 3-4 ta savol. Savollar o'rganilayotgan tilda; correct — to'g'ri javob, wrong — 2 ta noto'g'ri javob. Jami 9-10 ta savol.`,
  listening: `3-4 ta passage ber: text — ovoz chiqarib o'qiladigan dialog yoki e'lon (dialogda gapiruvchilarni "— " bilan boshla, ism yozma). title — vaziyat (masalan "Vokzalda"). Har biriga 2-3 ta savol, o'rganilayotgan tilda; wrong — 2 ta noto'g'ri javob. Jami 8-10 ta savol. Javobni faqat eshitib bilsa bo'ladigan qil.`,
  history: `1 ta passage ber: title bo'sh, text — bo'sh satr (""). questions — 8 ta savol, o'rganilayotgan tilda (rus tilida, oddiy so'zlar bilan); correct — to'g'ri javob, wrong — 2 ta noto'g'ri javob. Faqat aniq va umumqabul qilingan faktlar haqida so'ra (davlat ramzlari, poytaxt, bayramlar sanasi, mashhur shaxslar, mashhur tarixiy voqealar). Munozarali siyosiy mavzular va so'nggi yillar voqealaridan qoch.`,
  law: `1 ta passage ber: title bo'sh, text — bo'sh satr (""). questions — 8 ta savol, rus tilida, oddiy so'zlar bilan; correct — to'g'ri javob, wrong — 2 ta noto'g'ri javob. Barqaror umumiy qoidalar haqida so'ra: huquq va majburiyatlar, ishlash uchun patent yoki ruxsatnoma kerakligi, mehnat shartnomasi, patent uchun soliqni o'z vaqtida to'lash, migratsiya hisobiga turish majburiyati, qonun va urf-odatlarni hurmat qilish, favqulodda raqamlar (112, 101, 102, 103). Tez o'zgaradigan aniq muddatlar, jarima summalari va narxlar haqida SO'RAMA.`,
  writing: `Bitta yozma topshiriq ber: task — o'rganilayotgan tilda topshiriq matni (vaziyat), task_uz — uning o'zbekcha tarjimasi, points — javobda albatta bo'lishi kerak bo'lgan 3 ta nuqta (o'zbekcha), min_words — kerakli so'zlar soni.`,
  speaking: `3 ta og'zaki topshiriq ber, osondan qiyinga: prompt — imtihon oluvchining savoli yoki vaziyat (o'rganilayotgan tilda), prompt_uz — o'zbekcha tarjimasi.`,
};

function examSectionPrompt(lang, exam, section) {
  return [
    `Sen ${exam.name} imtihonining tajribali tuzuvchisisan. O'zbek tilida so'zlashuvchi o'quvchi uchun haqiqiy imtihonga iloji boricha o'xshash SINOV topshiriq tuz.`,
    `Daraja: ${exam.level}. O'rganilayotgan til: ${LANGUAGES[lang]}.`,
    LANG_NOTES[lang] || '',
    `Bo'lim: ${section.format}`,
    "instructions_uz — o'quvchiga o'zbekcha qisqa yo'riqnoma (nima qilish kerak). Har bir savolning faqat bitta aniq to'g'ri javobi bo'lsin; explanation — nega shu javob to'g'ri, o'zbekcha bir-ikki gap. Har safar yangi mavzu va vaziyat o'yla.",
    SECTION_TASKS[section.id],
    exam.options === 4 && SECTION_INFO_KIND_CHOICE.has(section.id)
      ? "Bu imtihonda har savolda 4 ta variant bo'ladi: wrong — aynan 3 ta noto'g'ri javob (yuqoridagi variantlar sonidan qat'i nazar)."
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

const SECTION_INFO_KIND_CHOICE = new Set(Object.keys(EXAMS.SECTION_INFO).filter((id) => EXAMS.SECTION_INFO[id].kind === 'choice'));

const EXAM_SCHEMAS = {
  choice: CHOICE_SCHEMA,
  writing: WRITING_SCHEMA,
  speaking: SPEAKING_SCHEMA,
};

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer' },
    feedback: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    corrected: { type: 'string' },
  },
  required: ['score', 'feedback', 'strengths', 'improvements', 'corrected'],
  additionalProperties: false,
};

function examGradePrompt(lang, exam, section) {
  const what = section.id === 'writing' ? 'yozma ishini' : "og'zaki javoblarini (nutqni tanish dasturi yozib olgan — tinish belgilari va katta-kichik harfni hisobga olma)";
  return [
    `Sen ${exam.name} imtihonining tajribali, adolatli imtihon oluvchisisan. O'quvchining ${what} ${exam.level} darajasi mezonlari bo'yicha bahola: topshiriqni bajarish, so'z boyligi, grammatika, ${section.id === 'writing' ? 'matn tuzilishi' : 'ravonlik va tushunarlilik'}.`,
    "score — 0 dan 100 gacha butun son (haqiqiy imtihondagidek: 60 — o'tish chegarasi atrofida). Bo'sh yoki mavzuga aloqasiz javobga past ball qo'y.",
    "feedback — o'zbekcha 2-3 gaplik umumiy baho. strengths — 1-3 ta kuchli tomon (o'zbekcha). improvements — 2-4 ta aniq tavsiya, xato va to'g'ri variant bilan (o'zbekcha). corrected — o'quvchi javobining to'g'rilangan varianti (o'rganilayotgan tilda).",
  ].join('\n\n');
}

module.exports = {
  PROFILE_TEXT,
  SC,
  EXAMS,
  EXAM_SCHEMAS,
  GRADE_SCHEMA,
  examSectionPrompt,
  examGradePrompt,
  COURSE,
  GAMES,
  gamePrompt,
  TUTOR_PROMPT,
  LANGUAGES,
  PERSONAS,
  MODES,
  TOPICS,
  LEVELS,
  MOODS,
  REPLY_SCHEMA,
  REPORT_PROMPT,
  REPORT_SCHEMA,
  sessionPrompt,
};
