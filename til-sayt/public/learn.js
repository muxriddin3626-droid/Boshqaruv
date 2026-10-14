// O'rganish ma'lumotlari — hammasi foydalanuvchining brauzerida (localStorage) saqlanadi:
// so'z daftari va aqlli takrorlash, xatolar daftari, ustoz xotirasi, XP va streak,
// kurs bosqichlari.
window.Learn = (() => {
  const DAY = 24 * 60 * 60 * 1000;
  // Takrorlash oraliqlari (kun): har to'g'ri javobda keyingi pog'onaga o'tadi.
  const INTERVALS = [0, 1, 3, 7, 16, 35, 80];
  const LEARNED_LEVEL = 4;
  const MAX_CARDS = 1000;
  const MAX_NOTES = 30;

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[.,!?;:«»"„“”¿¡()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  function localDate(t = Date.now()) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ---------- So'z daftari va aqlli takrorlash ----------

  const deckKey = (lang) => `tu-deck-${lang}`;
  const loadDeck = (lang) => read(deckKey(lang), {});
  const saveDeck = (lang, deck) => write(deckKey(lang), deck);

  // Yangi so'z qo'shadi. lapse: true bo'lsa (o'yinda xato qilingan), mavjud so'z
  // ham qaytadan o'rganiladiganlar qatoriga tushadi.
  function addWord(lang, word, translation, opts = {}) {
    const key = norm(word);
    if (!key || !translation) return;
    const deck = loadDeck(lang);
    const now = Date.now();
    const card = deck[key];
    if (card) {
      if (opts.lapse) {
        card.level = 0;
        card.due = now;
        card.lapses = (card.lapses || 0) + 1;
      }
    } else {
      deck[key] = {
        word: String(word).trim(),
        translation: String(translation).trim(),
        wrong: opts.wrong || '',
        kind: opts.kind || 'word',
        level: 0,
        due: now,
        added: now,
        reps: 0,
        lapses: 0,
      };
      // Daftar juda kattalashsa, eng yaxshi yodlangan eski so'zlarni chiqaramiz.
      const keys = Object.keys(deck);
      if (keys.length > MAX_CARDS) {
        keys
          .sort((a, b) => deck[b].level - deck[a].level || deck[a].added - deck[b].added)
          .slice(0, keys.length - MAX_CARDS)
          .forEach((k) => delete deck[k]);
      }
    }
    saveDeck(lang, deck);
  }

  function dueCards(lang, limit = 30) {
    const deck = loadDeck(lang);
    const now = Date.now();
    return Object.entries(deck)
      .filter(([, c]) => c.due <= now)
      .sort((a, b) => a[1].due - b[1].due)
      .slice(0, limit)
      .map(([key, c]) => ({ key, ...c }));
  }

  function grade(lang, key, ok) {
    const deck = loadDeck(lang);
    const card = deck[key];
    if (!card) return;
    card.reps++;
    if (ok) {
      card.level = Math.min(card.level + 1, INTERVALS.length - 1);
      card.due = Date.now() + INTERVALS[card.level] * DAY;
    } else {
      card.level = 0;
      card.lapses++;
      card.due = Date.now();
    }
    saveDeck(lang, deck);
  }

  function removeWord(lang, key) {
    const deck = loadDeck(lang);
    delete deck[key];
    saveDeck(lang, deck);
  }

  function deckList(lang) {
    return Object.entries(loadDeck(lang))
      .map(([key, c]) => ({ key, ...c }))
      .sort((a, b) => b.added - a.added);
  }

  function deckStats(lang) {
    const cards = Object.values(loadDeck(lang));
    const now = Date.now();
    return {
      total: cards.length,
      learned: cards.filter((c) => c.level >= LEARNED_LEVEL).length,
      due: cards.filter((c) => c.due <= now).length,
    };
  }

  // ---------- Xatolar daftari va ustoz xotirasi ----------

  const notesKey = (lang) => `tu-notes-${lang}`;
  const memoryKey = (lang) => `tu-memory-${lang}`;

  function addMistakes(lang, mistakes) {
    const notes = read(notesKey(lang), []);
    for (const m of mistakes || []) {
      if (!m || !m.correct) continue;
      const i = notes.findIndex((n) => norm(n.correct) === norm(m.correct));
      if (i >= 0) notes.splice(i, 1);
      notes.unshift({ wrong: m.wrong || '', correct: m.correct, explanation: m.explanation || '', date: Date.now() });
      // Xatoning to'g'ri varianti takrorlash daftariga ham tushadi.
      addWord(lang, m.correct, m.explanation || m.correct, { kind: 'mistake', wrong: m.wrong || '', lapse: true });
    }
    write(notesKey(lang), notes.slice(0, MAX_NOTES));
  }

  const mistakes = (lang) => read(notesKey(lang), []);

  // Ovozli dars hisobotini saqlaydi: so'zlar daftarga, xatolar xatolar daftariga.
  function recordReport(lang, report) {
    for (const w of report.words || []) addWord(lang, w.word, w.translation);
    addMistakes(lang, report.mistakes);
    const mem = read(memoryKey(lang), { lessons: 0 });
    mem.lessons = (mem.lessons || 0) + 1;
    mem.lastSummary = report.summary || '';
    mem.lastLevel = report.level || '';
    mem.lastDate = Date.now();
    write(memoryKey(lang), mem);
  }

  // Ustoz (va o'yinlar) uchun: o'quvchi haqida eslab qolinganlar.
  function memory(lang) {
    const mem = read(memoryKey(lang), { lessons: 0 });
    const weak = Object.values(loadDeck(lang))
      .filter((c) => c.kind === 'word')
      .sort((a, b) => a.level - b.level || b.lapses - a.lapses || b.added - a.added)
      .slice(0, 8)
      .map((c) => c.word);
    return {
      lessons: mem.lessons || 0,
      summary: mem.lastSummary || '',
      level: mem.lastLevel || '',
      mistakes: mistakes(lang)
        .slice(0, 6)
        .map((m) => (m.wrong ? `${m.wrong} → ${m.correct}` : m.correct)),
      words: weak,
    };
  }

  // ---------- XP, kunlik maqsad va streak ----------

  const XP_KEY = 'tu-xp';
  const loadXp = () => read(XP_KEY, { goal: 50, days: {} });

  function addXp(amount) {
    const xp = loadXp();
    const today = localDate();
    const before = xp.days[today] || 0;
    const after = before + Math.max(0, Math.round(amount));
    xp.days[today] = after;
    // Faqat oxirgi 400 kunni saqlaymiz.
    const days = Object.keys(xp.days).sort();
    days.slice(0, Math.max(0, days.length - 400)).forEach((d) => delete xp.days[d]);
    write(XP_KEY, xp);
    return { before, after, goal: xp.goal, reachedNow: before < xp.goal && after >= xp.goal };
  }

  function setGoal(goal) {
    const xp = loadXp();
    xp.goal = goal;
    write(XP_KEY, xp);
  }

  function daily() {
    const xp = loadXp();
    const today = xp.days[localDate()] || 0;
    // Streak: kunlik maqsad bajarilgan ketma-ket kunlar (bugun hali bajarilmagan bo'lsa, kechagacha).
    let streak = 0;
    let t = Date.now();
    if (today < xp.goal) t -= DAY;
    while ((xp.days[localDate(t)] || 0) >= xp.goal) {
      streak++;
      t -= DAY;
    }
    return { today, goal: xp.goal, streak, done: today >= xp.goal };
  }

  // Oxirgi 7 kun: [{ date, xp, done }]
  function week() {
    const xp = loadXp();
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const t = Date.now() - i * DAY;
      const v = xp.days[localDate(t)] || 0;
      out.push({ day: new Date(t).getDay(), xp: v, done: v >= xp.goal, today: i === 0 });
    }
    return out;
  }

  // ---------- Kurs ----------

  const courseKey = (lang) => `tu-course-${lang}`;

  function courseProgress(lang) {
    return read(courseKey(lang), {});
  }

  function completeStep(lang, unitId, step, extra = {}) {
    const progress = courseProgress(lang);
    const unit = (progress[unitId] = progress[unitId] || {});
    if (step === 'exam') {
      unit.examBest = Math.max(unit.examBest || 0, extra.ratio || 0);
      if (extra.passed) unit.exam = true;
    } else {
      unit[step] = true;
    }
    write(courseKey(lang), progress);
    return unit;
  }

  function unitStatus(lang, index) {
    const units = window.COURSE.UNITS;
    const progress = courseProgress(lang);
    const p = progress[units[index].id] || {};
    if (p.exam) return 'done';
    if (index === 0 || (progress[units[index - 1].id] || {}).exam) return 'open';
    return 'locked';
  }

  function currentUnit(lang) {
    const units = window.COURSE.UNITS;
    for (let i = 0; i < units.length; i++) {
      if (unitStatus(lang, i) === 'open') return i;
    }
    return units.length - 1;
  }

  // ---------- Eslatma (taqvimga qo'shiladigan .ics fayl) ----------

  function reminderIcs(time, url) {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now()) d.setTime(d.getTime() + DAY);
    const pad = (n) => String(n).padStart(2, '0');
    const local = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
    const end = new Date(d.getTime() + 15 * 60 * 1000);
    const localEnd = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Til Ustoz//UZ',
      'BEGIN:VEVENT',
      `UID:til-ustoz-${Date.now()}@tilustoz`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${local}`,
      `DTEND:${localEnd}`,
      'RRULE:FREQ=DAILY',
      'SUMMARY:🔥 Til Ustoz — 15 daqiqa mashq',
      `DESCRIPTION:Ustozingiz sizni kutyapti! ${url}`,
      `URL:${url}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Til Ustoz — mashq vaqti!',
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  return {
    norm,
    addWord,
    dueCards,
    grade,
    removeWord,
    deckList,
    deckStats,
    addMistakes,
    mistakes,
    recordReport,
    memory,
    addXp,
    setGoal,
    daily,
    week,
    courseProgress,
    completeStep,
    unitStatus,
    currentUnit,
    reminderIcs,
    LEARNED_LEVEL,
  };
})();
