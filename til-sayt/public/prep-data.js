// Imtihonga tayyorgarlik: har til uchun og'zaki va yozma sinov formati, baho shkalasi va mezonlar.
// Fayl brauzerda ham, serverda ham ishlatiladi.
(function (root) {
  // Shkala: IELTS — band (0-9); qolganlari — CEFR (1 = A1 ... 6 = C2, .5 — «+»).
  const CEFR = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

  const SPEAK_CRITERIA = {
    band: [
      ['fluency', 'Fluency & Coherence', "Ravonlik va bog'liqlik"],
      ['lexical', 'Lexical Resource', "So'z boyligi"],
      ['grammar', 'Grammatical Range & Accuracy', 'Grammatika'],
      ['pronunciation', 'Pronunciation', 'Talaffuz (taxminiy)'],
    ],
    cefr: [
      ['fluency', 'Ravonlik', "Ravonlik va bog'liqlik"],
      ['lexical', "So'z boyligi", "So'z boyligi"],
      ['grammar', 'Grammatika', 'Grammatika'],
      ['pronunciation', 'Talaffuz', 'Talaffuz (taxminiy)'],
    ],
  };

  const WRITE_CRITERIA = {
    band: [
      ['task', 'Task Response', 'Topshiriqni bajarish'],
      ['coherence', 'Coherence & Cohesion', "Tuzilish va bog'liqlik"],
      ['lexical', 'Lexical Resource', "So'z boyligi"],
      ['grammar', 'Grammatical Range & Accuracy', 'Grammatika'],
    ],
    cefr: [
      ['task', 'Topshiriq', 'Topshiriqni bajarish'],
      ['coherence', 'Tuzilish', "Tuzilish va bog'liqlik"],
      ['lexical', "So'z boyligi", "So'z boyligi"],
      ['grammar', 'Grammatika', 'Grammatika'],
    ],
  };

  const EXAMS = {
    en: {
      exam: 'IELTS',
      scale: 'band',
      speakName: 'IELTS Speaking',
      parts: ['Introduction', 'Cue card', 'Discussion'],
      phrases: {
        part1: (t) => `Part 1. Let's talk about ${t.toLowerCase()}.`,
        cue: (task) => `Now, I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. You have one minute to think about what you are going to say. ${task}`,
        start: "Alright. Remember, you have one to two minutes for this. Please start speaking now.",
        part3: "Part 3. Now I'd like to ask you some more general questions related to this topic.",
        end: 'Thank you. That is the end of the speaking test.',
        youShould: 'You should say:',
      },
      fillers: '\\b(u+m+|u+h+|e+r+m*|hmm+|a+h+|you know|i mean)\\b',
      writing: [
        { id: 'task2', title: 'Writing Task 2 — insho', minWords: 250, minutes: 40, format: "IELTS Academic/GT Writing Task 2: fikr bildirish, ikki tomonni muhokama qilish, muammo-yechim yoki afzallik-kamchilik inshosi (kamida 250 so'z)." },
        { id: 'task1gt', title: 'GT Task 1 — xat', minWords: 150, minutes: 20, format: "IELTS General Training Writing Task 1: rasmiy, yarim rasmiy yoki norasmiy xat — vaziyat va 3 ta nuqta (kamida 150 so'z)." },
      ],
    },
    ru: {
      exam: 'ТРКИ',
      scale: 'cefr',
      speakName: 'Говорение (ТРКИ formatida)',
      parts: ['Знакомство', 'Монолог', 'Беседа'],
      phrases: {
        part1: (t) => `Первая часть. Давайте поговорим на тему «${t}».`,
        cue: (task) => `Сейчас я дам вам тему. У вас есть одна минута, чтобы подготовиться, а потом говорите одну-две минуты. ${task}`,
        start: 'Хорошо. Пожалуйста, начинайте.',
        part3: 'Третья часть. Теперь я задам вам несколько вопросов по этой теме.',
        end: 'Спасибо. Экзамен окончен.',
        youShould: 'Расскажите:',
      },
      fillers: '(^|\\s)(э+|ээ+|ммм*|ну|как бы|это самое|короче)(?=\\s|$)',
      writing: [
        { id: 'letter', title: 'Письмо — xat', minWords: 100, minutes: 25, format: "ТРКИ Письмо: do'stga yoki rasmiy xat — berilgan vaziyat bo'yicha 3 ta nuqta (darajaga qarab 60-150 so'z)." },
        { id: 'essay', title: 'Сочинение — fikr', minWords: 120, minutes: 30, format: "Kichik insho: mavzu bo'yicha o'z fikrini bildirish, misollar va xulosa (darajaga qarab 80-200 so'z)." },
      ],
    },
    de: {
      exam: 'Goethe-Zertifikat',
      scale: 'cefr',
      speakName: 'Sprechen (Goethe formatida)',
      parts: ['Vorstellung', 'Monolog', 'Diskussion'],
      phrases: {
        part1: (t) => `Teil eins. Sprechen wir über das Thema „${t}“.`,
        cue: (task) => `Jetzt bekommen Sie ein Thema. Sie haben eine Minute Zeit zur Vorbereitung, dann sprechen Sie ein bis zwei Minuten. ${task}`,
        start: 'Gut. Bitte beginnen Sie jetzt.',
        part3: 'Teil drei. Jetzt möchte ich Ihnen noch einige Fragen zu diesem Thema stellen.',
        end: 'Vielen Dank. Die Prüfung ist zu Ende.',
        youShould: 'Sprechen Sie über:',
      },
      fillers: '(^|\\s)(ä+h*m*|ö+h*m*|hm+|also|sozusagen|halt)(?=\\s|$)',
      writing: [
        { id: 'email', title: 'E-Mail — xat', minWords: 80, minutes: 20, format: "Goethe Schreiben: do'stga yoki rasmiy e-mail — vaziyat va 3 ta nuqta (darajaga qarab 30-120 so'z)." },
        { id: 'meinung', title: 'Meinung — fikr', minWords: 100, minutes: 25, format: "Goethe B1/B2 Schreiben: forumga yoki blogga o'z fikrini yozish — mavzu, sabablar, misol (80-150 so'z)." },
      ],
    },
    ko: {
      exam: 'TOPIK',
      scale: 'cefr',
      speakName: '말하기 (TOPIK formatida)',
      parts: ['자기소개', '독백', '토론'],
      phrases: {
        part1: (t) => `첫 번째 부분입니다. ${t}에 대해 이야기해 봅시다.`,
        cue: (task) => `이제 주제를 드리겠습니다. 1분 동안 준비하고, 1분에서 2분 동안 말해 주세요. ${task}`,
        start: '좋습니다. 지금 시작해 주세요.',
        part3: '세 번째 부분입니다. 이 주제에 대해 몇 가지 질문을 더 하겠습니다.',
        end: '감사합니다. 시험이 끝났습니다.',
        youShould: '다음 내용을 말해 보세요:',
      },
      fillers: '(^|\\s)(음+|어+|그+|저+|약간|막)(?=\\s|$)',
      writing: [
        { id: 'short', title: '짧은 글 — qisqa matn', minWords: 40, minutes: 20, format: "TOPIK 쓰기 53-savoliga o'xshash: berilgan mavzu yoki ma'lumot bo'yicha qisqa matn (200-300 belgi, ~40-60 so'z)." },
        { id: 'opinion', title: '의견 글 — fikr', minWords: 100, minutes: 40, format: "TOPIK 쓰기 54-savoliga o'xshash: ijtimoiy mavzuda o'z fikri, sabab va xulosa (600-700 belgi, ~100-150 so'z). Boshlang'ich darajada qisqaroq." },
      ],
    },
  };

  // IELTS qoidasi: o'rtacha eng yaqin 0.5 ga (.25 → .5, .75 → keyingi butun). CEFR shkalasi ham shunday.
  function overall(bands) {
    if (!bands.length) return 0;
    const avg = bands.reduce((n, b) => n + b, 0) / bands.length;
    return Math.floor(avg * 2 + 0.5) / 2;
  }

  // Ko'rsatish: band — «6.5»; CEFR — «B1» / «B1+».
  function label(scale, v) {
    if (scale === 'band') return Number.isInteger(v) ? `${v}.0` : String(v);
    const base = Math.floor(v);
    return `${CEFR[Math.max(0, Math.min(6, base))]}${v - base >= 0.5 && base < 6 ? '+' : ''}`;
  }

  const maxOf = (scale) => (scale === 'band' ? 9 : 6);

  const API = { EXAMS, LEVELS, CEFR, SPEAK_CRITERIA, WRITE_CRITERIA, overall, label, maxOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PREP = API;
})(typeof window !== 'undefined' ? window : globalThis);
