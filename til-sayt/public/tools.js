// Bepul vositalar sahifasi: IELTS / TOPIK / Goethe / ТРКИ ball hisoblagichlari va mavzu generatori.
// Hisob-kitob brauzerda; mavzular serverdagi umumiy ombordan (AI chaqirilmaydi).
(() => {
  const $ = (id) => document.getElementById(id);
  const THEME_KEY = 'til-ustoz-theme';

  // ---------- Rang (asosiy sayt bilan bir xil sozlama) ----------
  const applyTheme = (t) => (t ? (document.documentElement.dataset.theme = t) : delete document.documentElement.dataset.theme);
  try {
    applyTheme(localStorage.getItem(THEME_KEY));
  } catch {}
  $('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  });

  // ---------- Tablar ----------
  function showTab(tab) {
    document.querySelectorAll('.tl-tabs .pill').forEach((p) => p.classList.toggle('active', p.dataset.tab === tab));
    document.querySelectorAll('.tl-panel').forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (tab === 'topics' && !topicsLoaded) loadTopics();
    try {
      history.replaceState(null, '', `#${tab}`);
    } catch {}
  }
  document.querySelectorAll('.tl-tabs .pill').forEach((p) => p.addEventListener('click', () => showTab(p.dataset.tab)));

  // Segment tugmalari (bitta tanlov).
  function seg(id, onChange) {
    const box = $(id);
    box.querySelectorAll('.pill').forEach((p) =>
      p.addEventListener('click', () => {
        box.querySelectorAll('.pill').forEach((x) => x.classList.toggle('active', x === p));
        onChange(p.dataset.v);
      })
    );
    return () => box.querySelector('.pill.active').dataset.v;
  }

  const num = (el, max) => {
    const v = el.value.trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : null;
  };
  const bandText = (b) => (Number.isInteger(b) ? `${b}.0` : String(b));

  // ---------- IELTS ----------
  // Xom ball → band (keng tarqalgan rasmiy jadvallarga yaqin; har imtihonda biroz farq qilishi mumkin).
  const L_TABLE = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1]];
  const RA_TABLE = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1]];
  const RG_TABLE = [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [4, 2], [1, 1]];
  const fromTable = (t, raw) => (t.find(([min]) => raw >= min) || [0, 0])[1];
  const overall = (bands) => Math.floor((bands.reduce((n, b) => n + b, 0) / bands.length) * 2 + 0.5) / 2;

  for (const id of ['ieW', 'ieS']) {
    const sel = $(id);
    sel.appendChild(new Option('—', ''));
    for (let b = 9; b >= 1; b -= 0.5) sel.appendChild(new Option(bandText(b), String(b)));
  }
  const rType = seg('ieRType', () => calcIelts());

  function calcIelts() {
    const l = num($('ieL'), 40);
    const r = num($('ieR'), 40);
    const lb = l == null ? null : fromTable(L_TABLE, l);
    const rb = r == null ? null : fromTable(rType() === 'gt' ? RG_TABLE : RA_TABLE, r);
    $('ieLOut').textContent = lb == null ? '—' : `Band ${bandText(lb)}`;
    $('ieROut').textContent = rb == null ? '—' : `Band ${bandText(rb)}`;
    const w = $('ieW').value === '' ? null : Number($('ieW').value);
    const s = $('ieS').value === '' ? null : Number($('ieS').value);
    const all = [lb, rb, w, s];
    if (all.every((x) => x != null)) {
      const o = overall(all);
      $('ieTotal').textContent = bandText(o);
      $('ieTotalNote').textContent =
        o >= 7 ? "Ko'pchilik xorijiy universitetlar uchun yetarli 🎉" : o >= 6 ? "Ko'p bakalavr dasturlari uchun yetarli" : o >= 5 ? 'Ayrim kollej va tayyorlov dasturlari uchun' : "Asosiy darajani mustahkamlash kerak";
    } else {
      $('ieTotal').textContent = '—';
      $('ieTotalNote').textContent = `${all.filter((x) => x == null).length} ta bo'lim qoldi`;
    }
  }
  ['ieL', 'ieR'].forEach((id) => $(id).addEventListener('input', calcIelts));
  ['ieW', 'ieS'].forEach((id) => $(id).addEventListener('change', calcIelts));

  // ---------- Bo'limlar bo'yicha kiritish maydonlari ----------
  function fields(boxId, list, onInput) {
    const box = $(boxId);
    box.textContent = '';
    const inputs = list.map(([label, max]) => {
      const wrap = document.createElement('div');
      const lab = document.createElement('label');
      lab.className = 'field-label';
      lab.textContent = `${label} (0-${max})`;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.max = String(max);
      inp.inputMode = 'numeric';
      inp.addEventListener('input', onInput);
      wrap.append(lab, inp);
      box.appendChild(wrap);
      return { inp, max, label };
    });
    onInput();
    return inputs;
  }

  // ---------- TOPIK ----------
  let tpInputs = [];
  const tpType = seg('tpType', () => buildTopik());
  function buildTopik() {
    tpInputs = tpType() === '1' ? fields('tpInputs', [['듣기 — Tinglash', 100], ['읽기 — O\'qish', 100]], calcTopik) : fields('tpInputs', [['듣기 — Tinglash', 100], ['쓰기 — Yozish', 100], ['읽기 — O\'qish', 100]], calcTopik);
  }
  function calcTopik() {
    const vals = tpInputs.map((x) => num(x.inp, x.max));
    if (!vals.length || vals.some((v) => v == null)) {
      $('tpTotal').textContent = '—';
      $('tpNote').textContent = 'Har bir bo\'lim ballini kiriting';
      return;
    }
    const sum = vals.reduce((n, v) => n + v, 0);
    const lv = tpType() === '1' ? (sum >= 140 ? 2 : sum >= 80 ? 1 : 0) : sum >= 230 ? 6 : sum >= 190 ? 5 : sum >= 150 ? 4 : sum >= 120 ? 3 : 0;
    $('tpTotal').textContent = lv ? `${lv}-daraja` : "Daraja yo'q";
    const next = tpType() === '1' ? [80, 140] : [120, 150, 190, 230];
    const need = next.find((n) => n > sum);
    $('tpNote').textContent = `Jami ${sum} ball${need ? ` · keyingi darajagacha ${need - sum} ball` : ' · eng yuqori daraja!'}`;
  }

  // ---------- Goethe ----------
  let gtInputs = [];
  const gtLevel = seg('gtLevel', () => buildGoethe());
  function buildGoethe() {
    gtInputs = gtLevel() === 'a1' ? fields('gtInputs', [['Jami ball', 100]], calcGoethe) : fields('gtInputs', [['Lesen, %', 100], ['Hören, %', 100], ['Schreiben, %', 100], ['Sprechen, %', 100]], calcGoethe);
  }
  const grade = (p) => (p >= 90 ? 'sehr gut' : p >= 80 ? 'gut' : p >= 70 ? 'befriedigend' : p >= 60 ? 'ausreichend' : "o'tmadi");
  function calcGoethe() {
    const vals = gtInputs.map((x) => num(x.inp, x.max));
    if (!vals.length || vals.some((v) => v == null)) {
      $('gtTotal').textContent = '—';
      $('gtNote').textContent = "Ballarni kiriting";
      return;
    }
    if (gtLevel() === 'a1') {
      const ok = vals[0] >= 60;
      $('gtTotal').textContent = ok ? "✅ O'tdi" : "❌ O'tmadi";
      $('gtNote').textContent = ok ? `Baho: ${grade(vals[0])}` : `Yana ${60 - vals[0]} ball kerak edi`;
      return;
    }
    const failed = gtInputs.filter((x, i) => vals[i] < 60).map((x) => x.label.split(',')[0]);
    $('gtTotal').textContent = failed.length ? `❌ ${failed.length} ta modul o'tmadi` : "✅ Barcha modullar o'tdi";
    $('gtNote').textContent = failed.length ? `Qayta topshirish kerak: ${failed.join(', ')} (modulni alohida topshirish mumkin)` : gtInputs.map((x, i) => `${x.label.split(',')[0]}: ${grade(vals[i])}`).join(' · ');
  }

  // ---------- ТРКИ ----------
  let trInputs = [];
  trInputs = fields('trInputs', [['Лексика/Грамматика, %', 100], ['Чтение, %', 100], ['Аудирование, %', 100], ['Письмо, %', 100], ['Говорение, %', 100]], () => calcTrki());
  function calcTrki() {
    if (!trInputs.length) return;
    const vals = trInputs.map((x) => num(x.inp, x.max));
    if (vals.some((v) => v == null)) {
      $('trTotal').textContent = '—';
      $('trNote').textContent = 'Har bir qism foizini kiriting';
      return;
    }
    const failed = trInputs.filter((x, i) => vals[i] < 66).map((x) => x.label.split(',')[0]);
    const retake = trInputs.filter((x, i) => vals[i] >= 60 && vals[i] < 66).length;
    $('trTotal').textContent = failed.length ? `❌ ${failed.length} ta qism o'tmadi` : "✅ O'tdi";
    $('trNote').textContent = failed.length ? `66% dan past: ${failed.join(', ')}${retake && failed.length === 1 ? ' — shu qismni qayta topshirish mumkin' : ''}` : 'Har bir qismda 66% dan yuqori — tabriklaymiz!';
  }

  // ---------- Mavzu generatori ----------
  let topicsLoaded = false;
  let topics = [];
  let ti = 0;
  const tcLang = seg('tcLang', () => loadTopics());
  const tcType = seg('tcType', () => loadTopics());

  async function loadTopics() {
    topicsLoaded = true;
    const card = $('tcCard');
    card.innerHTML = '<p class="hint-left">Mavzu yuklanmoqda...</p>';
    try {
      const r = await fetch(`/api/tools/topics?lang=${tcLang()}&type=${tcType()}`);
      topics = r.ok ? (await r.json()).topics || [] : [];
    } catch {
      topics = [];
    }
    ti = 0;
    showTopic();
  }

  function showTopic() {
    const card = $('tcCard');
    card.textContent = '';
    const t = topics[ti % Math.max(1, topics.length)];
    if (!t) {
      const p = document.createElement('p');
      p.className = 'hint-left';
      p.textContent = "Bu til uchun mavzular hali tayyorlanmagan. Til Ustoz'da sinovdan o'ting — mavzular shu yerda paydo bo'ladi.";
      card.appendChild(p);
      return;
    }
    const tag = document.createElement('span');
    tag.className = 'ie-tag';
    tag.textContent = [tcType() === 'speak' ? 'Speaking · cue card' : t.kindTitle || 'Writing', t.level].filter(Boolean).join(' · ');
    const q = document.createElement('p');
    q.className = 'ie-task';
    q.textContent = t.task;
    card.append(tag, q);
    if (t.points && t.points.length) {
      const ul = document.createElement('ul');
      ul.className = 'ie-bullets small';
      t.points.forEach((x) => {
        const li = document.createElement('li');
        li.textContent = x;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }
    if (t.task_uz) {
      const uz = document.createElement('p');
      uz.className = 'speak-tr';
      uz.textContent = t.task_uz;
      card.appendChild(uz);
    }
  }
  $('tcNext').addEventListener('click', () => {
    ti++;
    showTopic();
  });

  buildTopik();
  buildGoethe();
  calcIelts();
  const start = (location.hash || '').slice(1);
  if (['ielts', 'topik', 'goethe', 'trki', 'topics'].includes(start)) showTab(start);
})();
