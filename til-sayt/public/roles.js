// Kasbiy kurslar va rolli vaziyatlar.
window.Roles = (() => {
  const App = window.App;
  const SC = window.SCENARIOS;
  const $ = (id) => document.getElementById(id);
  const progressKey = () => `tu-prof-${App.lang()}`;
  const scoresKey = () => `tu-roleplay-${App.lang()}`;
  const STEPS = [
    { id: 'words', icon: '🧩', label: "So'zlar" },
    { id: 'quiz', icon: '📝', label: 'Test' },
    { id: 'lesson', icon: '🎙️', label: 'Dars' },
    { id: 'role', icon: '🎭', label: 'Vaziyat' },
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

  // key: "builder:tools" (kasb mavzusi) yoki "prof:builder:tools" / "gen:police" (vaziyat).
  function markDone(key, step) {
    if (!key) return;
    const themeKey = key.startsWith('prof:') ? key.slice(5) : key;
    if (key.startsWith('gen:')) return;
    const progress = App.loadStored(progressKey()) || {};
    progress[themeKey] = { ...(progress[themeKey] || {}), [step]: true };
    App.store(progressKey(), progress);
  }

  function saveScore(scenarioKey, score) {
    const scores = App.loadStored(scoresKey()) || {};
    if (!scores[scenarioKey] || score > scores[scenarioKey]) {
      scores[scenarioKey] = score;
      App.store(scoresKey(), scores);
    }
  }

  // ---------- Kasblar ro'yxati ----------

  function openProfList() {
    const progress = App.loadStored(progressKey()) || {};
    const grid = $('profGrid');
    grid.textContent = '';
    for (const p of SC.PROFESSIONS) {
      const done = p.themes.reduce((n, t) => n + STEPS.filter((s) => (progress[`${p.id}:${t.id}`] || {})[s.id]).length, 0);
      const total = p.themes.length * STEPS.length;
      const card = button('prof-item', '', () => openProf(p.id));
      card.appendChild(el('span', 'prof-icon', p.icon));
      card.appendChild(el('b', '', p.title));
      card.appendChild(el('span', 'act-desc', done ? `${done}/${total} qadam` : `${p.themes.length} ta mavzu`));
      const bar = el('div', 'badge-bar');
      const fill = el('div', 'badge-fill');
      fill.style.width = `${Math.round((done / total) * 100)}%`;
      bar.appendChild(fill);
      card.appendChild(bar);
      grid.appendChild(card);
    }
    App.show('profList');
  }

  // ---------- Bitta kasb ----------

  let currentProf = null;

  function openProf(id) {
    const p = SC.PROFESSIONS.find((x) => x.id === id);
    if (!p) return openProfList();
    currentProf = p.id;
    const progress = App.loadStored(progressKey()) || {};
    const scores = App.loadStored(scoresKey()) || {};
    $('profTitle').textContent = p.title;
    $('profIcon').textContent = p.icon;
    const list = $('themeList');
    list.textContent = '';
    p.themes.forEach((t, i) => {
      const key = `${p.id}:${t.id}`;
      const done = progress[key] || {};
      const box = el('section', 'theme');
      const head = el('div', 'theme-head');
      head.appendChild(el('b', '', `${i + 1}. ${t.title}`));
      const best = scores[`prof:${key}`];
      if (best != null) head.appendChild(el('span', 'level-badge score', `🎭 ${best}/100`));
      box.appendChild(head);
      box.appendChild(el('p', 'act-desc', t.topic));
      const row = el('div', 'theme-steps');
      for (const step of STEPS) {
        const b = button(`step-chip${done[step.id] ? ' done' : ''}`, `${done[step.id] ? '✅' : step.icon} ${step.label}`, () => run(key, step.id));
        row.appendChild(b);
      }
      box.appendChild(row);
      list.appendChild(box);
    });
    App.show('prof');
  }

  function run(key, step) {
    if (step === 'words') window.Games.start('match', { prof: key });
    else if (step === 'quiz') window.Games.start('quiz', { prof: key });
    else if (step === 'lesson') App.startLesson({ prof: key });
    else App.startLesson({ scenario: `prof:${key}` });
  }

  // ---------- Umumiy rolli vaziyatlar ----------

  function openScenarios() {
    const scores = App.loadStored(scoresKey()) || {};
    const list = $('roleList');
    list.textContent = '';
    for (const s of SC.SCENARIOS) {
      const key = `gen:${s.id}`;
      const card = button('role-item', '', () => App.startLesson({ scenario: key }));
      card.appendChild(el('span', 'prof-icon', s.icon));
      const text = el('span', 'act-text');
      text.appendChild(el('span', 'act-title', s.title));
      text.appendChild(el('span', 'act-desc', `🎯 ${s.goal}`));
      card.appendChild(text);
      if (scores[key] != null) card.appendChild(el('span', 'level-badge score', `${scores[key]}/100`));
      list.appendChild(card);
    }
    App.show('roles');
  }

  // Darsdan yoki o'yindan keyin to'g'ri ekranga qaytish.
  function back(opts = {}) {
    const key = opts.prof || (opts.scenario && opts.scenario.startsWith('prof:') ? opts.scenario.slice(5) : null);
    if (key) openProf(key.split(':')[0]);
    else if (opts.scenario) openScenarios();
    else App.openMenu();
  }

  $('profCard').addEventListener('click', openProfList);
  $('roleCard').addEventListener('click', openScenarios);
  $('profBackBtn').addEventListener('click', openProfList);

  return { markDone, saveScore, back, openProfList, openProf, openScenarios, current: () => currentProf };
})();
