// Koreys yozuvi (Hangul) uchun yordam: har bir koreyscha matn ostida lotincha o'qilishi
// va «Hangul alifbosi» bo'limi (harflar, ovozi va harf testi).
window.Hangul = (() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Lotincha o'qilishi (o'zbek o'quvchisi uchun moslangan) ----------
  // O'qish oson bo'lishi uchun ㅓ va ㅗ ikkalasi ham «o», ㅡ — «i» (farqi alifbo bo'limida tushuntiriladi).

  const INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
  const VOWELS = ['a', 'e', 'ya', 'ye', 'o', 'e', 'yo', 'ye', 'o', 'va', 've', 've', 'yo', 'u', 'vo', 've', 'vi', 'yu', 'i', 'ui', 'i'];
  // Bo'g'in oxiridagi undosh: [yolg'iz aytilishi, keyingi unliga o'tganda: qoladigan qism, o'tadigan qism]
  const FINALS = [
    ['', '', ''], ['k', '', 'g'], ['k', '', 'kk'], ['k', 'k', 's'], ['n', '', 'n'], ['n', 'n', 'j'], ['n', '', 'n'],
    ['t', '', 'd'], ['l', '', 'r'], ['k', 'l', 'g'], ['m', 'l', 'm'], ['l', 'l', 'b'], ['l', 'l', 's'], ['l', 'l', 't'],
    ['p', 'l', 'p'], ['l', '', 'r'], ['m', '', 'm'], ['p', '', 'b'], ['p', 'p', 's'], ['t', '', 's'], ['t', '', 'ss'],
    ['ng', 'ng', ''], ['t', '', 'j'], ['t', '', 'ch'], ['k', '', 'k'], ['t', '', 't'], ['p', '', 'p'], ['', '', ''],
  ];
  const NASAL = { k: 'ng', t: 'n', p: 'm' };
  const H_ASPIRATE = { 0: 'k', 3: 't', 12: 'ch' }; // ㅎ + ㄱ/ㄷ/ㅈ → k/t/ch
  const HANGUL_RUN = /(?:[\d–-]+\s*)?[가-힣]+(?:[\s\d.,!?~…–-]*[가-힣]+)*/g;

  function decompose(ch) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c > 11171) return null;
    return { i: Math.floor(c / 588), v: Math.floor((c % 588) / 28), f: c % 28 };
  }

  // Bitta so'zni (bo'shliqsiz) o'qilishiga aylantiradi, asosiy talaffuz qoidalari bilan.
  function word(text) {
    const syl = [...text].map(decompose);
    let out = '';
    let carry = null; // oldingi bo'g'indan o'tgan undosh
    for (let n = 0; n < syl.length; n++) {
      const s = syl[n];
      if (!s) {
        out += text[n];
        carry = null;
        continue;
      }
      let init = carry !== null ? carry : INITIALS[s.i];
      carry = null;
      const next = syl[n + 1];
      let fin = FINALS[s.f][0];
      if (next && s.f) {
        if (next.i === 11 && s.f !== 21) {
          // Keyingi bo'g'in unli bilan boshlansa, oxirgi undosh unga o'tadi: 이름이 → irimi
          fin = FINALS[s.f][1];
          carry = FINALS[s.f][2];
        } else if (s.f === 27 && H_ASPIRATE[next.i]) {
          fin = '';
          carry = H_ASPIRATE[next.i];
        } else if ((next.i === 2 || next.i === 6) && NASAL[fin]) {
          fin = NASAL[fin]; // 합니다 → hamnida
        } else if (next.i === 5 && (s.f === 4 || s.f === 8)) {
          fin = 'l';
          carry = 'l'; // 신라 → silla
        } else if (next.i === 5 && s.f !== 8) {
          carry = 'n'; // 심리 → simni
          if (NASAL[fin]) fin = NASAL[fin];
        } else if (next.i === 2 && s.f === 8) {
          carry = 'l'; // 설날 → sollal
        }
      }
      out += init + VOWELS[s.v] + fin;
    }
    return out;
  }

  function translit(text) {
    return String(text)
      .split(/(\s+)/)
      .map((part) => (/\s/.test(part) ? part : word(part)))
      .join('');
  }

  // Matndagi koreyscha qismlarning o'qilishi (aralash matnda faqat koreyscha qismlar).
  function reading(text) {
    const runs = String(text).match(HANGUL_RUN);
    return runs ? runs.map(translit).join(' · ') : '';
  }

  // ---------- Sahifadagi koreyscha matnlar ostiga o'qilishini qo'yish ----------
  // O'qilishi CSS (::after, data-ko-tr) orqali chiqadi — elementning textContent'i o'zgarmaydi,
  // shuning uchun o'yinlardagi javob tekshiruvi va ovoz bunga ta'sir qilmaydi.

  const TR_KEY = 'tu-ko-tr';
  const SKIP = 'script, style, textarea, input, select, .no-tr, title';
  let scheduled = false;

  function enabled() {
    const v = window.App ? window.App.loadStored(TR_KEY) : null;
    return v !== false;
  }

  function annotate() {
    scheduled = false;
    const want = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/[가-힣]/.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest(SKIP)) continue;
      want.set(el, (want.get(el) || '') + n.data + ' ');
    }
    document.querySelectorAll('[data-ko-tr]').forEach((el) => {
      if (!want.has(el)) el.removeAttribute('data-ko-tr');
    });
    for (const [el, text] of want) {
      const tr = reading(text);
      if (tr && el.getAttribute('data-ko-tr') !== tr) el.setAttribute('data-ko-tr', tr);
      else if (!tr) el.removeAttribute('data-ko-tr');
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(annotate);
  }

  function applySetting() {
    document.body.classList.toggle('ko-tr-off', !enabled());
    const btn = $('koTrToggle');
    if (btn) btn.textContent = enabled() ? "🔤 Lotincha o'qilishi: yoqilgan" : "🔤 Lotincha o'qilishi: o'chirilgan";
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();

  // ---------- Hangul alifbosi ----------

  const CONSONANTS = [
    ['ㄱ', 'g / k', '가'], ['ㄴ', 'n', '나'], ['ㄷ', 'd / t', '다'], ['ㄹ', 'r / l', '라'], ['ㅁ', 'm', '마'],
    ['ㅂ', 'b / p', '바'], ['ㅅ', 's', '사'], ['ㅇ', "— / ng (boshida o'qilmaydi)", '아'], ['ㅈ', 'j', '자'],
    ['ㅊ', 'ch', '차'], ['ㅋ', 'k (kuchli)', '카'], ['ㅌ', 't (kuchli)', '타'], ['ㅍ', 'p (kuchli)', '파'], ['ㅎ', 'h', '하'],
  ];
  const DOUBLE = [['ㄲ', 'kk (tarang)', '까'], ['ㄸ', 'tt (tarang)', '따'], ['ㅃ', 'pp (tarang)', '빠'], ['ㅆ', 'ss (tarang)', '싸'], ['ㅉ', 'jj (tarang)', '짜']];
  const VOWEL_LIST = [
    ['ㅏ', 'a', '아'], ['ㅓ', 'o (ochiq, og\'iz keng)', '어'], ['ㅗ', "o (lablar yumaloq, «o'»ga yaqin)", '오'], ['ㅜ', 'u', '우'],
    ['ㅡ', 'i (lablar cho\'zilib, «ы»ga yaqin)', '으'], ['ㅣ', 'i', '이'], ['ㅐ', 'e', '애'], ['ㅔ', 'e', '에'],
    ['ㅑ', 'ya', '야'], ['ㅕ', 'yo (ochiq)', '여'], ['ㅛ', "yo (yumaloq, «yo'»ga yaqin)", '요'], ['ㅠ', 'yu', '유'],
  ];
  const COMPOUND = [['ㅘ', 'va', '와'], ['ㅝ', 'vo', '워'], ['ㅚ', 've', '외'], ['ㅟ', 'vi', '위'], ['ㅢ', 'ui', '의'], ['ㅖ', 'ye', '예']];
  const EXAMPLES = [
    ['안녕하세요', 'salom'], ['감사합니다', 'rahmat'], ['네', 'ha'], ['아니요', "yo'q"], ['물', 'suv'], ['밥', 'ovqat, guruch'],
    ['한국', 'Koreya'], ['우즈베키스탄', "O'zbekiston"], ['회사', 'kompaniya'], ['일', 'ish'],
  ];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const say = (text) => window.App.speak([{ lang: 'ko', text }]);

  function letterGrid(title, list) {
    const box = el('section', 'hg-group');
    box.appendChild(el('h2', '', title));
    const grid = el('div', 'hg-grid no-tr');
    for (const [jamo, sound, syl] of list) {
      const b = el('button', 'hg-letter');
      b.type = 'button';
      b.append(el('span', 'hg-jamo', jamo), el('span', 'hg-sound', sound), el('span', 'hg-syl', `${syl} — ${translit(syl)}`));
      b.addEventListener('click', () => say(syl));
      grid.appendChild(b);
    }
    box.appendChild(grid);
    return box;
  }

  function renderAlphabet() {
    const body = $('hangulBody');
    body.textContent = '';
    const intro = el('div', 'hg-intro');
    intro.appendChild(el('p', '', "Koreys yozuvi juda mantiqiy: 14 ta undosh va 10 ta asosiy unli. Harflar bo'g'in bo'lib bitta «quti»ga yoziladi:"));
    const demo = el('p', 'hg-demo no-tr');
    demo.textContent = 'ㅎ + ㅏ + ㄴ = 한 (han)   ·   ㄱ + ㅜ + ㄱ = 국 (guk)   →   한국 (Hanguk) — Koreya';
    intro.appendChild(demo);
    intro.appendChild(el('p', 'hint-left', "Harfni bosing — ovozini eshitasiz. Har kuni 10 daqiqa — va 2-3 kunda o'qiy boshlaysiz!"));
    body.appendChild(intro);

    const test = el('button', 'primary big hg-test-btn', '🎯 Harf testi (10 savol)');
    test.type = 'button';
    test.addEventListener('click', startQuiz);
    body.appendChild(test);

    body.append(
      letterGrid('Unlilar', VOWEL_LIST),
      letterGrid('Undoshlar', CONSONANTS),
      letterGrid('Tarang (qo\'sh) undoshlar', DOUBLE),
      letterGrid('Qo\'shma unlilar', COMPOUND)
    );

    const ex = el('section', 'hg-group');
    ex.appendChild(el('h2', '', "Birinchi so'zlar"));
    const list = el('div', 'hg-words');
    for (const [ko, uz] of EXAMPLES) {
      const b = el('button', 'hg-word');
      b.type = 'button';
      b.append(el('b', '', ko), el('span', 'muted', ` — ${uz}`));
      b.addEventListener('click', () => say(ko));
      list.appendChild(b);
    }
    ex.appendChild(list);
    body.appendChild(ex);
  }

  // ---------- Harf testi: bo'g'in ko'rsatiladi, to'g'ri o'qilishini tanlash ----------


  function randomSyllable() {
    const ci = Math.floor(Math.random() * 19);
    const vi = Math.floor(Math.random() * 21);
    const fi = Math.random() < 0.3 ? [0, 4, 8, 16, 21, 1, 17][Math.floor(Math.random() * 7)] : 0;
    return String.fromCharCode(0xac00 + ci * 588 + vi * 28 + fi);
  }

  let quiz = null;

  function startQuiz() {
    quiz = { n: 0, correct: 0, total: 10 };
    nextQuestion();
  }

  function nextQuestion() {
    const body = $('hangulBody');
    body.textContent = '';
    if (quiz.n >= quiz.total) return finishQuiz();
    const syl = randomSyllable();
    const right = translit(syl);
    const options = new Set([right]);
    while (options.size < 4) {
      const t = translit(randomSyllable());
      if (t !== right) options.add(t);
    }
    const head = el('div', 'hg-quiz no-tr');
    head.appendChild(el('p', 'hint-left', `Savol ${quiz.n + 1} / ${quiz.total} · Bu bo'g'in qanday o'qiladi?`));
    const big = el('button', 'hg-big', syl);
    big.type = 'button';
    big.addEventListener('click', () => say(syl));
    head.appendChild(big);
    const grid = el('div', 'options');
    for (const opt of [...options].sort(() => Math.random() - 0.5)) {
      const b = el('button', 'option', opt);
      b.type = 'button';
      b.addEventListener('click', () => {
        if (grid.dataset.done) return;
        grid.dataset.done = '1';
        const ok = opt === right;
        if (ok) quiz.correct++;
        b.classList.add(ok ? 'correct' : 'wrong');
        grid.querySelectorAll('.option').forEach((o) => {
          if (o.textContent === right) o.classList.add('correct');
        });
        say(syl);
        quiz.n++;
        setTimeout(nextQuestion, ok ? 900 : 1800);
      });
      grid.appendChild(b);
    }
    head.appendChild(grid);
    body.appendChild(head);
  }

  function finishQuiz() {
    const body = $('hangulBody');
    const box = el('div', 'hg-quiz');
    box.appendChild(el('h2', '', `${quiz.correct} / ${quiz.total} to'g'ri ${quiz.correct >= 8 ? '🎉' : '💪'}`));
    box.appendChild(
      el('p', 'hint-left', quiz.correct >= 8 ? "Zo'r! Endi ustoz bilan darsda harflarni o'qib ko'ring." : "Harflar jadvalini yana bir ko'rib chiqing va qayta urinib ko'ring.")
    );
    const again = el('button', 'primary', '🔁 Yana test');
    again.type = 'button';
    again.addEventListener('click', startQuiz);
    const back = el('button', 'secondary', '🔤 Alifboga qaytish');
    back.type = 'button';
    back.addEventListener('click', renderAlphabet);
    const actions = el('div', 'end-actions');
    actions.append(again, back);
    box.appendChild(actions);
    body.appendChild(box);
    if (quiz.correct) window.Practice.awardXp(quiz.correct * 2, 'Harf testi');
  }

  function open() {
    renderAlphabet();
    window.App.show('hangul');
  }

  // Menyu: koreys tili tanlanganda alifbo kartasi va o'qilishi tugmasi ko'rinadi.
  function renderMenu(lang) {
    const ko = lang === 'ko';
    $('hangulCard').hidden = !ko;
    $('koTrToggle').hidden = !ko;
    applySetting();
  }

  $('hangulCard').addEventListener('click', open);
  $('koTrToggle').addEventListener('click', () => {
    window.App.store(TR_KEY, !enabled());
    applySetting();
  });
  applySetting();

  return { translit, reading, open, renderMenu };
})();
