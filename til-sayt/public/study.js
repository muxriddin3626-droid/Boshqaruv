// Grammatika kartochkalari (har kurs bosqichi uchun qoida + mashq) va daraja aniqlash testi.
// Bajarilgan ish «tu:done» hodisasi bilan bildiriladi (Bugungi dars rejasi shuni kuzatadi).
window.Study = (() => {
  const App = window.App;
  const Learn = window.Learn;
  const C = window.COURSE;
  const $ = (id) => document.getElementById(id);
  const LEVELS = ['A1', 'A2', 'B1', 'B2'];
  const LEVEL_NAMES = { A0: "Boshlang'ich (noldan)", A1: "Boshlang'ich (A1)", A2: 'Elementar (A2)', B1: "O'rta (B1)", B2: "O'rtadan yuqori (B2)" };
  const LEVEL_SETTING = { A0: 'a1', A1: 'a1', A2: 'b1', B1: 'b1', B2: 'b2' };

  const done = (kind, extra = {}) => window.dispatchEvent(new CustomEvent('tu:done', { detail: { kind, ...extra } }));

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

  const shuffle = (arr) => arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const say = (text) => App.speak([{ lang: App.lang(), text }]);
  const body = () => $('studyBody');
  let back = () => App.openMenu();

  function screen(title, onBack) {
    $('studyTitle').textContent = title;
    $('studyScore').textContent = '';
    back = onBack;
    body().textContent = '';
    window.scrollTo(0, 0);
    App.show('study');
  }

  function loading(text) {
    body().textContent = '';
    const box = el('div', 'hg-intro study-loading');
    const face = el('div', 'face-slot small');
    box.append(face, el('p', '', text));
    body().appendChild(box);
    window.Face.set(face, 'thinking');
  }

  function failure(err, retry) {
    body().textContent = '';
    const box = el('div', 'hg-intro');
    box.append(el('p', '', err.message), button('primary', '🔁 Qayta urinish', retry), button('secondary', '← Orqaga', () => back()));
    body().appendChild(box);
  }

  // Umumiy savol-javob: har savolda variantlar, javobdan keyin izoh.
  function runQuiz(items, { onAnswer, onDone, auto = false, label = (i, n) => `Savol ${i + 1} / ${n}` }) {
    let i = 0;
    let correct = 0;
    const answers = [];
    function show() {
      if (i >= items.length) return onDone(correct, answers);
      const q = items[i];
      const b = body();
      b.textContent = '';
      $('studyScore').textContent = `${i + 1}/${items.length}`;
      b.appendChild(el('p', 'hint-left', label(i, items.length)));
      b.appendChild(el('h2', 'study-q', q.question));
      const grid = el('div', 'options');
      const after = el('div', 'study-after');
      for (const opt of shuffle([q.correct, ...q.wrong])) {
        grid.appendChild(
          button('option', opt, (e) => {
            if (grid.dataset.done) return;
            grid.dataset.done = '1';
            const ok = opt === q.correct;
            if (ok) correct++;
            answers.push({ q, ok });
            e.currentTarget.classList.add(ok ? 'correct' : 'wrong');
            grid.querySelectorAll('.option').forEach((o) => o.textContent === q.correct && o.classList.add('correct'));
            if (onAnswer && onAnswer(i, ok, answers) === 'stop') {
              i = items.length;
            } else {
              i++;
            }
            if (auto) {
              setTimeout(show, ok ? 700 : 1300);
              return;
            }
            if (q.explanation) after.appendChild(el('p', `study-expl ${ok ? 'ok' : 'bad'}`, `${ok ? '✅' : '❌'} ${q.explanation}`));
            after.appendChild(button('primary big', i < items.length ? 'Keyingi →' : 'Natija', show));
          })
        );
      }
      b.append(grid, after);
    }
    show();
  }

  // ---------- Grammatika kartochkasi ----------

  const gKey = (lang) => `tu-grammar-${lang}`;

  async function openGrammar(unitId, { fresh = false } = {}) {
    const lang = App.lang();
    const unit = C.byId(unitId);
    screen(`📘 ${unit.title}`, () => window.Practice.openUnit(unitId));
    const cache = App.loadStored(gKey(lang)) || {};
    if (cache[unitId] && !fresh) return renderGrammar(unitId, cache[unitId]);
    loading('⏳ Ustoz qoidani tayyorlayapti...');
    try {
      const card = await App.postJson('/api/grammar', { lang, unit: unitId });
      const all = App.loadStored(gKey(lang)) || {};
      all[unitId] = card;
      App.store(gKey(lang), all);
      renderGrammar(unitId, card);
    } catch (err) {
      failure(err, () => openGrammar(unitId, { fresh }));
    }
  }

  function renderGrammar(unitId, card) {
    const b = body();
    b.textContent = '';
    const head = el('div', 'gr-card');
    head.append(el('h1', 'gr-title', card.title), el('p', 'gr-intro', card.intro));
    b.appendChild(head);
    for (const s of card.sections) {
      const sec = el('section', 'gr-section');
      sec.append(el('h2', '', s.heading), el('p', '', s.text));
      for (const ex of s.examples) {
        const row = button('gr-example', '', () => say(ex.text));
        row.append(el('b', '', `🔊 ${ex.text}`), el('span', '', ex.uz));
        sec.appendChild(row);
      }
      b.appendChild(sec);
    }
    if (card.table && card.table.headers.length && card.table.rows.length) {
      const wrap = el('div', 'gr-table-wrap');
      const t = el('table', 'gr-table');
      const tr = el('tr');
      card.table.headers.forEach((h) => tr.appendChild(el('th', '', h)));
      t.appendChild(tr);
      for (const r of card.table.rows) {
        const row = el('tr');
        r.forEach((c) => row.appendChild(el('td', '', c)));
        t.appendChild(row);
      }
      wrap.appendChild(t);
      b.appendChild(wrap);
    }
    if (card.tip) b.appendChild(el('p', 'gr-tip', `💡 ${card.tip}`));
    const actions = el('div', 'end-actions gr-actions');
    actions.append(
      button('primary big', `✍️ Mashq qilish (${card.exercises.length} ta)`, () => grammarQuiz(unitId, card)),
      button('secondary', '🔄 Boshqacha tushuntir', () => openGrammar(unitId, { fresh: true }))
    );
    b.appendChild(actions);
  }

  function grammarQuiz(unitId, card) {
    const lang = App.lang();
    runQuiz(card.exercises, {
      label: (i, n) => `Mashq ${i + 1} / ${n} · to'g'ri variantni tanlang`,
      onDone: (correct, answers) => {
        const total = card.exercises.length;
        const passed = correct / total >= 0.6;
        if (passed) {
          Learn.completeStep(lang, unitId, 'grammar');
          done('grammar', { unit: unitId });
        }
        answers.filter((a) => !a.ok).forEach((a) => Learn.addWord(lang, a.q.correct, a.q.explanation || a.q.question, { kind: 'mistake', wrong: '', lapse: true }));
        window.Practice.awardXp(5 + correct * 2, 'Grammatika');
        const b = body();
        b.textContent = '';
        $('studyScore').textContent = '';
        const box = el('div', 'hg-quiz');
        box.append(el('div', 'hg-big', passed ? '🎉' : '💪'), el('h2', '', `${total} tadan ${correct} ta to'g'ri`));
        box.appendChild(
          el('p', 'hint-left', passed ? "Qoida o'zlashtirildi! Endi uni ustoz bilan suhbatda ishlating." : "Qoidani yana bir o'qib chiqing va qayta urinib ko'ring. Xatolar takrorlash daftariga tushdi.")
        );
        const actions = el('div', 'end-actions');
        actions.append(
          button('primary', passed ? '← Bosqichga qaytish' : '📘 Qoidani qayta o\'qish', () => (passed ? window.Practice.openUnit(unitId) : renderGrammar(unitId, card))),
          button('secondary', '🔁 Mashqni qayta', () => grammarQuiz(unitId, card))
        );
        box.appendChild(actions);
        b.appendChild(box);
      },
    });
  }

  // ---------- Daraja aniqlash testi ----------

  const pKey = (lang) => `tu-placement-${lang}`;
  const placement = (lang) => App.loadStored(pKey(lang));

  function openPlacement() {
    const lang = App.lang();
    screen('📊 Daraja testi', () => App.openMenu());
    const prev = placement(lang);
    const box = el('div', 'hg-intro');
    box.append(
      el('h2', '', `${App.tutor().lang.replace(/^./, (c) => c.toUpperCase())}ni qanchalik bilasiz?`),
      el('p', '', "16 ta savol: osondan qiyinga. Bilmasangiz — taxmin qilmang, eng ishonarlisini tanlang. Test qiyinlashganda o'zi to'xtaydi."),
      el('p', 'hint-left', "Natijaga qarab kursning sizga mos bosqichi ochiladi — bilgan narsangizni qayta o'tmaysiz. Taxminan 5 daqiqa.")
    );
    if (prev) box.appendChild(el('p', 'hint-left', `Oldingi natija: ${LEVEL_NAMES[prev.level] || prev.level}`));
    body().append(box);
    const actions = el('div', 'hg-extra');
    actions.append(button('primary big', '▶ Testni boshlash', startPlacement), button('secondary', "🌱 Men noldan boshlayman", () => applyPlacement('A0', true)));
    body().appendChild(actions);
  }

  async function startPlacement() {
    const lang = App.lang();
    loading('⏳ Test tayyorlanmoqda...');
    let items;
    try {
      items = (await App.postJson('/api/placement', { lang })).items;
    } catch (err) {
      failure(err, startPlacement);
      return;
    }
    // Har daraja bloki tugaganda: 50% dan kam to'g'ri bo'lsa — test to'xtaydi.
    runQuiz(items, {
      auto: true,
      label: (i) => `Savol ${i + 1} · daraja ${items[i].level}`,
      onAnswer: (i, ok, answers) => {
        const level = items[i].level;
        const next = items[i + 1];
        if (next && next.level === level) return null;
        const block = answers.filter((a) => a.q.level === level);
        return block.filter((a) => a.ok).length / block.length < 0.5 ? 'stop' : null;
      },
      onDone: (correct, answers) => placementResult(items, answers),
    });
  }

  function placementResult(items, answers) {
    let level = 'A0';
    for (const l of LEVELS) {
      const block = answers.filter((a) => a.q.level === l);
      const total = items.filter((x) => x.level === l).length;
      if (block.length === total && block.filter((a) => a.ok).length / total >= 0.7) level = l;
      else break;
    }
    const b = body();
    b.textContent = '';
    $('studyScore').textContent = '';
    const box = el('div', 'hg-quiz');
    box.append(el('div', 'hg-big', '📊'), el('h2', '', `Darajangiz: ${LEVEL_NAMES[level]}`));
    const list = el('ul', 'usage');
    for (const l of LEVELS) {
      const block = answers.filter((a) => a.q.level === l);
      if (!block.length) continue;
      list.appendChild(el('li', '', `${l}: ${block.filter((a) => a.ok).length} / ${block.length} to'g'ri`));
    }
    box.appendChild(list);
    const startUnit = firstUnitFor(level);
    box.appendChild(
      el(
        'p',
        'hint-left',
        startUnit
          ? `Kursni ${C.UNITS.indexOf(startUnit) + 1}-bosqichdan («${startUnit.title}») boshlaysiz. Oldingi bosqichlar o'tilgan deb belgilanadi.`
          : "Siz kursdagi hamma bosqichlardan yuqorisiz! Erkin suhbat, imtihon sinovlari va lug'at bilan davom eting."
      )
    );
    const actions = el('div', 'end-actions');
    actions.append(button('primary', '✅ Shunday boshlayman', () => applyPlacement(level)), button('secondary', "🔁 Qayta topshirish", startPlacement));
    box.appendChild(actions);
    b.appendChild(box);
  }

  function firstUnitFor(level) {
    const skip = { A0: [], A1: [], A2: ['A1'], B1: ['A1', 'A2'], B2: ['A1', 'A2', 'B1'] }[level] || [];
    return C.UNITS.find((u) => !skip.includes(u.level)) || null;
  }

  function applyPlacement(level, quiet) {
    const lang = App.lang();
    const start = firstUnitFor(level);
    const idx = start ? C.UNITS.indexOf(start) : C.UNITS.length;
    C.UNITS.slice(0, idx).forEach((u) => Learn.completeStep(lang, u.id, 'exam', { ratio: 1, passed: true }));
    App.store(pKey(lang), { level, at: Date.now() });
    App.setSettings({ level: LEVEL_SETTING[level] || 'auto' });
    done('placement', { level });
    if (!quiet) window.Practice.toast(`📊 Daraja saqlandi: ${LEVEL_NAMES[level]}`, 3000);
    window.Practice.openCourse();
  }

  $('studyBack').addEventListener('click', () => back());

  return { openGrammar, openPlacement, placement, done };
})();
