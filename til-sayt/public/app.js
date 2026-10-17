(() => {
  const LESSON_SECONDS = 10 * 60;
  const ROLEPLAY_SECONDS = 5 * 60;
  const LOCALES = { ru: 'ru-RU', de: 'de-DE', ko: 'ko-KR', uz: 'uz-UZ' };
  const TUTORS = {
    ru: { name: 'Anna', speakLabel: 'Ruscha', lang: 'rus tili' },
    de: { name: 'Hans', speakLabel: 'Nemischa', lang: 'nemis tili' },
    ko: { name: 'Minji', speakLabel: 'Koreyscha', lang: 'koreys tili' },
  };
  const MODE_LABELS = { kind: 'Mehribon', strict: "Qattiqqo'l" };
  const THEME_KEY = 'til-ustoz-theme';
  const SETTINGS_KEY = 'til-ustoz-settings';
  const BEST_KEY = 'til-ustoz-best-';

  const $ = (id) => document.getElementById(id);
  const screens = {
    start: $('startScreen'),
    menu: $('menuScreen'),
    setup: $('setupScreen'),
    lesson: $('lessonScreen'),
    end: $('endScreen'),
    game: $('gameScreen'),
    result: $('resultScreen'),
    course: $('courseScreen'),
    unit: $('unitScreen'),
    review: $('reviewScreen'),
    notebook: $('notebookScreen'),
    story: $('storyScreen'),
    examList: $('examListScreen'),
    exam: $('examScreen'),
    examResult: $('examResultScreen'),
    cert: $('certScreen'),
    account: $('accountScreen'),
    badges: $('badgesScreen'),
    hangul: $('hangulScreen'),
    rating: $('ratingScreen'),
    profList: $('profListScreen'),
    prof: $('profScreen'),
    roles: $('rolesScreen'),
    survey: $('surveyScreen'),
  };
  const face = $('face');
  const statusText = $('statusText');
  const subtitle = $('subtitle');
  const micBtn = $('micBtn');
  const timerEl = $('timer');
  const typeForm = $('typeForm');
  const typeInput = $('typeInput');

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const tts = window.speechSynthesis;

  let lang = null;
  let settings = loadSettings();
  let history = [];
  let lessonToken = null; // server bergan dars tokeni (kunlik limit uchun)
  let phase = 'idle'; // idle | speaking | listening | thinking
  let speakLang = 'target'; // target | uz
  let showSubs = true;
  let userTurns = 0;
  let startedAt = 0;
  let timerId = null;
  let timeUp = false;
  let ended = true;
  let recognition = null;
  let speakToken = 0;
  let stopCurrentSound = null;
  let serverVoice = false; // serverda tabiiy (Azure) ovoz sozlanganmi

  // Server sozlamalari: tabiiy ovoz, Telegram orqali kirish, limitlar.
  const configReady = fetch('/api/config')
    .then((r) => r.json())
    .then((c) => {
      serverVoice = Boolean(c.voice);
      return c;
    })
    .catch(() => ({}));

  // ---------- Umumiy ----------

  function show(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    window.scrollTo(0, 0);
  }

  function setPhase(next, text) {
    phase = next;
    face.dataset.state = next;
    micBtn.classList.toggle('listening', next === 'listening');
    micBtn.disabled = next === 'thinking';
    if (text) statusText.textContent = text;
  }

  function setSubtitle(text, segLang, isUser) {
    subtitle.classList.toggle('you', Boolean(isUser));
    subtitle.textContent = '';
    if (!text) return;
    if (segLang) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = segLang.toUpperCase();
      subtitle.appendChild(tag);
    }
    subtitle.appendChild(document.createTextNode(text));
  }

  function loadSettings() {
    const defaults = { mode: 'kind', topic: 'free', level: 'auto' };
    return { ...defaults, ...Store.get(SETTINGS_KEY, {}) };
  }

  function saveSettings() {
    Store.set(SETTINGS_KEY, settings);
  }

  async function postJson(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    // Kunlik bepul limit tugadi — Premium oynasini ko'rsatamiz.
    if (res.status === 402 && json.limit && window.AccountUI) window.AccountUI.onLimit(json);
    if (!res.ok) throw new Error(json.error || "Javob kelmadi. Qayta urinib ko'ring.");
    return json;
  }

  // ---------- Menyu ----------

  function chipLabel(group, value) {
    const chip = document.querySelector(`[data-group="${group}"] [data-value="${value}"]`);
    return chip ? chip.textContent : '';
  }

  const loadStored = (key) => Store.get(key, null);
  const store = (key, value) => Store.set(key, value);

  // Ustoz eslab qolgan narsalar: o'quvchining xatolari va yaxshi yodlanmagan so'zlari.
  function loadFocus() {
    const m = Learn.memory(lang);
    return { words: m.words, mistakes: m.mistakes };
  }

  function openMenu(nextLang) {
    if (nextLang) lang = nextLang;
    const t = TUTORS[lang];
    $('menuTitle').textContent = `${t.name} bilan ${t.lang}`;
    $('settingsText').textContent =
      `${settings.mode === 'strict' ? '🔥' : '😊'} ${MODE_LABELS[settings.mode]} · ${chipLabel('topic', settings.topic)} · ${chipLabel('level', settings.level)}`;
    const best = loadStored(BEST_KEY + lang) || {};
    document.querySelectorAll('[data-best]').forEach((el) => {
      const b = best[el.dataset.best];
      el.textContent = b ? `🏆 ${b.score}/${b.total}` : '';
    });
    const memory = Learn.memory(lang);
    $('focusNote').hidden = !(memory.lessons || memory.mistakes.length);
    Face.set($('menuFace'), settings.mode === 'strict' ? 'angry' : 'happy');
    window.Practice.renderMenu();
    window.Hangul.renderMenu(lang);
    show('menu');
  }

  // ---------- Sozlamalar ekrani ----------

  function openSetup() {
    $('setupTitle').textContent = 'Sozlamalar';
    $('setupLead').textContent = `${TUTORS[lang].name} qanday ustoz bo'lsin, nimani mashq qilamiz?`;
    renderSettings();
    show('setup');
  }

  function renderSettings() {
    document.querySelectorAll('.mode-card').forEach((card) => {
      const on = card.dataset.mode === settings.mode;
      card.classList.toggle('selected', on);
      card.setAttribute('aria-checked', String(on));
    });
    document.querySelectorAll('.chips[data-group]').forEach((group) => {
      group.querySelectorAll('.chip').forEach((chip) => {
        chip.classList.toggle('selected', chip.dataset.value === settings[group.dataset.group]);
      });
    });
    const goal = Learn.daily().goal;
    document.querySelectorAll('#goalChips .chip').forEach((chip) => {
      chip.classList.toggle('selected', Number(chip.dataset.goal) === goal);
    });
    Face.set($('setupFace'), settings.mode === 'strict' ? 'angry' : 'happy');
  }

  document.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      settings.mode = card.dataset.mode;
      saveSettings();
      renderSettings();
    });
  });

  $('goalChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    Learn.setGoal(Number(chip.dataset.goal));
    renderSettings();
  });

  document.querySelectorAll('.chips[data-group]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      settings[group.dataset.group] = chip.dataset.value;
      saveSettings();
      renderSettings();
    });
  });

  // ---------- Taymer ----------

  function fmt(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function tick() {
    const passed = Math.min(lessonSeconds, Math.floor((Date.now() - startedAt) / 1000));
    timerEl.textContent = `${fmt(passed)} / ${fmt(lessonSeconds)}`;
    if (passed >= lessonSeconds && !timeUp) {
      timeUp = true;
      // Ustoz gapirayotgan yoki o'ylayotgan bo'lsa, gapini tugatgach dars yopiladi.
      if (phase === 'idle' || phase === 'listening') endLesson();
    }
  }

  // ---------- Ovoz chiqarib o'qish ----------

  // Telefonlarda ovoz faqat bosishdan keyin chiqadi, shuning uchun bitta audio
  // elementini birinchi bosishda "uyg'otib" qo'yamiz va keyin shuni ishlatamiz.
  const player = new Audio();
  player.preload = 'auto';

  function silentWav() {
    const bytes = new Uint8Array([
      82, 73, 70, 70, 38, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32, 16, 0, 0, 0, 1, 0, 1, 0,
      64, 31, 0, 0, 64, 31, 0, 0, 1, 0, 8, 0, 100, 97, 116, 97, 2, 0, 0, 0, 128, 128,
    ]);
    return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...bytes));
  }

  function unlockAudio() {
    player.src = silentWav();
    player.play().catch(() => {});
    if (tts) {
      tts.cancel();
      tts.speak(new SpeechSynthesisUtterance(''));
    }
  }

  let voices = [];
  function loadVoices() {
    voices = tts ? tts.getVoices() : [];
  }
  if (tts) {
    loadVoices();
    tts.addEventListener?.('voiceschanged', loadVoices);
  }

  function pickVoice(code) {
    const locale = LOCALES[code].toLowerCase();
    const byLang = (prefix) => voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
    // O'zbek ovozi ko'p qurilmalarda yo'q — lotin yozuvini eng yaqin o'qiydigani turkcha ovoz.
    return byLang(locale) || byLang(code) || (code === 'uz' ? byLang('tr') : null) || null;
  }

  // Bitta ovozni oxirigacha kutadi; to'xtatilsa yoki brauzer "tugadi" demasa ham davom etadi.
  function waitSound(start, stop, maxMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        if (stopCurrentSound === cancel) stopCurrentSound = null;
        resolve();
      };
      const cancel = () => {
        stop();
        finish();
      };
      const watchdog = setTimeout(finish, maxMs);
      stopCurrentSound = cancel;
      start(finish);
    });
  }

  function speakBrowser(seg) {
    const maxMs = 5000 + seg.text.length * 170;
    if (!tts) return new Promise((r) => setTimeout(r, maxMs / 2));
    return waitSound(
      (finish) => {
        const u = new SpeechSynthesisUtterance(seg.text);
        u.lang = LOCALES[seg.lang];
        const voice = pickVoice(seg.lang);
        if (voice) u.voice = voice;
        u.rate = seg.lang === 'uz' ? 1 : 0.92;
        u.onend = finish;
        u.onerror = finish;
        tts.speak(u);
      },
      () => tts.cancel(),
      maxMs
    );
  }

  function playUrl(url) {
    return waitSound(
      (finish) => {
        player.onended = finish;
        player.onerror = finish;
        player.src = url;
        player.play().catch(finish);
      },
      () => player.pause(),
      60_000
    );
  }

  // Serverdagi tabiiy ovozni oladi. Sozlanmagan bo'lsa null qaytaradi.
  async function fetchVoice(seg) {
    if (!serverVoice) return null;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutor: lang, lang: seg.lang, text: seg.text }),
      });
      if (res.status === 501) {
        serverVoice = false;
        return null;
      }
      if (!res.ok) return null;
      return URL.createObjectURL(await res.blob());
    } catch {
      return null;
    }
  }

  async function speakReply(segments) {
    setPhase('speaking', `${TUTORS[lang].name} gapiryapti...`);
    return speakSegments(segments, (seg) => setSubtitle(seg.text, seg.lang));
  }

  // Bo'laklarni navbat bilan o'qiydi. To'xtatilsa false qaytaradi.
  async function speakSegments(segments, onSegment) {
    stopSpeaking();
    const token = ++speakToken;
    // Barcha bo'laklarning ovozini birdaniga so'raymiz — biri o'qilayotganda keyingisi tayyor bo'ladi.
    const pending = segments.map(fetchVoice);
    try {
      for (let i = 0; i < segments.length; i++) {
        if (token !== speakToken) return false;
        const url = await pending[i];
        if (token !== speakToken) return false;
        if (onSegment) onSegment(segments[i]);
        if (url) await playUrl(url);
        else await speakBrowser(segments[i]);
      }
      return token === speakToken;
    } finally {
      pending.forEach((p) => p.then((url) => url && URL.revokeObjectURL(url)));
    }
  }

  function stopSpeaking() {
    speakToken++;
    if (stopCurrentSound) stopCurrentSound();
    if (tts) tts.cancel();
    player.pause();
  }

  // ---------- Tinglash ----------

  function listen(auto) {
    if (ended || phase === 'thinking') return;
    if (!SR) {
      typeForm.hidden = false;
      setPhase('idle', 'Bu brauzer ovozni tanimaydi — javobni yozing');
      typeInput.focus();
      return;
    }
    stopSpeaking();
    const rec = new SR();
    recognition = rec;
    rec.lang = LOCALES[speakLang === 'uz' ? 'uz' : lang];
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = '';
    let permissionError = false;
    rec.onresult = (e) => {
      let interim = '';
      finalText = '';
      for (const r of e.results) {
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setSubtitle((finalText + ' ' + interim).trim(), null, true);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') permissionError = !auto;
    };
    rec.onend = () => {
      if (recognition === rec) recognition = null;
      if (ended) return;
      const text = finalText.trim();
      if (text) {
        sendUser(text);
        return;
      }
      if (timeUp) {
        endLesson();
        return;
      }
      if (permissionError) {
        typeForm.hidden = false;
        setPhase('idle', "Mikrofonga ruxsat berilmadi — javobni yozishingiz mumkin");
      } else {
        setPhase('idle', 'Gapirish uchun mikrofonni bosing');
      }
    };

    setPhase('listening', 'Tinglayapman...');
    setSubtitle('');
    try {
      rec.start();
    } catch {
      setPhase('idle', 'Gapirish uchun mikrofonni bosing');
    }
  }

  function stopListening() {
    if (recognition) {
      const rec = recognition;
      recognition = null;
      rec.onend = null;
      try { rec.abort(); } catch {}
    }
  }

  // ---------- Server bilan suhbat ----------

  async function requestReply() {
    setPhase('thinking', "O'ylayapman...");
    Face.set(face, 'thinking');
    let data;
    try {
      data = await postJson('/api/chat', {
        lang,
        settings: { ...settings, ...lessonOpts },
        memory: Learn.memory(lang),
        profile: window.Survey.profile(lang),
        messages: history,
        lessonToken,
      });
      if (!Array.isArray(data.segments)) throw new Error("Javob kelmadi. Qayta urinib ko'ring.");
    } catch (err) {
      if (ended) return;
      // Javobsiz qolgan xabarni olib tashlaymiz, foydalanuvchi qayta gapiradi.
      if (history.length && history[history.length - 1].role === 'user') {
        history.pop();
        userTurns = Math.max(0, userTurns - 1);
      }
      Face.set(face, 'surprised');
      setSubtitle(err instanceof TypeError ? "Internet bilan aloqa yo'q." : err.message);
      setPhase('idle', history.length ? 'Qayta gapirish uchun mikrofonni bosing' : 'Boshlash uchun mikrofonni bosing');
      return;
    }
    if (ended) return;

    if (data.lessonToken) lessonToken = data.lessonToken;
    history.push({ role: 'assistant', content: JSON.stringify({ mood: data.mood, segments: data.segments }) });
    Face.set(face, data.mood);
    const finished = await speakReply(data.segments);
    if (!finished || ended) return;
    // Rolli vaziyatda maqsadga erishildi — darsni g'alaba bilan yakunlaymiz.
    if (data.goal_reached && lessonOpts.scenario) {
      goalReached = true;
      endLesson();
      return;
    }
    if (timeUp) endLesson();
    else listen(true);
  }

  function sendUser(text) {
    userTurns++;
    history.push({ role: 'user', content: text });
    setSubtitle(text, null, true);
    requestReply();
  }

  // ---------- Dars boshlanishi va tugashi ----------

  // Dars turi: kurs bosqichi (unit), kasb mavzusi (prof) yoki rolli vaziyat (scenario).
  let lessonOpts = {};
  let lessonUnit = null;
  let lessonSeconds = LESSON_SECONDS;
  let goalReached = false;

  function startLesson(opts = {}) {
    const t = TUTORS[lang];
    lessonOpts = { unit: opts.unit || null, prof: opts.prof || null, scenario: opts.scenario || null };
    // Maxsus mavzu (masalan, Hangul harflari darsi) — faqat shu dars uchun.
    if (opts.topic) lessonOpts.topic = opts.topic;
    lessonUnit = lessonOpts.unit;
    lessonSeconds = lessonOpts.scenario ? ROLEPLAY_SECONDS : LESSON_SECONDS;
    goalReached = false;
    const unit = lessonUnit && COURSE.byId(lessonUnit);
    const scenario = lessonOpts.scenario && SCENARIOS.findScenario(lessonOpts.scenario);
    const theme = lessonOpts.prof && SCENARIOS.findTheme(lessonOpts.prof);
    history = [];
    lessonToken = null;
    userTurns = 0;
    timeUp = false;
    ended = false;
    speakLang = 'target';
    document.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p.dataset.speak === 'target'));
    $('speakTarget').textContent = t.speakLabel;
    const topic = document.querySelector(`[data-group="topic"] [data-value="${settings.topic}"]`);
    $('lessonInfo').textContent = scenario
      ? `🎭 ${scenario.title}`
      : theme
        ? `${t.name} · ${theme.prof.icon} ${theme.theme.title}`
        : unit
          ? `${t.name} · ${unit.icon} ${unit.title}`
          : lessonOpts.topic === 'hangul'
            ? `${t.name} · 🔤 Harflar darsi`
          : `${t.name} · ${MODE_LABELS[settings.mode]} · ${topic ? topic.textContent : ''}`;
    typeForm.hidden = true;
    setSubtitle('');
    Face.set(face, 'calm');
    show('lesson');

    unlockAudio();
    startedAt = Date.now();
    clearInterval(timerId);
    timerId = setInterval(tick, 500);
    tick();
    requestReply();
  }

  function endLesson() {
    if (ended) return;
    ended = true;
    clearInterval(timerId);
    stopListening();
    stopSpeaking();
    setPhase('idle');
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const roleplay = Boolean(lessonOpts.scenario);
    $('endTitle').textContent = roleplay ? (goalReached ? '🎉 Maqsadga erishdingiz!' : 'Vaziyat tugadi') : 'Dars tugadi!';
    $('endText').textContent =
      userTurns === 0
        ? "Bu safar gaplashmadik. Keyingi safar mikrofonni bosib, bemalol gapiring!"
        : roleplay && !goalReached
          ? `${userTurns} marta gapirdingiz, lekin maqsadga hali yetmadik. Hisobotni ko'rib, yana urinib ko'ring!`
          : `${minutes} daqiqa ichida ${userTurns} marta gapirdingiz. Ofarin, shunday davom eting!`;
    Face.set(document.querySelector('#endScreen .face-slot'), userTurns > 0 && (!roleplay || goalReached) ? 'excited' : 'calm');
    $('endMenuBtn').textContent = lessonUnit
      ? '← Bosqichga qaytish'
      : lessonOpts.prof || lessonOpts.scenario
        ? '← Orqaga'
        : "O'yinlar va menyu";
    $('againBtn').textContent = roleplay ? 'Yana urinish' : 'Yana gaplashish';
    show('end');
    if (roleplay && goalReached) {
      Learn.bumpStat('roleplayWins');
      window.Roles.markDone(lessonOpts.scenario, 'role');
    }
    if (lessonOpts.prof && userTurns >= 3) window.Roles.markDone(lessonOpts.prof, 'lesson');
    if (userTurns > 0) {
      // Har gap uchun XP; kurs darsi kamida 3 ta gap bo'lsa bajarilgan hisoblanadi.
      Learn.bumpStat('lessons');
      window.Practice.awardXp(Math.min(60, 10 + userTurns * 4), 'Ovozli dars');
      if (lessonUnit && userTurns >= 3) Learn.completeStep(lang, lessonUnit, 'lesson');
    }
    if (userTurns > 0) loadReport(history.slice());
    else $('report').hidden = true;
  }

  // ---------- Hisobot ----------

  let reportToken = 0;

  async function loadReport(messages) {
    const token = ++reportToken;
    $('report').hidden = false;
    $('reportLoading').hidden = false;
    $('reportLoading').textContent = `${TUTORS[lang].name} hisobot tayyorlayapti...`;
    $('reportBody').hidden = true;
    try {
      const r = await postJson('/api/report', { lang, settings: { ...settings, ...lessonOpts }, messages });
      if (token !== reportToken) return;
      renderReport(r);
      Learn.recordReport(lang, r);
    } catch {
      if (token !== reportToken) return;
      $('reportLoading').textContent = "Hisobotni tayyorlab bo'lmadi. Keyingi darsda albatta!";
    }
  }

  function li(parent, build) {
    const item = document.createElement('li');
    build(item);
    parent.appendChild(item);
  }

  function span(cls, text) {
    const el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    return el;
  }

  function renderReport(r) {
    $('reportLevel').textContent = r.level || '—';
    const scoreEl = $('reportScore');
    scoreEl.hidden = !lessonOpts.scenario || typeof r.score !== 'number';
    if (!scoreEl.hidden) {
      scoreEl.textContent = `Vaziyat bahosi: ${r.score}/100`;
      window.Roles.saveScore(lessonOpts.scenario, r.score);
    }
    $('reportSummary').textContent = r.summary || '';

    const mistakes = $('reportMistakes');
    mistakes.textContent = '';
    for (const m of r.mistakes || []) {
      li(mistakes, (item) => {
        item.append(span('wrong', m.wrong), ' → ', span('correct', m.correct), span('why', m.explanation));
      });
    }
    if (!mistakes.children.length) {
      li(mistakes, (item) => item.append('Xato topilmadi — zo\'r! 🎉'));
    }

    const words = $('reportWords');
    words.textContent = '';
    for (const w of r.words || []) {
      li(words, (item) => {
        const b = document.createElement('b');
        b.textContent = w.word;
        item.append(b, span('', w.translation));
      });
    }
    $('wordsBlock').hidden = !words.children.length;

    $('reportTip').textContent = r.tip || '';
    $('reportLoading').hidden = true;
    $('reportBody').hidden = false;
  }

  // ---------- Tugmalar ----------

  // Til tanlangach: birinchi marta bo'lsa — ro'yxatdan o'tish anketasi, keyin menyu.
  document.querySelectorAll('.lang-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      lang = btn.dataset.lang;
      if (window.Survey.done(lang)) openMenu(lang);
      else {
        unlockAudio();
        window.Survey.start(lang);
      }
    });
  });

  $('surveyEditBtn').addEventListener('click', () => window.Survey.start(lang, () => openMenu(lang)));

  $('settingsSummary').addEventListener('click', openSetup);
  $('setupDoneBtn').addEventListener('click', () => openMenu());
  $('menuHomeBtn').addEventListener('click', () => show('start'));

  document.querySelectorAll('.activity').forEach((btn) => {
    btn.addEventListener('click', () => {
      const activity = btn.dataset.activity;
      if (activity === 'lesson') startLesson();
      else if (activity === 'story') window.Practice.startStory();
      else window.Games.start(activity);
    });
  });

  function onMic() {
    if (ended) return;
    if (phase === 'listening') {
      // To'xtatish: aytilgan gap yuboriladi.
      if (recognition) recognition.stop();
      return;
    }
    if (phase === 'thinking') return;
    // Birinchi javob kelmay qolgan bo'lsa, darsni qaytadan boshlashga urinamiz.
    if (!history.length) {
      requestReply();
      return;
    }
    listen(false);
  }

  micBtn.addEventListener('click', onMic);
  face.addEventListener('click', onMic);

  $('stopBtn').addEventListener('click', endLesson);
  $('againBtn').addEventListener('click', () => startLesson(lessonOpts));
  $('endMenuBtn').addEventListener('click', () => {
    if (lessonUnit) window.Practice.openUnit(lessonUnit);
    else if (lessonOpts.prof || lessonOpts.scenario) window.Roles.back(lessonOpts);
    else openMenu();
  });

  document.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      speakLang = pill.dataset.speak;
      document.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p === pill));
      // Tinglayotgan bo'lsak, yangi til bilan qaytadan tinglaymiz.
      if (phase === 'listening') {
        stopListening();
        listen(false);
      }
    });
  });

  $('keyboardBtn').addEventListener('click', () => {
    typeForm.hidden = !typeForm.hidden;
    if (!typeForm.hidden) typeInput.focus();
  });

  typeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = typeInput.value.trim();
    if (!text || ended || phase === 'thinking') return;
    stopListening();
    stopSpeaking();
    typeInput.value = '';
    sendUser(text);
  });

  const subsBtn = $('subsBtn');
  subsBtn.addEventListener('click', () => {
    showSubs = !showSubs;
    subsBtn.setAttribute('aria-pressed', String(showSubs));
    subtitle.style.visibility = showSubs ? 'visible' : 'hidden';
  });

  // ---------- Rang (yorug' / qorong'i) ----------

  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }

  try {
    applyTheme(localStorage.getItem(THEME_KEY));
  } catch {}

  $('themeBtn').addEventListener('click', () => {
    const current =
      document.documentElement.dataset.theme ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  });

  // O'yinlar (games.js) uchun umumiy funksiyalar.
  window.App = {
    show,
    openMenu,
    postJson,
    store,
    loadStored,
    unlockAudio,
    speak: (segments) => speakSegments(segments),
    stopSpeaking,
    lang: () => lang,
    tutor: () => TUTORS[lang],
    settings: () => settings,
    focus: loadFocus,
    profile: () => window.Survey.profile(lang),
    setSettings: (patch) => {
      settings = { ...settings, ...patch };
      saveSettings();
    },
    startLesson,
    locale: () => LOCALES[lang],
    config: () => configReady,
    bestKey: () => BEST_KEY + lang,
  };

  // Boshqa qurilmadan ma'lumot kelganda sozlamalar va menyuni yangilaymiz.
  Store.onChange(() => {
    settings = loadSettings();
    if (!screens.menu.hidden) openMenu();
  });

  // Sahifa yopilsa yoki boshqa ilovaga o'tilsa, ovozni to'xtatamiz.
  window.addEventListener('pagehide', () => {
    stopListening();
    stopSpeaking();
  });
})();
