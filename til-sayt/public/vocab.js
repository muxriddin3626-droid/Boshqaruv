// Lug'at bo'limi: mavzuli so'z to'plamlari (har biri 20 ta so'z), bosqichma-bosqich yodlash,
// kunlik yangi so'z maqsadi. Yodlangan so'zlar daftarga tushadi va aqlli takrorlashga qo'shiladi.
window.Vocab = (() => {
  const App = window.App;
  const Learn = window.Learn;
  const T = window.THEMES;
  const $ = (id) => document.getElementById(id);
  const CHUNK = 5; // bir martada tanishtiriladigan so'zlar
  const MAX_PACKS = 15; // har mavzuda saqlanadigan to'plamlar
  const GOALS = [10, 20, 30, 50];

  const dataKey = (lang) => `tu-vocab-${lang}`;
  const load = (lang) => App.loadStored(dataKey(lang)) || {};
  const save = (lang, data) => App.store(dataKey(lang), data);
  const today = () => new Date().toLocaleDateString('sv-SE');

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

  const say = (text) => App.speak([{ lang: App.lang(), text }]);
  const shuffle = (arr) => arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

  // ---------- Kunlik maqsad ----------

  function goal() {
    return Number(App.loadStored('tu-vocab-goal')) || 20;
  }

  function todayCount() {
    const d = App.loadStored('tu-vocab-daily') || {};
    return d.day === today() ? d.count : 0;
  }

  function addToday(n) {
    App.store('tu-vocab-daily', { day: today(), count: todayCount() + n });
  }

  function themeLearned(lang, id) {
    return (load(lang)[id] || { packs: [] }).packs.filter((p) => p.learned).reduce((n, p) => n + p.words.length, 0);
  }

  // Menyu kartasi.
  function renderCard() {
    const n = todayCount();
    $('vocabCount').textContent = `${n}/${goal()}`;
    $('vocabDesc').textContent = n >= goal() ? `🎉 Bugungi maqsad bajarildi! Yana yodlaysizmi?` : `Bugun ${goal()} ta yangi so'z — ${T.THEMES.length} ta mavzu`;
  }

  // ---------- Bosh sahifa: maqsad va mavzular ----------

  function renderHome() {
    const lang = App.lang();
    const body = $('vocabBody');
    body.textContent = '';
    $('vocabTitle').textContent = "📚 Lug'at";
    $('vocabScore').textContent = '';
    view = 'home';

    const top = el('div', 'hg-intro');
    const n = todayCount();
    top.appendChild(el('h2', 'vc-goal', `🎯 Bugun: ${n} / ${goal()} yangi so'z`));
    const bar = el('div', 'xp-bar');
    const fill = el('div', 'xp-fill');
    fill.style.width = `${Math.min(100, Math.round((n / goal()) * 100))}%`;
    bar.appendChild(fill);
    top.appendChild(bar);
    const chips = el('div', 'chips vc-goals');
    for (const g of GOALS) {
      const c = button(`chip${g === goal() ? ' selected' : ''}`, `${g} ta`, () => {
        App.store('tu-vocab-goal', g);
        renderHome();
        renderCard();
      });
      chips.appendChild(c);
    }
    top.append(el('p', 'hint-left', "Kunlik maqsad — kuniga nechta yangi so'z yodlaysiz:"), chips);
    const st = Learn.deckStats(lang);
    top.appendChild(el('p', 'hint-left', `Daftaringizda ${st.total} ta so'z, ${st.learned} tasi mustahkam yodlangan.`));
    body.appendChild(top);

    const actions = el('div', 'hg-extra');
    if (st.due) {
      actions.appendChild(
        button('primary big', `🔁 Takrorlash — ${st.due} ta so'z vaqti keldi`, () => $('reviewCard').click())
      );
    }
    actions.appendChild(button(st.due ? 'secondary' : 'primary big', "🎙️ Ustoz bilan lug'at darsi (ko'p so'z)", () => App.startLesson({ topic: 'vocab' })));
    body.appendChild(actions);

    body.appendChild(el('h2', 'vc-h', 'Mavzular'));
    const grid = el('div', 'vc-themes');
    for (const t of T.THEMES) {
      const learned = themeLearned(lang, t.id);
      const b = button(`vc-theme${learned ? ' started' : ''}`, '', () => openTheme(t.id));
      b.append(el('span', 'vc-icon', t.icon), el('span', 'vc-name', t.title), el('span', 'vc-count', learned ? `✅ ${learned} so'z` : "boshlanmagan"));
      grid.appendChild(b);
    }
    body.appendChild(grid);
  }

  // ---------- Mavzu: to'plamlar ----------

  let view = 'home';
  let themeId = null;

  function openTheme(id) {
    themeId = id;
    const data = load(App.lang())[id];
    if (!data || !data.packs.length) return newPack();
    renderTheme();
  }

  function renderTheme() {
    const lang = App.lang();
    const t = T.byId(themeId);
    const packs = (load(lang)[themeId] || { packs: [] }).packs;
    const body = $('vocabBody');
    body.textContent = '';
    view = 'theme';
    $('vocabTitle').textContent = `${t.icon} ${t.title}`;
    $('vocabScore').textContent = `${themeLearned(lang, themeId)} so'z`;

    const list = el('div', 'hg-lessons');
    packs.forEach((p, i) => {
      const b = button(`hg-lesson${p.learned ? ' done' : ''}`, '', () => renderPack(i));
      const text = el('span', 'act-text');
      text.append(el('span', 'act-title', `${i + 1}-to'plam · ${p.words.length} so'z`), el('span', 'hg-preview', p.words.slice(0, 4).map((w) => w.word).join(', ')));
      b.append(el('span', 'act-icon', p.learned ? '✅' : '🧠'), text, el('span', 'hg-state', p.learned ? '' : '▶'));
      list.appendChild(b);
    });
    body.appendChild(list);
    const more = el('div', 'hg-extra');
    if (packs.length < MAX_PACKS) more.appendChild(button('primary big', `➕ Yangi ${T.PACK_SIZE} ta so'z`, newPack));
    more.appendChild(button('secondary', '← Mavzular', renderHome));
    body.appendChild(more);
  }

  async function newPack() {
    const lang = App.lang();
    const t = T.byId(themeId);
    const body = $('vocabBody');
    body.textContent = '';
    view = 'loading';
    $('vocabTitle').textContent = `${t.icon} ${t.title}`;
    const wait = el('div', 'hg-intro');
    wait.append(el('div', 'face-slot small'), el('p', '', `⏳ ${t.title} mavzusida ${T.PACK_SIZE} ta yangi so'z tayyorlanmoqda...`));
    body.appendChild(wait);
    window.Face.set(wait.firstChild, 'thinking');

    const data = load(lang);
    const theme = data[themeId] || { packs: [] };
    // Mavzudagi va daftardagi so'zlarni qaytarmaslik uchun yuboramiz.
    const exclude = [...theme.packs.flatMap((p) => p.words.map((w) => w.word)), ...Learn.deckList(lang).slice(0, 80).map((c) => c.word)];
    try {
      const r = await App.postJson('/api/vocab', {
        lang,
        theme: themeId,
        level: App.settings().level,
        exclude,
        profile: App.profile(),
      });
      const fresh = load(lang);
      const th = fresh[themeId] || { packs: [] };
      th.packs.push({ t: Date.now(), learned: false, words: r.words });
      fresh[themeId] = th;
      save(lang, fresh);
      renderPack(th.packs.length - 1);
    } catch (err) {
      body.textContent = '';
      const box = el('div', 'hg-intro');
      box.append(el('p', '', err.message), button('secondary', '← Mavzular', renderHome));
      body.appendChild(box);
    }
  }

  // ---------- To'plam: so'zlar ro'yxati ----------

  function renderPack(i) {
    const lang = App.lang();
    const pack = load(lang)[themeId].packs[i];
    const body = $('vocabBody');
    body.textContent = '';
    view = 'pack';
    $('vocabScore').textContent = `${i + 1}-to'plam`;
    body.appendChild(el('p', 'hint-left', "So'zni bosing — ovozini eshitasiz. Ko'zdan kechirib chiqing, keyin «Yodlash»ni bosing."));
    const list = el('div', 'vc-words');
    for (const w of pack.words) {
      const b = button('vc-word', '', () => say(w.word));
      const head = el('span', 'vc-word-head');
      head.append(el('b', '', w.word), el('span', 'vc-tr', w.translation));
      b.append(head);
      if (w.example) {
        b.append(el('span', 'vc-ex', w.example), el('span', 'vc-ex-uz', w.example_uz));
      }
      list.appendChild(b);
    }
    body.appendChild(list);
    const actions = el('div', 'end-actions sticky-actions');
    actions.append(
      button('primary big', pack.learned ? '🔁 Qayta yodlash' : '🧠 Yodlashni boshlash', () => startDrill(i)),
      button('secondary', '← Orqaga', renderTheme)
    );
    body.appendChild(actions);
  }

  // ---------- Yodlash: 5 tadan tanishtirish + ikki tomonlama savollar ----------

  let drill = null;

  function startDrill(i) {
    const pack = load(App.lang())[themeId].packs[i];
    drill = { i, words: pack.words, chunk: 0, queue: [], correct: 0, asked: 0, wrongs: new Set() };
    introChunk();
  }

  function chunkWords() {
    return drill.words.slice(drill.chunk * CHUNK, drill.chunk * CHUNK + CHUNK);
  }

  function setProgress() {
    const total = Math.ceil(drill.words.length / CHUNK);
    $('vocabScore').textContent = `${Math.min(drill.chunk + 1, total)}/${total} qism`;
  }

  // Yangi 5 ta so'z bilan tanishuv: kartochkalar.
  function introChunk(k = 0) {
    view = 'drill';
    setProgress();
    const words = chunkWords();
    if (!words.length) return finishDrill();
    const w = words[k];
    const body = $('vocabBody');
    body.textContent = '';
    body.appendChild(el('p', 'hint-left', `Yangi so'z ${drill.chunk * CHUNK + k + 1} / ${drill.words.length} · Ovoz chiqarib takrorlang`));
    const card = button('vc-flash', '', () => say(w.word));
    card.append(el('span', 'vc-flash-word', w.word), el('span', 'vc-flash-tr', w.translation));
    if (w.example) card.append(el('span', 'vc-ex', w.example), el('span', 'vc-ex-uz', w.example_uz));
    body.appendChild(card);
    setTimeout(() => say(w.word), 250);
    const next = k + 1 < words.length;
    body.appendChild(
      button('primary big vc-next', next ? 'Keyingi so\'z →' : "✍️ Endi tekshiramiz", () => {
        if (next) introChunk(k + 1);
        else {
          // Har so'z ikki marta so'raladi: so'z → tarjima va tarjima → so'z.
          drill.queue = shuffle([...words.map((x) => ({ w: x, dir: 'tr' })), ...words.map((x) => ({ w: x, dir: 'word' }))]);
          ask();
        }
      })
    );
  }

  function ask() {
    if (!drill.queue.length) {
      drill.chunk++;
      return chunkWords().length ? introChunk() : finishDrill();
    }
    const { w, dir } = drill.queue.shift();
    const body = $('vocabBody');
    body.textContent = '';
    const toTr = dir === 'tr';
    body.appendChild(el('p', 'hint-left', toTr ? "Tarjimasini tanlang:" : "So'zni tanlang:"));
    const big = button(`vc-flash small${toTr ? '' : ' no-tr'}`, '', () => toTr && say(w.word));
    big.append(el('span', 'vc-flash-word', toTr ? w.word : w.translation));
    body.appendChild(big);
    if (toTr) setTimeout(() => say(w.word), 250);
    const others = shuffle(drill.words.filter((x) => x !== w)).slice(0, 3);
    const opts = shuffle([w, ...others]);
    const grid = el('div', `options${toTr ? ' no-tr' : ''}`);
    for (const o of opts) {
      const b = button('option', toTr ? o.translation : o.word, () => {
        if (grid.dataset.done) return;
        grid.dataset.done = '1';
        drill.asked++;
        const ok = o === w;
        b.classList.add(ok ? 'correct' : 'wrong');
        grid.querySelectorAll('.option').forEach((x) => {
          if (x.textContent === (toTr ? w.translation : w.word)) x.classList.add('correct');
        });
        if (ok) drill.correct++;
        else {
          drill.wrongs.add(w.word);
          drill.queue.push({ w, dir }); // xato qilingan so'z yana so'raladi
        }
        if (!toTr) say(w.word);
        setTimeout(ask, ok ? 900 : 2000);
      });
      grid.appendChild(b);
    }
    body.appendChild(grid);
  }

  function finishDrill() {
    const lang = App.lang();
    const data = load(lang);
    const pack = data[themeId].packs[drill.i];
    const firstTime = !pack.learned;
    pack.learned = true;
    save(lang, data);
    // Daftarga qo'shamiz: birinchi takrorlash — ertaga.
    for (const w of drill.words) {
      const isNew = !Learn.deckList(lang).some((c) => c.word === w.word);
      Learn.addWord(lang, w.word, w.translation);
      if (isNew && !drill.wrongs.has(w.word)) {
        const key = Learn.deckList(lang).find((c) => c.word === w.word);
        if (key) Learn.grade(lang, key.key, true);
      }
    }
    if (firstTime) addToday(drill.words.length);
    Learn.bumpStat('vocabWords', firstTime ? drill.words.length : 0);
    window.Practice.awardXp(firstTime ? 20 + drill.words.length : 5, "Lug'at");
    renderCard();

    const body = $('vocabBody');
    body.textContent = '';
    view = 'done';
    $('vocabScore').textContent = '';
    const box = el('div', 'hg-quiz');
    box.appendChild(el('div', 'hg-big', '🎉'));
    box.appendChild(el('h2', '', `${drill.words.length} ta so'z yodlandi!`));
    const acc = drill.asked ? Math.round((drill.correct / drill.asked) * 100) : 100;
    box.appendChild(el('p', 'hint-left', `Aniqlik: ${acc}%. Bugun: ${todayCount()} / ${goal()} yangi so'z. So'zlar daftarga qo'shildi — ertaga «Takrorlash»da yana chiqadi, shunda yaxshi esda qoladi.`));
    const actions = el('div', 'end-actions');
    const th = load(lang)[themeId];
    const nextPack = th.packs.findIndex((p) => !p.learned);
    actions.append(
      nextPack >= 0
        ? button('primary', '➡️ Keyingi to\'plam', () => renderPack(nextPack))
        : button('primary', `➕ Yana ${T.PACK_SIZE} ta so'z`, newPack),
      button('secondary', '← Mavzular', renderHome)
    );
    box.appendChild(actions);
    body.appendChild(box);
  }

  function open() {
    renderHome();
    App.show('vocab');
  }

  $('vocabCard').addEventListener('click', open);
  $('vocabBack').addEventListener('click', () => {
    if (view === 'home') App.openMenu();
    else if (view === 'theme' || view === 'loading') renderHome();
    else if (view === 'pack' || view === 'done') renderTheme();
    else if (confirm("Yodlashni to'xtatasizmi? Natija saqlanmaydi.")) renderTheme();
  });

  return { open, renderCard };
})();
