// «Bugungi dars»: har kuni 15-25 daqiqalik tayyor reja — takrorlash, yangi so'zlar, qoida va
// ustoz bilan suhbat. Bo'limlar «tu:done» hodisasini yuboradi, reja shu bilan belgilanadi.
window.Plan = (() => {
  const App = window.App;
  const Learn = window.Learn;
  const C = window.COURSE;
  const $ = (id) => document.getElementById(id);
  const BONUS_XP = 30;
  // Hodisa turi → reja qadami
  const KIND_STEP = { review: 'review', words: 'words', grammar: 'grammar', game: 'game', lesson: 'talk', placement: 'placement', hangul: 'hangul' };

  const key = (lang) => `tu-plan-${lang}`;
  const today = () => new Date().toLocaleDateString('sv-SE');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Bugungi qadamlar (kun boshida bir marta tuziladi, kun davomida o'zgarmaydi).
  function build(lang) {
    const steps = [];
    const unit = C.UNITS[Learn.currentUnit(lang)];
    const progress = Learn.courseProgress(lang)[unit.id] || {};
    const hangul = lang === 'ko' && window.Hangul.nextLesson();
    const profile = App.profile() || {};
    const noPlacement = !window.Study.placement(lang) && profile.level && profile.level !== 'zero' && !Object.keys(Learn.courseProgress(lang)).length;

    if (hangul) steps.push({ id: 'hangul', icon: '🔤', title: 'Hangul harflari', desc: `${hangul.index + 1}-bosqich: ${hangul.title}`, min: 5 });
    if (noPlacement && !hangul) steps.push({ id: 'placement', icon: '📊', title: 'Daraja testi', desc: "Bir marta — kursni mos joydan boshlash uchun", min: 5 });
    const due = Learn.deckStats(lang).due;
    if (due >= 3) steps.push({ id: 'review', icon: '🔁', title: "So'zlarni takrorlash", desc: `${Math.min(due, 20)} ta so'z vaqti keldi`, min: 3 });
    steps.push({ id: 'words', icon: '📚', title: "10 ta yangi so'z", desc: "Kartochka va savollar bilan yodlash", min: 5 });
    if (!hangul) {
      if (!progress.grammar) steps.push({ id: 'grammar', icon: '📘', title: 'Qoida', desc: `${unit.icon} ${unit.title}`, min: 5, unit: unit.id });
      else steps.push({ id: 'game', icon: '🎮', title: 'Test o\'yini', desc: `${unit.icon} ${unit.title}`, min: 3, unit: unit.id });
    }
    steps.push({
      id: 'talk',
      icon: '🎙️',
      title: `${App.tutor().name} bilan suhbat`,
      desc: hangul ? "Harflarni ovoz bilan mashq qilish" : `${unit.icon} ${unit.title} · kamida 2 marta gapiring`,
      min: 10,
      unit: hangul ? null : unit.id,
    });
    return { day: today(), steps, done: {}, bonus: false };
  }

  function get(lang = App.lang()) {
    const p = App.loadStored(key(lang));
    if (p && p.day === today() && Array.isArray(p.steps)) return p;
    const fresh = build(lang);
    App.store(key(lang), fresh);
    return fresh;
  }

  const doneCount = (p) => p.steps.filter((s) => p.done[s.id]).length;
  const nextStep = (p) => p.steps.find((s) => !p.done[s.id]) || null;

  function run(step) {
    if (step.id === 'hangul') {
      const n = window.Hangul.nextLesson();
      if (n) window.Hangul.openLesson(n.index);
      else window.Hangul.open();
    } else if (step.id === 'placement') window.Study.openPlacement();
    else if (step.id === 'review') $('reviewCard').click();
    else if (step.id === 'words') window.Vocab.planWords(10);
    else if (step.id === 'grammar') window.Study.openGrammar(step.unit);
    else if (step.id === 'game') window.Games.start('quiz', { unit: step.unit });
    else if (step.id === 'talk') App.startLesson(step.unit ? { unit: step.unit } : { topic: 'hangul' });
  }

  // ---------- Menyu kartasi ----------

  function renderCard() {
    const p = get();
    const n = doneCount(p);
    const all = n === p.steps.length;
    const left = p.steps.filter((s) => !p.done[s.id]).reduce((m, s) => m + s.min, 0);
    $('planCard').classList.toggle('done', all);
    $('planTitle').textContent = all ? '🎉 Bugungi dars bajarildi!' : n ? '🎯 Bugungi darsni davom ettiring' : '🎯 Bugungi dars';
    $('planDesc').textContent = all ? 'Ertaga yangi reja tayyor bo\'ladi. Xohlasangiz, erkin mashq qiling.' : `${p.steps.length} qadam · ~${left} daqiqa · ${p.steps.map((s) => s.icon).join(' ')}`;
    $('planCount').textContent = `${n}/${p.steps.length}`;
  }

  // ---------- Reja ekrani ----------

  function open() {
    hideBar();
    const p = get();
    const body = $('planBody');
    body.textContent = '';
    const n = doneCount(p);
    const head = el('div', 'hg-intro');
    head.appendChild(el('h2', 'vc-goal', n === p.steps.length ? '🎉 Hammasi bajarildi!' : `Bugun: ${n} / ${p.steps.length} qadam`));
    const bar = el('div', 'xp-bar');
    const fill = el('div', 'xp-fill');
    fill.style.width = `${Math.round((n / p.steps.length) * 100)}%`;
    bar.appendChild(fill);
    head.appendChild(bar);
    head.appendChild(
      el('p', 'hint-left', n === p.steps.length ? `Ofarin! +${BONUS_XP} XP bonus olindi. Ertaga yangi reja bilan davom etamiz 🔥` : `Hammasini bajarsangiz +${BONUS_XP} XP bonus. Ketma-ket bajaring — har biri bir necha daqiqa.`)
    );
    body.appendChild(head);

    const next = nextStep(p);
    const list = el('div', 'hg-lessons');
    p.steps.forEach((s, i) => {
      const isDone = Boolean(p.done[s.id]);
      const b = el('button', `hg-lesson plan-step${isDone ? ' done' : ''}${s === next ? ' next' : ''}`);
      b.type = 'button';
      const text = el('span', 'act-text');
      text.append(el('span', 'act-title', `${i + 1}. ${s.title}`), el('span', 'hg-preview', `${s.desc} · ~${s.min} daq`));
      b.append(el('span', 'act-icon', s.icon), text, el('span', 'hg-state', isDone ? '✅' : s === next ? '▶' : ''));
      b.addEventListener('click', () => run(s));
      list.appendChild(b);
    });
    body.appendChild(list);
    if (next) {
      const go = el('button', 'primary big plan-go', n ? `▶ Davom etish: ${next.title}` : '▶ Boshlash');
      go.type = 'button';
      go.addEventListener('click', () => run(next));
      body.appendChild(go);
    }
    App.show('plan');
  }

  // ---------- Qadam bajarilganda ----------

  let barTimer = null;

  function hideBar() {
    clearTimeout(barTimer);
    $('planBar').hidden = true;
  }

  function showBar(text, label) {
    $('planBarText').textContent = text;
    $('planBarGo').textContent = label;
    $('planBar').hidden = false;
    clearTimeout(barTimer);
    barTimer = setTimeout(hideBar, 20000);
  }

  window.addEventListener('tu:done', (e) => {
    const stepId = KIND_STEP[e.detail && e.detail.kind];
    if (!stepId) return;
    const lang = App.lang();
    const p = get(lang);
    const step = p.steps.find((s) => s.id === stepId);
    if (!step || p.done[stepId]) return;
    // Suhbat qadami — rejadagi bosqich darsi bo'lsa (yoki Hangul darsi); o'yin — shu bosqich bo'yicha.
    if (stepId === 'game' && e.detail.unit !== step.unit) return;
    p.done[stepId] = true;
    // Daraja testidan keyin kurs bosqichi o'zgaradi — qolgan qadamlarni yangi bosqichga moslaymiz.
    if (stepId === 'placement') {
      const fresh = build(lang).steps.filter((s) => s.id !== 'placement' && !p.done[s.id]);
      p.steps = [...p.steps.filter((s) => p.done[s.id]), ...fresh];
    }
    const next = nextStep(p);
    if (!next && !p.bonus) {
      p.bonus = true;
      App.store(key(lang), p);
      Learn.bumpStat('plansDone');
      setTimeout(() => window.Practice.awardXp(BONUS_XP, '🎉 Bugungi dars bajarildi'), 1800);
      showBar('🎉 Bugungi dars to\'liq bajarildi!', 'Natija →');
    } else {
      App.store(key(lang), p);
      if (next) showBar(`✅ ${step.title} — bajarildi! Keyingisi: ${next.icon} ${next.title}`, 'Davom →');
    }
    renderCard();
  });

  $('planCard').addEventListener('click', open);
  $('planBarGo').addEventListener('click', open);
  $('planBack').addEventListener('click', () => App.openMenu());

  return { open, renderCard, get };
})();
