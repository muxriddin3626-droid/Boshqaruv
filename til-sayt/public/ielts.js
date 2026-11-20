// IELTS Speaking sinov imtihoni (faqat ingliz tili).
// Imtihonchi savollarni ovozda beradi, o'quvchi mikrofonga javob beradi:
// Part 1 — tanishuv savollari, Part 2 — cue card (1 daqiqa tayyorgarlik + 2 daqiqa nutq), Part 3 — munozara.
// Oxirida 4 rasmiy mezon bo'yicha band ball, ravonlik ko'rsatkichlari, xatolar va namunaviy javob.
window.Ielts = (() => {
  const App = window.App;
  const Learn = window.Learn;
  const $ = (id) => document.getElementById(id);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const HISTORY = 'tu-ielts';
  const PAUSE_MS = 3000; // shundan uzun jimlik — «uzun to'xtash»
  const FILLERS = /\b(u+m+|u+h+|e+r+m*|hmm+|a+h+|you know|i mean)\b/gi;
  const LIMITS = { 1: 40, 2: 120, follow: 30, 3: 75 }; // har javob uchun eng ko'p soniya
  const CRITERIA = [
    ['fluency', 'Fluency & Coherence', 'Ravonlik va bog\'liqlik'],
    ['lexical', 'Lexical Resource', "So'z boyligi"],
    ['grammar', 'Grammatical Range & Accuracy', 'Grammatika'],
    ['pronunciation', 'Pronunciation', 'Talaffuz (taxminiy)'],
  ];

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

  const body = () => $('ieltsBody');
  const history = () => App.loadStored(HISTORY) || { results: [], seen: [] };
  const fmt = (b) => (Number.isInteger(b) ? `${b}.0` : String(b));
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const wordCount = (t) => (t.match(/[A-Za-z']+/g) || []).length;

  // Har yangi imtihon (yoki orqaga chiqish) eski jarayonni bekor qiladi.
  let run = 0;
  let timer = null;
  let rec = null;

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

  function screen() {
    stopAll();
    $('ieltsScore').textContent = '';
    body().textContent = '';
    window.scrollTo(0, 0);
    App.show('ielts');
  }

  // ---------- Kirish sahifasi ----------

  function open() {
    screen();
    const b = body();
    const head = el('div', 'hg-intro');
    head.append(
      el('h2', 'vc-goal', 'IELTS Speaking — sinov imtihoni'),
      el(
        'p',
        'hint-left',
        "Haqiqiy imtihondagidek: imtihonchi savollarni ovozda beradi, siz mikrofonga javob berasiz. 3 qism, 12-14 daqiqa. Oxirida 4 rasmiy mezon bo'yicha band ball, xatolaringiz va yuqori balli namunaviy javob."
      )
    );
    const parts = el('div', 'ie-parts');
    [
      ['1', 'Introduction', "O'zingiz haqingizda 4 ta savol (har biriga ~30 soniya)"],
      ['2', 'Cue card', "1 daqiqa tayyorgarlik, keyin 2 daqiqagacha gapirasiz"],
      ['3', 'Discussion', "Mavzu bo'yicha chuqurroq 4 ta savol"],
    ].forEach(([n, t, d]) => {
      const p = el('div', 'ie-part');
      p.append(el('span', 'ie-part-n', n), el('b', '', `Part ${n} · ${t}`), el('span', '', d));
      parts.appendChild(p);
    });
    b.append(head, parts);

    const h = history().results;
    if (h.length) {
      b.appendChild(el('h2', 'vc-h', 'Natijalarim'));
      const chart = el('div', 'ie-history');
      h.slice(-8).forEach((r) => {
        const col = el('div', 'ie-hcol');
        const bar = el('div', 'ie-hbar');
        bar.style.height = `${Math.max(8, (r.overall / 9) * 100)}%`;
        col.append(el('b', '', fmt(r.overall)), bar, el('span', '', r.date.slice(5).replace('-', '.')));
        chart.appendChild(col);
      });
      b.appendChild(chart);
    }

    const actions = el('div', 'hg-extra');
    if (!SR) actions.appendChild(el('p', 'hint-left', "⚠️ Bu brauzer ovozni tanimaydi — javoblarni yozib berasiz. To'liq imtihon uchun Chrome'da oching."));
    actions.appendChild(
      el('p', 'hint-left', "Maslahat: tinch joyda, telefonni yaqin tutib gapiring. Javoblarni to'liq gaplar bilan, misollar keltirib bering — qisqa javob balni pasaytiradi.")
    );
    actions.appendChild(button('primary big', '▶ Imtihonni boshlash', start));
    b.appendChild(actions);
  }

  // ---------- Imtihon jarayoni ----------

  let test = null;
  let answers = [];

  async function start() {
    App.unlockAudio();
    screen();
    const my = run;
    body().appendChild(el('p', 'hint-left', '⏳ Imtihonchi savollarni tayyorlayapti...'));
    try {
      test = await App.postJson('/api/ielts/test', { seen: history().seen });
    } catch (err) {
      if (my !== run) return;
      body().textContent = '';
      body().append(el('p', 'error', err.message), button('primary', 'Qayta urinish', start));
      return;
    }
    if (my !== run) return;
    answers = [];
    const h = history();
    h.seen = [test.part2.task, ...h.seen.filter((x) => x !== test.part2.task)].slice(0, 30);
    App.store(HISTORY, h);

    const steps = [
      { part: 1, intro: `Part 1. Let's talk about ${test.part1.topic.toLowerCase()}.` },
      ...test.part1.questions.map((q) => ({ part: 1, question: q })),
      { part: 2, cue: true },
      { part: 2, question: test.part2.followup, limit: LIMITS.follow },
      { part: 3, intro: `Part 3. We've been talking about ${test.part2.task.replace(/^describe\s+/i, '').replace(/\.$/, '')}. Now I'd like to ask you some more general questions.` },
      ...test.part3.questions.map((q) => ({ part: 3, question: q })),
    ];
    const total = steps.filter((s) => s.question || s.cue).length;
    let n = 0;
    for (const s of steps) {
      if (my !== run) return;
      if (s.intro) {
        await App.speak([{ lang: 'en', text: s.intro }]);
        continue;
      }
      n++;
      $('ieltsScore').textContent = `${n}/${total}`;
      const a = s.cue ? await cueCard(my) : await ask(my, s.part, s.question, s.limit || LIMITS[s.part]);
      if (my !== run || !a) return;
      answers.push(a);
    }
    await App.speak([{ lang: 'en', text: "Thank you. That is the end of the speaking test." }]);
    if (my === run) grade(my);
  }

  // Savolni beradi va javobni yozib oladi. Natija: { part, question, text, seconds, words, pauses, fillers, confidence }.
  async function ask(my, part, question, limit, { speakFirst = true, title } = {}) {
    const b = body();
    b.textContent = '';
    const card = el('section', 'ie-card');
    card.appendChild(el('span', 'ie-tag', title || `Part ${part}`));
    const q = el('p', 'ie-q', question);
    card.appendChild(q);
    b.appendChild(card);
    const status = el('p', 'heard', speakFirst ? '🔊 Imtihonchi gapiryapti...' : '');
    b.appendChild(status);
    if (speakFirst) {
      await App.speak([{ lang: 'en', text: question }]);
      if (my !== run) return null;
    }
    return listen(my, b, status, limit, (r) => ({ part, question, ...r }));
  }

  function listen(my, b, status, limit, wrap) {
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
        area.placeholder = 'Javobingizni inglizcha yozing...';
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
        const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
        resolve(
          wrap({
            text,
            seconds,
            words: wordCount(text),
            pauses,
            fillers: (text.match(FILLERS) || []).length,
            confidence: conf.length ? conf.reduce((s, x) => s + x, 0) / conf.length : 0,
          })
        );
      };

      const startRec = () => {
        const r = new SR();
        rec = r;
        r.lang = 'en-GB';
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
          if (e.error === 'not-allowed') status.textContent = "Mikrofonga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering.";
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
      const endBtn = button('primary big', '✅ Javobni tugatdim', finish);
      row.append(clock);
      b.append(meter, row);
      if (area) b.appendChild(area);
      else b.appendChild(live);
      b.appendChild(endBtn);
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

  // Part 2: cue card, 1 daqiqa tayyorgarlik (qoralama bilan), keyin 2 daqiqagacha nutq.
  async function cueCard(my) {
    const c = test.part2;
    const b = body();
    b.textContent = '';
    const card = el('section', 'ie-card ie-cue');
    card.appendChild(el('span', 'ie-tag', 'Part 2 · Cue card'));
    card.appendChild(el('p', 'ie-q', c.task));
    card.appendChild(el('p', 'ie-sub', 'You should say:'));
    const ul = el('ul', 'ie-bullets');
    c.bullets.forEach((x) => ul.appendChild(el('li', '', x)));
    card.append(ul, el('p', 'speak-tr', c.task_uz));
    b.appendChild(card);
    await App.speak([
      { lang: 'en', text: `Now, I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. You have one minute to think about what you are going to say. ${c.task}` },
    ]);
    if (my !== run) return null;

    // Tayyorgarlik
    const notes = el('textarea', 'exam-text ie-notes');
    notes.rows = 3;
    notes.placeholder = "Qoralama: kalit so'zlarni yozib oling (ixtiyoriy)";
    const clock = el('span', 'ie-clock', '1:00');
    const go = el('div', 'control-row');
    let resolvePrep;
    const prep = new Promise((r) => (resolvePrep = r));
    const ready = button('primary big', '🎙️ Tayyorman — gapirishni boshlash', () => resolvePrep());
    go.appendChild(clock);
    b.append(el('p', 'hint-left', '⏱️ Tayyorgarlik — 1 daqiqa'), go, notes, ready);
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
    const keep = notes.value;
    [notes, ready, go, b.querySelector('.hint-left')].forEach((x) => x && x.remove());
    if (keep.trim()) card.appendChild(el('p', 'ie-sub', `📝 ${keep.trim()}`));
    const status = el('p', 'heard', '🔊 Imtihonchi gapiryapti...');
    b.appendChild(status);
    await App.speak([{ lang: 'en', text: "Alright. Remember, you have one to two minutes for this. Please start speaking now." }]);
    if (my !== run) return null;
    return listen(my, b, status, LIMITS[2], (r) => ({ part: 2, question: c.task, ...r }));
  }

  // ---------- Baholash va natija ----------

  async function grade(my) {
    $('ieltsScore').textContent = '';
    const b = body();
    b.textContent = '';
    b.appendChild(el('p', 'hint-left', "⏳ Imtihonchi javoblaringizni rasmiy mezonlar bo'yicha baholayapti..."));
    try {
      const g = await App.postJson('/api/ielts/grade', { answers });
      if (my !== run) return;
      showResult(g);
    } catch (err) {
      if (my !== run) return;
      b.textContent = '';
      b.append(el('p', 'error', err.message), button('primary', 'Qayta baholash', () => grade(run)));
    }
  }

  function stats() {
    const seconds = answers.reduce((n, a) => n + a.seconds, 0);
    const words = answers.reduce((n, a) => n + a.words, 0);
    const part2 = answers.find((a) => a.part === 2);
    return {
      wpm: seconds ? Math.round((words / seconds) * 60) : 0,
      words,
      seconds,
      pauses: answers.reduce((n, a) => n + a.pauses, 0),
      fillers: answers.reduce((n, a) => n + a.fillers, 0),
      part2: part2 ? part2.seconds : 0,
    };
  }

  function showResult(g) {
    const lang = 'en';
    const s = stats();
    const today = new Date().toLocaleDateString('sv-SE');
    const h = history();
    h.results = [...h.results, { date: today, overall: g.overall, bands: Object.fromEntries(CRITERIA.map(([k]) => [k, g.criteria[k].band])) }].slice(-20);
    App.store(HISTORY, h);
    // Xatolar «Xatolarim» mashqiga, foydali so'zlar — takrorlash daftariga.
    if (g.mistakes.length) Learn.addMistakes(lang, g.mistakes);
    Learn.bumpStat('ieltsMocks');
    window.dispatchEvent(new CustomEvent('tu:done', { detail: { kind: 'ielts' } }));
    window.Practice.awardXp(30, 'IELTS Speaking');

    const b = body();
    b.textContent = '';
    const top = el('div', 'ie-band');
    top.append(el('span', 'ie-band-k', 'Overall band'), el('span', 'ie-band-v', fmt(g.overall)));
    const prev = h.results.length > 1 ? h.results[h.results.length - 2].overall : null;
    if (prev != null) {
      const d = g.overall - prev;
      top.appendChild(el('span', `ie-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`, d ? `${d > 0 ? '▲' : '▼'} ${Math.abs(d)} (oldingi: ${fmt(prev)})` : `oldingi bilan bir xil`));
    }
    top.appendChild(el('span', 'ie-note', 'Sinov bahosi — haqiqiy imtihon natijasidan farq qilishi mumkin.'));
    b.appendChild(top);

    const crit = el('div', 'ie-crits');
    for (const [k, en, uz] of CRITERIA) {
      const c = g.criteria[k];
      const row = el('div', 'ie-crit');
      const head = el('div', 'ie-crit-head');
      head.append(el('b', '', uz), el('span', 'ie-crit-band', fmt(c.band)));
      const bar = el('div', 'xp-bar');
      const fill = el('div', 'xp-fill');
      fill.style.width = `${(c.band / 9) * 100}%`;
      bar.appendChild(fill);
      row.append(head, el('span', 'ie-crit-en', en), bar, el('p', '', c.comment));
      crit.appendChild(row);
    }
    b.appendChild(crit);

    b.appendChild(el('h2', 'vc-h', '📈 Ravonlik ko\'rsatkichlari'));
    const grid = el('div', 'ie-stats');
    [
      [`${s.wpm}`, "so'z/daqiqa", s.wpm > 190 ? 'juda tez — sekinroq, aniqroq' : s.wpm >= 110 ? 'yaxshi temp' : s.wpm >= 80 ? "biroz sekin" : 'sekin — ko\'proq gapiring'],
      [mmss(s.part2), 'Part 2 nutqi', s.part2 >= 100 ? "a'lo" : s.part2 >= 60 ? 'yetarli' : 'kamida 1:30 kerak'],
      [`${s.pauses}`, "uzun to'xtash", s.pauses <= 3 ? 'kam' : "ko'p — bog'lovchilar ishlating"],
      [`${s.fillers}`, 'um / uh', s.fillers <= 3 ? 'kam' : "ko'p"],
    ].forEach(([v, k, d]) => {
      const c = el('div', 'ie-stat');
      c.append(el('b', '', v), el('span', '', k), el('small', '', d));
      grid.appendChild(c);
    });
    b.appendChild(grid);

    if (g.summary) b.appendChild(el('p', 'study-expl ok', g.summary));
    if (g.tips.length) {
      b.appendChild(el('h2', 'vc-h', '🎯 Keyingi bandga chiqish uchun'));
      const ul = el('ul', 'ie-tips');
      g.tips.forEach((t) => ul.appendChild(el('li', '', t)));
      b.appendChild(ul);
    }
    if (g.mistakes.length) {
      b.appendChild(el('h2', 'vc-h', '❌ Xatolar'));
      const list = el('div', 'vc-words');
      g.mistakes.forEach((m) => {
        const row = button('vc-word', '', () => App.speak([{ lang, text: m.correct }]));
        row.append(el('s', 'vc-ex-uz', m.wrong), el('b', '', m.correct), el('span', 'vc-ex-uz', m.explanation));
        list.appendChild(row);
      });
      b.append(list, el('p', 'hint-left', "Bu xatolar «🔁 Xatolarim» mashqiga qo'shildi."));
    }
    if (g.better.answer) {
      b.appendChild(el('h2', 'vc-h', '⭐ Band 7.5+ namunaviy javob'));
      const box = el('section', 'ie-card');
      box.append(el('p', 'ie-sub', g.better.question), el('p', 'ie-model', g.better.answer));
      box.appendChild(button('secondary', '🔊 Tinglash', () => App.speak([{ lang, text: g.better.answer }])));
      b.appendChild(box);
    }
    if (g.vocab.length) {
      b.appendChild(el('h2', 'vc-h', '📚 Foydali iboralar'));
      const list = el('div', 'vc-words');
      g.vocab.forEach((v) => {
        const row = button('vc-word', '', () => {
          Learn.addWord(lang, v.word, v.translation);
          row.classList.add('mastered');
          window.Practice.toast("➕ Takrorlash daftariga qo'shildi");
        });
        const head = el('span', 'vc-word-head');
        head.append(el('b', '', v.word), el('span', 'dr-dots', '➕'));
        row.append(head, el('span', 'vc-ex-uz', v.translation));
        list.appendChild(row);
      });
      b.appendChild(list);
    }

    b.appendChild(el('h2', 'vc-h', '📝 Javoblaringiz'));
    answers.forEach((a) => {
      const d = el('details', 'ie-ans');
      d.append(el('summary', '', `Part ${a.part}: ${a.question}`), el('p', '', a.text || '(javob berilmagan)'), el('small', '', `${a.seconds} soniya · ${a.words} so'z`));
      b.appendChild(d);
    });

    const actions = el('div', 'end-actions');
    actions.append(
      button('primary', '🔁 Yangi imtihon', start),
      button('secondary', '📤 Ulashish', () =>
        window.Share.share({
          emoji: '🎤',
          kicker: 'IELTS Speaking · sinov',
          big: fmt(g.overall),
          title: 'band',
          sub: CRITERIA.map(([k, , uz]) => `${uz.replace(' (taxminiy)', '')}: ${fmt(g.criteria[k].band)}`).join(' · '),
          text: `IELTS Speaking sinovidan ${fmt(g.overall)} band oldim 🎤 Siz ham sinab ko'ring:`,
          theme: 'plum',
        })
      ),
      button('secondary', 'Menyu', () => App.openMenu())
    );
    b.appendChild(actions);
    window.scrollTo(0, 0);
  }

  function renderCard() {
    const card = $('ieltsCard');
    card.hidden = App.lang() !== 'en';
    if (card.hidden) return;
    const r = history().results;
    $('ieltsDesc').textContent = r.length
      ? `Oxirgi natija: ${fmt(r[r.length - 1].overall)} band · ${r.length} ta imtihon`
      : "Imtihonchi bilan 3 qismli sinov — band ball va xatolar tahlili";
  }

  $('ieltsCard').addEventListener('click', open);
  $('ieltsBack').addEventListener('click', () => {
    stopAll();
    App.openMenu();
  });

  return { open, renderCard };
})();
