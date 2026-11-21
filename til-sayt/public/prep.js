// Imtihonga tayyorgarlik (4 til): maqsad imtihon va sana, og'zaki sinov (Speaking mock) va yozma ish tekshiruvi.
// Ingliz tili — IELTS band (0-9); rus, nemis, koreys — ТРКИ / Goethe / TOPIK formatida, CEFR daraja (A1-C2).
window.Prep = (() => {
  const App = window.App;
  const Learn = window.Learn;
  const P = window.PREP;
  const $ = (id) => document.getElementById(id);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const PAUSE_MS = 3000; // shundan uzun jimlik — «uzun to'xtash»
  const LIMITS = { 1: 40, 2: 120, follow: 30, 3: 75 }; // har javob uchun eng ko'p soniya
  const DAY = 86400000;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function button(cls, text, onClick) {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  const body = () => $('prepBody');
  const lang = () => App.lang();
  const ex = (l = lang()) => P.EXAMS[l];
  const histKey = (l) => `tu-prep-${l}`;
  const history = (l = lang()) => ({ speak: [], write: [], seenSpeak: [], seenWrite: [], ...(App.loadStored(histKey(l)) || {}) });
  const saveHistory = (h, l = lang()) => App.store(histKey(l), h);
  const fmt = (v, l = lang()) => P.label(ex(l).scale, v);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const wordCount = (t) => String(t).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const today = () => new Date().toLocaleDateString('sv-SE');

  // O'quvchining darajasi: daraja testi → sozlamalar → anketa.
  function level() {
    const pl = window.Study.placement(lang());
    if (pl && pl.level) return pl.level === 'A0' ? 'A1' : pl.level;
    const s = { a1: 'A1', b1: 'B1', b2: 'B2' }[App.settings().level];
    if (s) return s;
    const prof = App.profile() || {};
    return { zero: 'A1', little: 'A2', middle: 'B1', good: 'B2' }[prof.level] || 'A2';
  }

  // Har yangi jarayon (yoki orqaga chiqish) eski jarayonni bekor qiladi.
  let run = 0;
  let timer = null;
  let rec = null;
  let back = null;

  function stopAll() {
    run++;
    clearInterval(timer);
    timer = null;
    if (rec) {
      rec.onend = null;
      rec.onresult = null;
      try {
        rec.abort();
      } catch {}
      rec = null;
    }
    App.stopSpeaking();
  }

  function screen(title, onBack) {
    stopAll();
    $('prepTitle').textContent = title;
    $('prepScore').textContent = '';
    body().textContent = '';
    back = onBack || (() => App.openMenu());
    window.scrollTo(0, 0);
    App.show('prep');
  }

  // =====================================================================
  // Maqsad: imtihon, sana va kerakli natija
  // =====================================================================

  const goalKey = (l) => `tu-goal-${l}`;
  const goal = (l = lang()) => App.loadStored(goalKey(l));
  function daysLeft(g) {
    if (!g || !g.date) return null;
    const d = Math.ceil((new Date(`${g.date}T00:00:00`) - new Date(`${today()}T00:00:00`)) / DAY);
    return Number.isFinite(d) ? d : null;
  }

  function examOptions(l) {
    const list = ((window.EXAMS.EXAMS || {})[l] || []).map((e) => ({ id: e.id, name: e.name }));
    return list.length ? list : [{ id: 'main', name: ex(l).exam }];
  }

  function goalBox() {
    const l = lang();
    const g = goal(l);
    const box = el('section', 'ie-goal');
    const left = daysLeft(g);
    if (g && left != null && left >= 0) {
      const name = (examOptions(l).find((x) => x.id === g.exam) || {}).name || ex(l).exam;
      box.append(el('span', 'ie-tag', '🎯 Maqsad'), el('b', 'ie-goal-big', left === 0 ? 'Imtihon bugun! Omad! 🍀' : `${left} kun qoldi`));
      box.appendChild(el('p', '', `${name}${g.target ? ` · kerakli natija: ${g.target}` : ''} · ${g.date.split('-').reverse().join('.')}`));
      const last = [...history(l).speak, ...history(l).write].sort((a, b) => (a.at || 0) - (b.at || 0)).pop();
      if (last) box.appendChild(el('p', 'hint-left', `Oxirgi sinov natijangiz: ${fmt(last.overall, l)}. «Bugungi dars» rejasiga har kuni sinov qadami qo'shildi.`));
      box.appendChild(button('secondary', "✏️ O'zgartirish", () => editGoal()));
    } else {
      box.append(
        el('span', 'ie-tag', '🎯 Maqsad'),
        el('b', 'ie-goal-big', 'Imtihon sanangizni kiriting'),
        el('p', '', "Sana va kerakli natijani yozing — har kuni «Bugungi dars»da imtihonga mos mashq beriladi va necha kun qolgani ko'rinib turadi.")
      );
      box.appendChild(button('primary', '➕ Maqsad qo\'yish', () => editGoal()));
    }
    return box;
  }

  function editGoal() {
    const l = lang();
    const g = goal(l) || {};
    const d = $('goalDialog');
    const sel = $('goalExam');
    sel.textContent = '';
    for (const o of examOptions(l)) {
      const opt = el('option', '', o.name);
      opt.value = o.id;
      sel.appendChild(opt);
    }
    if (g.exam) sel.value = g.exam;
    const min = today();
    $('goalDate').min = min;
    $('goalDate').value = g.date || new Date(Date.now() + 60 * DAY).toLocaleDateString('sv-SE');
    $('goalTarget').value = g.target || '';
    $('goalTarget').placeholder = ex(l).scale === 'band' ? 'Masalan: 6.5' : 'Masalan: B1 yoki 2-daraja';
    $('goalClear').hidden = !g.date;
    d.showModal();
  }

  $('goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = $('goalDate').value;
    if (!date) return;
    App.store(goalKey(lang()), { exam: $('goalExam').value, date, target: $('goalTarget').value.trim().slice(0, 20), at: Date.now() });
    $('goalDialog').close();
    window.Plan.rebuild();
    window.Practice.toast('🎯 Maqsad saqlandi — rejaga sinov qadami qo\'shildi');
    open();
  });
  $('goalCancel').addEventListener('click', () => $('goalDialog').close());
  $('goalClear').addEventListener('click', () => {
    App.store(goalKey(lang()), null);
    $('goalDialog').close();
    window.Plan.rebuild();
    open();
  });

  // =====================================================================
  // Bosh sahifa
  // =====================================================================

  function chart(list, l) {
    const box = el('div', 'ie-history');
    const max = P.maxOf(ex(l).scale);
    list.slice(-8).forEach((r) => {
      const col = el('div', 'ie-hcol');
      const bar = el('div', 'ie-hbar');
      bar.style.height = `${Math.max(8, (r.overall / max) * 100)}%`;
      col.append(el('b', '', fmt(r.overall, l)), bar, el('span', '', r.date.slice(5).split('-').reverse().join('.')));
      box.appendChild(col);
    });
    return box;
  }

  function open() {
    const l = lang();
    const e = ex(l);
    screen(`🎓 ${e.exam}ga tayyorgarlik`);
    const b = body();
    b.appendChild(goalBox());

    const h = history(l);
    const tiles = el('div', 'ie-tiles');
    const tile = (icon, title, desc, onClick) => {
      const t = button('big-card ie-tile', '', onClick);
      const text = el('span', 'act-text');
      text.append(el('span', 'act-title', title), el('span', 'act-desc', desc));
      t.append(el('span', 'act-icon', icon), text);
      return t;
    };
    const lastS = h.speak[h.speak.length - 1];
    const lastW = h.write[h.write.length - 1];
    tiles.append(
      tile('🎤', `Og'zaki sinov · ${e.speakName}`, lastS ? `Oxirgi natija: ${fmt(lastS.overall, l)} · ${h.speak.length} ta sinov` : "Imtihonchi ovozda so'raydi, 3 qism, 12-14 daqiqa", openSpeak),
      tile('✍️', 'Yozma ish tekshiruvi', lastW ? `Oxirgi natija: ${fmt(lastW.overall, l)} · ${h.write.length} ta ish` : `${e.writing.map((k) => k.title.split(' — ')[0]).join(' / ')} — AI 4 mezon bo'yicha baholaydi`, openWrite),
      tile('📝', "To'liq sinov imtihonlari", "O'qish, tinglash, yozish va gapirish bo'limlari — vaqt bilan", () => window.Exam.openList()),
      tile('🧮', 'Bepul vositalar', "Ball kalkulyatori va mavzu generatori", () => window.open('/tools.html', '_blank', 'noopener'))
    );
    b.appendChild(tiles);

    if (h.speak.length) b.append(el('h2', 'vc-h', "🎤 Og'zaki sinov natijalari"), chart(h.speak, l));
    if (h.write.length) b.append(el('h2', 'vc-h', '✍️ Yozma ish natijalari'), chart(h.write, l));
    b.appendChild(
      el(
        'p',
        'hint-left',
        e.scale === 'band'
          ? 'Natijalar IELTS band (0-9) shkalasida. Sinov bahosi haqiqiy imtihon natijasidan farq qilishi mumkin.'
          : `Natijalar CEFR darajasida (A1 — boshlang'ich, B1 — o'rta, C1 — yuqori). Sizning darajangiz: ${level()} — savollar shunga moslanadi.`
      )
    );
  }

  // =====================================================================
  // Og'zaki sinov
  // =====================================================================

  let test = null;
  let answers = [];

  function openSpeak() {
    const l = lang();
    const e = ex(l);
    screen(`🎤 ${e.speakName}`, open);
    const b = body();
    const head = el('div', 'hg-intro');
    head.append(
      el('h2', 'vc-goal', `${e.speakName} — sinov`),
      el(
        'p',
        'hint-left',
        `Haqiqiy imtihondagidek: imtihonchi savollarni ovozda beradi, siz mikrofonga javob berasiz. 3 qism, 12-14 daqiqa. Oxirida 4 mezon bo'yicha ${e.scale === 'band' ? 'band ball' : 'CEFR daraja'}, xatolaringiz va namunaviy javob.`
      )
    );
    const parts = el('div', 'ie-parts');
    [
      [e.parts[0], "O'zingiz haqingizda 4 ta savol (har biriga ~30 soniya)"],
      [e.parts[1], '1 daqiqa tayyorgarlik, keyin 2 daqiqagacha gapirasiz'],
      [e.parts[2], "Mavzu bo'yicha chuqurroq 4 ta savol"],
    ].forEach(([t, d], i) => {
      const p = el('div', 'ie-part');
      p.append(el('span', 'ie-part-n', String(i + 1)), el('b', '', `${i + 1}-qism · ${t}`), el('span', '', d));
      parts.appendChild(p);
    });
    b.append(head, parts);
    const h = history(l).speak;
    if (h.length) b.append(el('h2', 'vc-h', 'Natijalarim'), chart(h, l));
    const actions = el('div', 'hg-extra');
    if (!SR) actions.appendChild(el('p', 'hint-left', "⚠️ Bu brauzer ovozni tanimaydi — javoblarni yozib berasiz. To'liq sinov uchun Chrome'da oching."));
    if (e.scale !== 'band') actions.appendChild(el('p', 'hint-left', `Savollar darajasi: ${level()}. Savolning o'zbekcha tarjimasi ostida turadi.`));
    actions.appendChild(el('p', 'hint-left', "Maslahat: tinch joyda, telefonni yaqin tutib gapiring. To'liq gaplar bilan, misollar keltirib javob bering — qisqa javob bahoni pasaytiradi."));
    actions.appendChild(button('primary big', '▶ Sinovni boshlash', startSpeak));
    b.appendChild(actions);
  }

  async function startSpeak() {
    App.unlockAudio();
    const l = lang();
    const e = ex(l);
    const lv = level();
    screen(`🎤 ${e.speakName}`, openSpeak);
    const my = run;
    body().appendChild(el('p', 'hint-left', '⏳ Imtihonchi savollarni tayyorlayapti...'));
    try {
      test = await App.postJson('/api/prep/speak-test', { lang: l, level: lv, seen: history(l).seenSpeak });
    } catch (err) {
      if (my !== run) return;
      body().textContent = '';
      body().append(el('p', 'error', err.message), button('primary', 'Qayta urinish', startSpeak));
      return;
    }
    if (my !== run) return;
    answers = [];
    const h = history(l);
    h.seenSpeak = [test.part2.task, ...h.seenSpeak.filter((x) => x !== test.part2.task)].slice(0, 30);
    saveHistory(h, l);

    const say = (text) => App.speak([{ lang: l, text }]);
    const steps = [
      { part: 1, intro: e.phrases.part1(test.part1.topic) },
      ...test.part1.questions.map((q, i) => ({ part: 1, question: q, uz: test.part1.questions_uz[i] })),
      { part: 2, cue: true },
      { part: 2, question: test.part2.followup, limit: LIMITS.follow },
      { part: 3, intro: e.phrases.part3 },
      ...test.part3.questions.map((q, i) => ({ part: 3, question: q, uz: test.part3.questions_uz[i] })),
    ];
    const total = steps.filter((s) => s.question || s.cue).length;
    let n = 0;
    for (const s of steps) {
      if (my !== run) return;
      if (s.intro) {
        await say(s.intro);
        continue;
      }
      n++;
      $('prepScore').textContent = `${n}/${total}`;
      const a = s.cue ? await cueCard(my) : await ask(my, s.part, s.question, s.uz, s.limit || LIMITS[s.part]);
      if (my !== run || !a) return;
      answers.push(a);
    }
    await say(e.phrases.end);
    if (my === run) gradeSpeak(my, lv);
  }

  // Savolni beradi va javobni yozib oladi.
  async function ask(my, part, question, uz, limit) {
    const b = body();
    b.textContent = '';
    const card = el('section', 'ie-card');
    card.append(el('span', 'ie-tag', `${part}-qism · ${ex().parts[part - 1]}`), el('p', 'ie-q', question));
    if (uz) card.appendChild(el('p', 'speak-tr', uz));
    b.appendChild(card);
    const status = el('p', 'heard', '🔊 Imtihonchi gapiryapti...');
    b.appendChild(status);
    await App.speak([{ lang: lang(), text: question }]);
    if (my !== run) return null;
    return listen(my, b, status, limit, (r) => ({ part, question, ...r }));
  }

  function listen(my, b, status, limit, wrap) {
    const fillers = new RegExp(ex().fillers, 'giu');
    return new Promise((resolve) => {
      const live = el('p', 'ie-live');
      const meter = el('div', 'ie-meter');
      const fill = el('div', 'ie-meter-fill');
      meter.appendChild(fill);
      const clock = el('span', 'ie-clock', mmss(limit));
      const row = el('div', 'control-row');
      const area = SR ? null : el('textarea', 'exam-text');
      if (area) {
        area.rows = 5;
        area.placeholder = 'Javobingizni yozing...';
      }
      let finalText = '';
      let interim = '';
      let started = Date.now();
      let lastVoice = Date.now();
      let pauses = 0;
      const conf = [];
      let done = false;

      const finish = () => {
        if (done || my !== run) return;
        done = true;
        clearInterval(timer);
        timer = null;
        if (rec) {
          rec.onend = null;
          try {
            rec.stop();
          } catch {}
          rec = null;
        }
        const text = (area ? area.value : `${finalText} ${interim}`).replace(/\s+/g, ' ').trim();
        resolve(
          wrap({
            text,
            seconds: Math.max(1, Math.round((Date.now() - started) / 1000)),
            words: wordCount(text),
            pauses,
            fillers: (text.match(fillers) || []).length,
            confidence: conf.length ? conf.reduce((s, x) => s + x, 0) / conf.length : 0,
          })
        );
      };

      const startRec = () => {
        const r = new SR();
        rec = r;
        r.lang = App.locale();
        r.continuous = true;
        r.interimResults = true;
        r.onresult = (e) => {
          const now = Date.now();
          if (now - lastVoice > PAUSE_MS && finalText) pauses++;
          lastVoice = now;
          interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const x = e.results[i];
            if (x.isFinal) {
              finalText += ' ' + x[0].transcript;
              if (x[0].confidence > 0) conf.push(x[0].confidence);
            } else interim += x[0].transcript;
          }
          live.textContent = `${finalText} ${interim}`.trim();
        };
        r.onerror = (e) => {
          if (e.error === 'not-allowed') status.textContent = 'Mikrofonga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering.';
        };
        // Brauzer jimlikda tinglashni o'zi to'xtatadi — vaqt tugamaguncha qayta ishga tushiramiz.
        r.onend = () => {
          if (!done && my === run && rec === r) {
            try {
              r.start();
            } catch {
              rec = null;
            }
          }
        };
        try {
          r.start();
        } catch {}
      };

      status.textContent = SR ? '🎙️ Gapiring — sizni eshityapman' : '';
      row.append(clock);
      b.append(meter, row, area || live, button('primary big', '✅ Javobni tugatdim', finish));
      started = Date.now();
      lastVoice = started;
      if (SR) startRec();
      clearInterval(timer);
      timer = setInterval(() => {
        if (my !== run) return clearInterval(timer);
        const left = limit - Math.floor((Date.now() - started) / 1000);
        clock.textContent = mmss(Math.max(0, left));
        fill.style.width = `${Math.min(100, ((limit - left) / limit) * 100)}%`;
        clock.classList.toggle('low', left <= 10);
        if (left <= 0) finish();
      }, 250);
      if (area) area.focus();
    });
  }

  // 2-qism: mavzu kartasi, 1 daqiqa tayyorgarlik (qoralama bilan), keyin 2 daqiqagacha nutq.
  async function cueCard(my) {
    const c = test.part2;
    const e = ex();
    const b = body();
    b.textContent = '';
    const card = el('section', 'ie-card ie-cue');
    card.append(el('span', 'ie-tag', `2-qism · ${e.parts[1]}`), el('p', 'ie-q', c.task), el('p', 'ie-sub', e.phrases.youShould));
    const ul = el('ul', 'ie-bullets');
    c.bullets.forEach((x) => ul.appendChild(el('li', '', x)));
    card.append(ul, el('p', 'speak-tr', c.task_uz));
    b.appendChild(card);
    await App.speak([{ lang: lang(), text: e.phrases.cue(c.task) }]);
    if (my !== run) return null;

    const notes = el('textarea', 'exam-text ie-notes');
    notes.rows = 3;
    notes.placeholder = "Qoralama: kalit so'zlarni yozib oling (ixtiyoriy)";
    const clock = el('span', 'ie-clock', '1:00');
    const go = el('div', 'control-row');
    let resolvePrep;
    const prep = new Promise((r) => (resolvePrep = r));
    const ready = button('primary big', '🎙️ Tayyorman — gapirishni boshlash', () => resolvePrep());
    const hint = el('p', 'hint-left', '⏱️ Tayyorgarlik — 1 daqiqa');
    go.appendChild(clock);
    b.append(hint, go, notes, ready);
    const t0 = Date.now();
    clearInterval(timer);
    timer = setInterval(() => {
      const left = 60 - Math.floor((Date.now() - t0) / 1000);
      clock.textContent = mmss(Math.max(0, left));
      clock.classList.toggle('low', left <= 10);
      if (left <= 0) resolvePrep();
    }, 250);
    await prep;
    clearInterval(timer);
    timer = null;
    if (my !== run) return null;
    const keep = notes.value.trim();
    [notes, ready, go, hint].forEach((x) => x.remove());
    if (keep) card.appendChild(el('p', 'ie-sub', `📝 ${keep}`));
    const status = el('p', 'heard', '🔊 Imtihonchi gapiryapti...');
    b.appendChild(status);
    await App.speak([{ lang: lang(), text: e.phrases.start }]);
    if (my !== run) return null;
    return listen(my, b, status, LIMITS[2], (r) => ({ part: 2, question: c.task, ...r }));
  }

  async function gradeSpeak(my, lv) {
    $('prepScore').textContent = '';
    const b = body();
    b.textContent = '';
    b.appendChild(el('p', 'hint-left', '⏳ Imtihonchi javoblaringizni baholayapti...'));
    try {
      const g = await App.postJson('/api/prep/speak-grade', { lang: lang(), level: lv, answers });
      if (my !== run) return;
      showResult('speak', g);
    } catch (err) {
      if (my !== run) return;
      b.textContent = '';
      b.append(el('p', 'error', err.message), button('primary', 'Qayta baholash', () => gradeSpeak(run, lv)));
    }
  }

  function speakStats() {
    const seconds = answers.reduce((n, a) => n + a.seconds, 0);
    const words = answers.reduce((n, a) => n + a.words, 0);
    const part2 = answers.find((a) => a.part === 2);
    return {
      wpm: seconds ? Math.round((words / seconds) * 60) : 0,
      pauses: answers.reduce((n, a) => n + a.pauses, 0),
      fillers: answers.reduce((n, a) => n + a.fillers, 0),
      part2: part2 ? part2.seconds : 0,
    };
  }

  // =====================================================================
  // Yozma ish tekshiruvi
  // =====================================================================

  let draft = null; // { kind, task, task_uz, points, minWords, minutes, own }
  const draftKey = (l) => `tu-prep-draft-${l}`;

  function openWrite() {
    const l = lang();
    const e = ex(l);
    screen('✍️ Yozma ish tekshiruvi', open);
    const b = body();
    const head = el('div', 'hg-intro');
    head.append(
      el('h2', 'vc-goal', `${e.exam} formatida yozma ish`),
      el('p', 'hint-left', `Topshiriq tanlang yoki o'zingiznikini kiriting, yozing — AI 4 mezon bo'yicha ${e.scale === 'band' ? 'band ball' : 'CEFR daraja'} qo'yadi, xatolarni ko'rsatadi va tuzatilgan variantini beradi.`)
    );
    b.appendChild(head);
    const saved = App.loadStored(draftKey(l));
    if (saved && saved.text && saved.task) {
      b.appendChild(button('primary big', `📝 Yozilgan ishni davom ettirish (${wordCount(saved.text)} so'z)`, () => editor(saved, saved.text)));
    }
    const list = el('div', 'ie-tiles');
    e.writing.forEach((k) => {
      const t = button('big-card ie-tile', '', () => newTask(k));
      const text = el('span', 'act-text');
      text.append(el('span', 'act-title', k.title), el('span', 'act-desc', `kamida ${k.minWords} so'z · ${k.minutes} daqiqa`));
      t.append(el('span', 'act-icon', '📄'), text);
      list.appendChild(t);
    });
    const own = button('big-card ie-tile', '', ownTask);
    const ownText = el('span', 'act-text');
    ownText.append(el('span', 'act-title', "O'z topshirig'im"), el('span', 'act-desc', "Kitobdagi yoki o'qituvchi bergan mavzuni kiriting"));
    own.append(el('span', 'act-icon', '✏️'), ownText);
    list.appendChild(own);
    b.appendChild(list);
    const h = history(l).write;
    if (h.length) b.append(el('h2', 'vc-h', 'Natijalarim'), chart(h, l));
  }

  async function newTask(k) {
    const l = lang();
    screen('✍️ Yozma ish tekshiruvi', openWrite);
    const my = run;
    body().appendChild(el('p', 'hint-left', '⏳ Topshiriq tayyorlanmoqda...'));
    try {
      const t = await App.postJson('/api/prep/write-task', { lang: l, level: level(), kind: k.id, seen: history(l).seenWrite });
      if (my !== run) return;
      const h = history(l);
      h.seenWrite = [t.task.slice(0, 160), ...h.seenWrite].slice(0, 30);
      saveHistory(h, l);
      editor(t, '');
    } catch (err) {
      if (my !== run) return;
      body().textContent = '';
      body().append(el('p', 'error', err.message), button('primary', 'Qayta urinish', () => newTask(k)));
    }
  }

  function ownTask() {
    screen("✍️ O'z topshirig'im", openWrite);
    const e = ex();
    const b = body();
    const sel = el('select', 'ie-select');
    e.writing.forEach((k) => {
      const o = el('option', '', k.title);
      o.value = k.id;
      sel.appendChild(o);
    });
    const area = el('textarea', 'exam-text');
    area.rows = 5;
    area.placeholder = 'Topshiriq matnini shu yerga yozing yoki nusxalab qo\'ying';
    const err = el('p', 'error');
    b.append(el('p', 'hint-left', 'Turi:'), sel, el('p', 'hint-left', 'Topshiriq:'), area, err);
    b.appendChild(
      button('primary big', 'Davom etish →', () => {
        const task = area.value.trim();
        if (task.length < 10) {
          err.textContent = 'Topshiriq matnini kiriting.';
          return;
        }
        const k = e.writing.find((x) => x.id === sel.value);
        editor({ kind: k.id, task, task_uz: '', points: [], minWords: k.minWords, minutes: k.minutes, own: true }, '');
      })
    );
  }

  function editor(t, text) {
    const l = lang();
    draft = t;
    screen('✍️ Yozma ish', openWrite);
    const b = body();
    const card = el('section', 'ie-card');
    card.append(el('span', 'ie-tag', (ex(l).writing.find((k) => k.id === t.kind) || {}).title || 'Topshiriq'), el('p', 'ie-task', t.task));
    if (t.task_uz) card.appendChild(el('p', 'speak-tr', t.task_uz));
    if (t.points && t.points.length) {
      const ul = el('ul', 'ie-bullets small');
      t.points.forEach((x) => ul.appendChild(el('li', '', x)));
      card.appendChild(ul);
    }
    b.appendChild(card);
    const info = el('div', 'ie-write-info');
    const words = el('span', 'ie-words');
    const clock = el('span', 'ie-clock small', mmss(t.minutes * 60));
    info.append(words, clock);
    const area = el('textarea', 'exam-text ie-essay');
    area.rows = 14;
    area.value = text || '';
    area.placeholder = `Shu yerga yozing (kamida ${t.minWords} so'z)...`;
    area.spellcheck = false;
    area.setAttribute('autocorrect', 'off');
    const submit = button('primary big', '✅ Tekshirish', () => gradeWrite(t, area.value, Math.round((Date.now() - started) / 60000)));
    const upd = () => {
      const n = wordCount(area.value);
      words.textContent = `${n} / ${t.minWords} so'z`;
      words.classList.toggle('ok', n >= t.minWords);
      submit.disabled = n < 5;
      App.store(draftKey(l), { ...t, text: area.value });
    };
    area.addEventListener('input', upd);
    b.append(info, area, submit, el('p', 'hint-left', "Yozganingiz avtomatik saqlanadi. Vaqt — faqat mo'ljal: tugasa ham yozishni davom ettirishingiz mumkin."));
    upd();
    const started = Date.now();
    clearInterval(timer);
    timer = setInterval(() => {
      const left = t.minutes * 60 - Math.floor((Date.now() - started) / 1000);
      clock.textContent = left >= 0 ? mmss(left) : `+${mmss(-left)}`;
      clock.classList.toggle('low', left <= 60);
    }, 1000);
    area.focus();
  }

  async function gradeWrite(t, text, minutes) {
    const l = lang();
    screen('✍️ Yozma ish', openWrite);
    const my = run;
    body().appendChild(el('p', 'hint-left', '⏳ Imtihonchi ishingizni tekshiryapti...'));
    try {
      const g = await App.postJson('/api/prep/write-grade', { lang: l, level: level(), kind: t.kind, task: t.task, text, minutes });
      if (my !== run) return;
      App.store(draftKey(l), null);
      showResult('write', g, { text, task: t });
    } catch (err) {
      if (my !== run) return;
      body().textContent = '';
      body().append(el('p', 'error', err.message), button('primary', 'Qayta urinish', () => gradeWrite(t, text, minutes)), button('secondary', '← Tahrirlash', () => editor(t, text)));
    }
  }

  // =====================================================================
  // Natija (og'zaki va yozma uchun umumiy)
  // =====================================================================

  function showResult(kind, g, extra = {}) {
    const l = lang();
    const e = ex(l);
    const criteria = (kind === 'speak' ? P.SPEAK_CRITERIA : P.WRITE_CRITERIA)[e.scale];
    const max = P.maxOf(e.scale);
    const h = history(l);
    const list = h[kind];
    const prev = list.length ? list[list.length - 1].overall : null;
    list.push({ date: today(), at: Date.now(), overall: g.overall, bands: Object.fromEntries(criteria.map(([k]) => [k, g.criteria[k].band])) });
    h[kind] = list.slice(-20);
    saveHistory(h, l);
    if (g.mistakes.length) Learn.addMistakes(l, g.mistakes);
    Learn.bumpStat(kind === 'speak' ? 'speakMocks' : 'writeChecks');
    window.dispatchEvent(new CustomEvent('tu:done', { detail: { kind: kind === 'speak' ? 'speakmock' : 'writing' } }));
    window.Practice.awardXp(kind === 'speak' ? 30 : 25, kind === 'speak' ? "Og'zaki sinov" : 'Yozma ish');

    screen(kind === 'speak' ? `🎤 ${e.speakName}` : '✍️ Yozma ish', kind === 'speak' ? openSpeak : openWrite);
    const b = body();
    const top = el('div', 'ie-band');
    top.append(el('span', 'ie-band-k', e.scale === 'band' ? 'Overall band' : 'Umumiy daraja'), el('span', 'ie-band-v', fmt(g.overall, l)));
    if (prev != null) {
      const d = g.overall - prev;
      top.appendChild(el('span', `ie-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`, d ? `${d > 0 ? '▲' : '▼'} oldingi: ${fmt(prev, l)}` : 'oldingi bilan bir xil'));
    }
    top.appendChild(el('span', 'ie-note', 'Sinov bahosi — haqiqiy imtihon natijasidan farq qilishi mumkin.'));
    b.appendChild(top);

    const crit = el('div', 'ie-crits');
    for (const [k, en, uz] of criteria) {
      const c = g.criteria[k];
      const row = el('div', 'ie-crit');
      const head = el('div', 'ie-crit-head');
      head.append(el('b', '', uz), el('span', 'ie-crit-band', fmt(c.band, l)));
      const bar = el('div', 'xp-bar');
      const fill = el('div', 'xp-fill');
      fill.style.width = `${(c.band / max) * 100}%`;
      bar.appendChild(fill);
      row.append(head);
      if (en !== uz) row.appendChild(el('span', 'ie-crit-en', en));
      row.append(bar, el('p', '', c.comment));
      crit.appendChild(row);
    }
    b.appendChild(crit);

    if (kind === 'speak') {
      const s = speakStats();
      b.appendChild(el('h2', 'vc-h', "📈 Ravonlik ko'rsatkichlari"));
      const grid = el('div', 'ie-stats');
      [
        [`${s.wpm}`, "so'z/daqiqa", s.wpm > 190 ? 'juda tez — sekinroq, aniqroq' : s.wpm >= 100 ? 'yaxshi temp' : s.wpm >= 70 ? 'biroz sekin' : "sekin — ko'proq gapiring"],
        [mmss(s.part2), '2-qism nutqi', s.part2 >= 100 ? "a'lo" : s.part2 >= 60 ? 'yetarli' : 'kamida 1:30 kerak'],
        [`${s.pauses}`, "uzun to'xtash", s.pauses <= 3 ? 'kam' : "ko'p — bog'lovchilar ishlating"],
        [`${s.fillers}`, "«eee», «um»...", s.fillers <= 3 ? 'kam' : "ko'p"],
      ].forEach(([v, k2, d]) => {
        const c = el('div', 'ie-stat');
        c.append(el('b', '', v), el('span', '', k2), el('small', '', d));
        grid.appendChild(c);
      });
      b.appendChild(grid);
    } else {
      const words = g.words || wordCount(extra.text || '');
      const need = (extra.task && extra.task.minWords) || 0;
      b.appendChild(el('p', `study-expl ${words >= need ? 'ok' : 'bad'}`, `Hajm: ${words} so'z${need ? ` (kerak: kamida ${need})` : ''}`));
    }

    if (g.summary) b.appendChild(el('p', 'study-expl ok', g.summary));
    if (g.tips.length) {
      b.appendChild(el('h2', 'vc-h', '🎯 Keyingi darajaga chiqish uchun'));
      const ul = el('ul', 'ie-tips');
      g.tips.forEach((t) => ul.appendChild(el('li', '', t)));
      b.appendChild(ul);
    }
    if (g.mistakes.length) {
      b.appendChild(el('h2', 'vc-h', '❌ Xatolar'));
      const box = el('div', 'vc-words');
      g.mistakes.forEach((m) => {
        const row = button('vc-word', '', () => App.speak([{ lang: l, text: m.correct }]));
        row.append(el('s', 'vc-ex-uz', m.wrong), el('b', '', m.correct), el('span', 'vc-ex-uz', m.explanation));
        box.appendChild(row);
      });
      b.append(box, el('p', 'hint-left', "Bu xatolar «🔁 Xatolarim» mashqiga qo'shildi."));
    }
    if (kind === 'write' && g.corrected) {
      b.appendChild(el('h2', 'vc-h', '✅ Tuzatilgan va yaxshilangan variant'));
      const box = el('section', 'ie-card');
      box.appendChild(el('p', 'ie-model', g.corrected));
      box.appendChild(button('secondary', '🔊 Tinglash', () => App.speak([{ lang: l, text: g.corrected }])));
      b.appendChild(box);
      if (extra.text) {
        const d = el('details', 'ie-ans');
        d.append(el('summary', '', 'Sizning matningiz'), el('p', '', extra.text));
        b.appendChild(d);
      }
    }
    if (kind === 'speak' && g.better && g.better.answer) {
      b.appendChild(el('h2', 'vc-h', `⭐ ${e.scale === 'band' ? 'Band 7.5+' : 'Yuqori darajadagi'} namunaviy javob`));
      const box = el('section', 'ie-card');
      box.append(el('p', 'ie-sub', g.better.question), el('p', 'ie-model', g.better.answer));
      box.appendChild(button('secondary', '🔊 Tinglash', () => App.speak([{ lang: l, text: g.better.answer }])));
      b.appendChild(box);
    }
    if (g.vocab.length) {
      b.appendChild(el('h2', 'vc-h', '📚 Foydali iboralar'));
      const box = el('div', 'vc-words');
      g.vocab.forEach((v) => {
        const row = button('vc-word', '', () => {
          Learn.addWord(l, v.word, v.translation);
          row.classList.add('mastered');
          window.Practice.toast("➕ Takrorlash daftariga qo'shildi");
        });
        const head = el('span', 'vc-word-head');
        head.append(el('b', '', v.word), el('span', 'dr-dots', '➕'));
        row.append(head, el('span', 'vc-ex-uz', v.translation));
        box.appendChild(row);
      });
      b.appendChild(box);
    }
    if (kind === 'speak') {
      b.appendChild(el('h2', 'vc-h', '📝 Javoblaringiz'));
      answers.forEach((a) => {
        const d = el('details', 'ie-ans');
        d.append(el('summary', '', `${a.part}-qism: ${a.question}`), el('p', '', a.text || '(javob berilmagan)'), el('small', '', `${a.seconds} soniya · ${a.words} so'z`));
        b.appendChild(d);
      });
    }

    const actions = el('div', 'end-actions');
    actions.append(
      button('primary', kind === 'speak' ? '🔁 Yangi sinov' : '✍️ Yangi topshiriq', kind === 'speak' ? startSpeak : openWrite),
      button('secondary', '📤 Ulashish', () =>
        window.Share.share({
          emoji: kind === 'speak' ? '🎤' : '✍️',
          kicker: `${kind === 'speak' ? e.speakName : `${e.exam} · yozma ish`} · sinov`,
          big: fmt(g.overall, l),
          title: e.scale === 'band' ? 'band' : 'daraja',
          sub: criteria.map(([k, , uz]) => `${uz.replace(' (taxminiy)', '')}: ${fmt(g.criteria[k].band, l)}`).join(' · '),
          text: `${e.exam} ${kind === 'speak' ? "og'zaki" : 'yozma'} sinovidan ${fmt(g.overall, l)} oldim ${kind === 'speak' ? '🎤' : '✍️'} Siz ham sinab ko'ring:`,
          theme: 'plum',
        })
      ),
      button('secondary', '🎓 Tayyorgarlik', open)
    );
    b.appendChild(actions);
  }

  // =====================================================================
  // Menyu kartasi
  // =====================================================================

  function renderCard() {
    const l = lang();
    const e = ex(l);
    $('prepCardTitle').textContent = `${e.exam}ga tayyorgarlik`;
    const g = goal(l);
    const left = daysLeft(g);
    const h = history(l);
    const last = [...h.speak, ...h.write].sort((a, b) => (a.at || 0) - (b.at || 0)).pop();
    const parts = [];
    if (left != null && left >= 0) parts.push(left ? `🎯 Imtihongacha ${left} kun` : '🎯 Imtihon bugun!');
    parts.push(last ? `oxirgi natija: ${fmt(last.overall, l)}` : "og'zaki sinov, yozma ish tekshiruvi, maqsad sanasi");
    $('prepDesc').textContent = parts.join(' · ');
    $('prepBadge').textContent = left != null && left >= 0 ? `${left} kun` : e.scale === 'band' ? 'band' : 'CEFR';
  }

  $('prepCard').addEventListener('click', open);
  $('prepBack').addEventListener('click', () => {
    stopAll();
    (back || (() => App.openMenu()))();
  });

  return { open, openSpeak, openWrite, startSpeak, renderCard, goal, daysLeft, examOptions };
})();
