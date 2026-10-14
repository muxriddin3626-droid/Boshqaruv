(() => {
  const LESSON_SECONDS = 10 * 60;
  const LOCALES = { ru: 'ru-RU', de: 'de-DE', uz: 'uz-UZ' };
  const TARGET_LABELS = { ru: 'Ruscha', de: 'Nemischa' };
  // Til tanlangach ustoz o'zi gap boshlashi uchun yuboriladigan (ko'rinmaydigan) xabar.
  const STARTER = 'Salom! Men boshlovchiman, keling suhbatni boshlaymiz.';
  const THEME_KEY = 'til-ustoz-theme';

  const $ = (id) => document.getElementById(id);
  const screens = { start: $('startScreen'), lesson: $('lessonScreen'), end: $('endScreen') };
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
  let history = [];
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

  // ---------- Umumiy ----------

  function show(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
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

  // ---------- Taymer ----------

  function fmt(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function tick() {
    const passed = Math.min(LESSON_SECONDS, Math.floor((Date.now() - startedAt) / 1000));
    timerEl.textContent = `${fmt(passed)} / ${fmt(LESSON_SECONDS)}`;
    if (passed >= LESSON_SECONDS && !timeUp) {
      timeUp = true;
      // Ustoz gapirayotgan yoki o'ylayotgan bo'lsa, gapini tugatgach dars yopiladi.
      if (phase === 'idle' || phase === 'listening') endLesson();
    }
  }

  // ---------- Ovoz chiqarib o'qish ----------

  let voices = [];
  function loadVoices() {
    voices = tts ? tts.getVoices() : [];
  }
  if (tts) {
    loadVoices();
    tts.addEventListener?.('voiceschanged', loadVoices);
  }

  function pickVoice(code) {
    const locale = LOCALES[code];
    const byLang = (prefix) => voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
    // O'zbek ovozi ko'p qurilmalarda yo'q — lotin yozuvini eng yaqin o'qiydigani turkcha ovoz.
    return byLang(locale.toLowerCase()) || byLang(code) || (code === 'uz' ? byLang('tr') : null) || null;
  }

  function speakOne(seg, token) {
    return new Promise((resolve) => {
      if (token !== speakToken) return resolve();
      // Taxminiy davomiylik: ovoz bo'lmasa yoki brauzer "tugadi" demasa ham davom etamiz.
      const fallbackMs = 2500 + seg.text.length * 85;
      if (!tts) {
        setTimeout(resolve, fallbackMs);
        return;
      }
      const u = new SpeechSynthesisUtterance(seg.text);
      u.lang = LOCALES[seg.lang];
      const voice = pickVoice(seg.lang);
      if (voice) u.voice = voice;
      u.rate = seg.lang === 'uz' ? 1 : 0.92;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        resolve();
      };
      const watchdog = setTimeout(finish, fallbackMs * 2);
      u.onend = finish;
      u.onerror = finish;
      tts.speak(u);
    });
  }

  async function speakReply(segments) {
    const token = ++speakToken;
    setPhase('speaking', 'Ustoz gapiryapti...');
    for (const seg of segments) {
      if (token !== speakToken) return false;
      setSubtitle(seg.text, seg.lang);
      await speakOne(seg, token);
    }
    return token === speakToken;
  }

  function stopSpeaking() {
    speakToken++;
    if (tts) tts.cancel();
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
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        rec.permissionError = !auto;
      }
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
      if (rec.permissionError) {
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, messages: history }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.segments)) {
        throw new Error(data.error || "Javob kelmadi. Qayta urinib ko'ring.");
      }
    } catch (err) {
      if (ended) return;
      // Javobsiz qolgan xabarni olib tashlaymiz, foydalanuvchi qayta gapiradi.
      if (history.length && history[history.length - 1].role === 'user' && history.length > 1) history.pop();
      Face.set(face, 'surprised');
      setSubtitle(err instanceof TypeError ? "Internet bilan aloqa yo'q." : err.message);
      setPhase('idle', 'Qayta gapirish uchun mikrofonni bosing');
      return;
    }
    if (ended) return;

    history.push({ role: 'assistant', content: JSON.stringify(data) });
    Face.set(face, data.mood);
    const finished = await speakReply(data.segments);
    if (!finished || ended) return;
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

  function startLesson(nextLang) {
    lang = nextLang;
    history = [{ role: 'user', content: STARTER }];
    userTurns = 0;
    timeUp = false;
    ended = false;
    speakLang = 'target';
    document.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p.dataset.speak === 'target'));
    $('speakTarget').textContent = TARGET_LABELS[lang];
    typeForm.hidden = true;
    setSubtitle('');
    Face.set(face, 'calm');
    show('lesson');

    // Telefonlarda ovoz faqat bosishdan keyin ishlaydi — shu bosishda "uyg'otib" qo'yamiz.
    if (tts) {
      tts.cancel();
      tts.speak(new SpeechSynthesisUtterance(''));
    }

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
    $('endText').textContent =
      userTurns > 0
        ? `${minutes} daqiqa ichida ${userTurns} marta gapirdingiz. Ofarin, shunday davom eting!`
        : "Bu safar gaplashmadik. Keyingi safar mikrofonni bosib, bemalol gapiring!";
    Face.set(document.querySelector('#endScreen .face-slot'), userTurns > 0 ? 'excited' : 'calm');
    show('end');
  }

  // ---------- Tugmalar ----------

  document.querySelectorAll('.lang-card').forEach((btn) => {
    btn.addEventListener('click', () => startLesson(btn.dataset.lang));
  });

  function onMic() {
    if (ended) return;
    if (phase === 'listening') {
      // To'xtatish: aytilgan gap yuboriladi.
      if (recognition) recognition.stop();
      return;
    }
    if (phase === 'thinking') return;
    listen(false);
  }

  micBtn.addEventListener('click', onMic);
  face.addEventListener('click', onMic);

  $('stopBtn').addEventListener('click', endLesson);
  $('againBtn').addEventListener('click', () => startLesson(lang));
  $('homeBtn').addEventListener('click', () => show('start'));

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

  // Sahifa yopilsa yoki boshqa ilovaga o'tilsa, ovozni to'xtatamiz.
  window.addEventListener('pagehide', () => {
    stopListening();
    stopSpeaking();
  });
})();
