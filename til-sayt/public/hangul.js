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

    const back = el('button', 'secondary hg-test-btn', '← Bosqichlarga qaytish');
    back.type = 'button';
    back.addEventListener('click', renderHome);
    body.appendChild(back);

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

  // ---------- Harflar kursi: bosqichma-bosqich ----------

  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JONG = { ㄱ: 1, ㄴ: 4, ㄷ: 7, ㄹ: 8, ㅁ: 16, ㅂ: 17, ㅅ: 19, ㅇ: 21 };
  const compose = (c, v, f = '') => String.fromCharCode(0xac00 + CHO.indexOf(c) * 588 + JUNG.indexOf(v) * 28 + (JONG[f] || 0));

  // Har bosqich: yangi harflar [harf, tovush, eslab qolish usuli], misol so'zlar [so'z, tarjima].
  const LESSONS = [
    {
      id: 'h1',
      icon: '🌱',
      title: 'Asosiy unlilar',
      intro:
        "Koreys unlilari tayoqchalardan tuziladi. Tayoqcha qayerga qaragan bo'lsa — tovush shunga qarab o'zgaradi. Unli yolg'iz yozilmaydi: oldiga o'qilmaydigan «ㅇ» qo'yiladi — 아, 오, 이.",
      vowels: [
        ['ㅏ', 'a', "Tik chiziq, tayoqcha o'ngga — «a»"],
        ['ㅓ', 'o', "Tayoqcha chapga — «o», og'iz keng ochiladi"],
        ['ㅗ', 'o', "Tayoqcha yuqoriga — «o», lablar yumaloq («o'»ga yaqin)"],
        ['ㅜ', 'u', 'Tayoqcha pastga — «u»'],
        ['ㅡ', 'i', "Yotgan chiziq — «ы»ga yaqin «i», lablar yon tomonga cho'ziladi"],
        ['ㅣ', 'i', 'Tik turgan chiziq — oddiy «i»'],
      ],
      consonants: [['ㅇ', '—', "Bo'g'in boshida o'qilmaydi, faqat «joy egallaydi»"]],
      words: [['아이', 'bola'], ['오이', 'bodring'], ['이', 'ikki; tish'], ['아우', 'uka']],
    },
    {
      id: 'h2',
      icon: '👅',
      title: 'Birinchi undoshlar',
      intro: "Undoshlarning shakli og'iz va tilning holatiga o'xshaydi — shuning uchun ular oson eslab qolinadi.",
      consonants: [
        ['ㄱ', 'g / k', "Tilning orqa qismi tanglayga tegadi — shakli ham shunday"],
        ['ㄴ', 'n', "Til uchi tishlar orqasiga tegadi — «n»"],
        ['ㄷ', 'd / t', "ㄴ ustiga qopqoq — «d»"],
        ['ㄹ', 'r / l', "Ilonday egri — unli oldida «r», so'z oxirida «l»"],
        ['ㅁ', 'm', "To'rtburchak — yopiq og'iz, «m»"],
      ],
      words: [['나', 'men'], ['너', 'sen'], ['고기', "go'sht"], ['나라', 'mamlakat'], ['머리', 'bosh'], ['다리', 'oyoq']],
    },
    {
      id: 'h3',
      icon: '🧍',
      title: 'Yana 4 ta undosh',
      intro: "Bu bosqichdan keyin siz ko'p oddiy so'zlarni o'qiy olasiz!",
      consonants: [
        ['ㅂ', 'b / p', "Chelakka o'xshaydi — «b»"],
        ['ㅅ', 's', "Ikki oyoqli odamcha — «s»"],
        ['ㅈ', 'j', "ㅅ ning ustiga chiziq — «j»"],
        ['ㅎ', 'h', "Shlyapa kiygan odamcha — «h»"],
      ],
      words: [['바다', 'dengiz'], ['사자', 'sher'], ['하나', 'bir'], ['비', "yomg'ir"], ['지도', 'xarita'], ['나비', 'kapalak']],
    },
    {
      id: 'h4',
      icon: '✌️',
      title: '«Y» li unlilar va «e»',
      intro: "Tayoqcha ikkita bo'lsa, unli oldiga «y» qo'shiladi: ㅏ a → ㅑ ya. ㅐ va ㅔ ikkalasi ham «e» deb o'qiladi.",
      vowels: [
        ['ㅑ', 'ya', "ㅏ ga ikkinchi tayoqcha — «ya»"],
        ['ㅕ', 'yo', "ㅓ ga ikkinchi tayoqcha — «yo» (ochiq)"],
        ['ㅛ', 'yo', "ㅗ ga ikkinchi tayoqcha — «yo» (yumaloq)"],
        ['ㅠ', 'yu', "ㅜ ga ikkinchi tayoqcha — «yu»"],
        ['ㅐ', 'e', 'ㅏ + ㅣ — «e»'],
        ['ㅔ', 'e', 'ㅓ + ㅣ — bu ham «e»'],
      ],
      words: [['야구', 'beysbol'], ['여자', 'ayol'], ['우유', 'sut'], ['요리', 'ovqat pishirish'], ['개', 'it'], ['네', 'ha']],
    },
    {
      id: 'h5',
      icon: '💨',
      title: 'Kuchli (nafasli) undoshlar',
      intro: "Harfga qo'shimcha chiziq qo'shilsa — tovush kuchli nafas bilan aytiladi: ㄱ g → ㅋ k.",
      consonants: [
        ['ㅊ', 'ch', "ㅈ ustiga chiziqcha — «ch»"],
        ['ㅋ', 'k', "ㄱ ga chiziq — kuchli «k»"],
        ['ㅌ', 't', "ㄷ ga chiziq — kuchli «t»"],
        ['ㅍ', 'p', 'Kuchli «p»'],
      ],
      words: [['차', 'choy; mashina'], ['커피', 'qahva'], ['코', 'burun'], ['토마토', 'pomidor'], ['피자', 'pitsa'], ['치마', 'yubka']],
    },
    {
      id: 'h6',
      icon: '👯',
      title: 'Tarang (qo\'sh) undoshlar',
      intro: "Ikkita bir xil harf — tovush tarang, kuchli va nafassiz aytiladi.",
      consonants: [
        ['ㄲ', 'kk', 'Tarang «k»'],
        ['ㄸ', 'tt', 'Tarang «t»'],
        ['ㅃ', 'pp', 'Tarang «p»'],
        ['ㅆ', 'ss', 'Tarang «s»'],
        ['ㅉ', 'jj', 'Tarang «j»'],
      ],
      words: [['아빠', 'dada'], ['오빠', 'aka (qiz aytadi)'], ['싸요', 'arzon'], ['짜요', "sho'r"], ['또', 'yana'], ['까치', "zag'izg'on"]],
    },
    {
      id: 'h7',
      icon: '🧱',
      title: 'Pastki undosh (받침)',
      intro: "Bo'g'in tagida ham undosh bo'lishi mumkin: 바 + ㅂ = 밥 (bap). Tagdagi ㅇ — «ng». Tagdagi ㄷ, ㅅ, ㅈ — qisqa «t».",
      finals: [
        ['ㄱ', 'k', '박 — bak'],
        ['ㄴ', 'n', '산 — san'],
        ['ㄹ', 'l', '물 — mul'],
        ['ㅁ', 'm', '감 — gam'],
        ['ㅂ', 'p', '밥 — bap'],
        ['ㅇ', 'ng', '강 — gang'],
        ['ㅅ', 't', '옷 — ot'],
      ],
      words: [['밥', 'ovqat, guruch'], ['산', "tog'"], ['물', 'suv'], ['강', 'daryo'], ['집', 'uy'], ['한국', 'Koreya'], ['옷', 'kiyim'], ['돈', 'pul']],
    },
    {
      id: 'h8',
      icon: '🔗',
      title: "Qo'shma unlilar",
      intro: "Ikki unli qo'shilib bitta tovush bo'ladi: ㅗ + ㅏ = ㅘ (va).",
      vowels: [
        ['ㅘ', 'va', 'ㅗ + ㅏ — «va»'],
        ['ㅝ', 'vo', 'ㅜ + ㅓ — «vo»'],
        ['ㅚ', 've', 'ㅗ + ㅣ — «ve»'],
        ['ㅟ', 'vi', 'ㅜ + ㅣ — «vi»'],
        ['ㅢ', 'ui', 'ㅡ + ㅣ — «ui»'],
        ['ㅖ', 'ye', 'ㅕ + ㅣ — «ye»'],
      ],
      words: [['사과', 'olma'], ['뭐', 'nima'], ['회사', 'kompaniya'], ['귀', 'quloq'], ['의사', 'shifokor'], ['시계', 'soat']],
    },
    {
      id: 'h9',
      icon: '📖',
      title: "So'zlarni o'qish",
      intro: "Barcha harflarni bilasiz! Endi kundalik so'zlarni o'qib mashq qilamiz.",
      words: [
        ['안녕하세요', 'salom'], ['감사합니다', 'rahmat'], ['사랑', 'sevgi'], ['학교', 'maktab'], ['친구', "do'st"],
        ['선생님', "o'qituvchi"], ['한국어', 'koreys tili'], ['우즈베키스탄', "O'zbekiston"], ['병원', 'kasalxona'],
        ['시장', 'bozor'], ['일', 'ish'], ['괜찮아요', 'hechqisi yo\'q'], ['얼마예요', 'qancha turadi'], ['물', 'suv'],
      ],
    },
  ];

  const PROGRESS_KEY = 'tu-hangul';
  const PASS = 6;
  const QUESTIONS = 8;

  const progress = () => (window.App.loadStored(PROGRESS_KEY) || {}).done || {};
  const isDone = (id) => Boolean(progress()[id]);
  const unlocked = (i) => i === 0 || isDone(LESSONS[i - 1].id);

  // i-bosqichgacha o'rganilgan harflar.
  function learned(i) {
    const upto = LESSONS.slice(0, i + 1);
    return {
      cons: [...new Set(upto.flatMap((l) => (l.consonants || []).map((x) => x[0])))],
      vows: [...new Set(upto.flatMap((l) => (l.vowels || []).map((x) => x[0])))],
      finals: upto.some((l) => l.finals) ? Object.keys(JONG) : [],
      words: upto.flatMap((l) => l.words || []),
    };
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function syllableFor(i, preferNew) {
    const L = learned(i);
    const lesson = LESSONS[i];
    const newCons = (lesson.consonants || []).map((x) => x[0]);
    const newVows = (lesson.vowels || []).map((x) => x[0]);
    const c = preferNew && newCons.length ? pick(newCons) : pick(L.cons.length ? L.cons : ['ㅇ']);
    const v = preferNew && newVows.length && (!newCons.length || Math.random() < 0.5) ? pick(newVows) : pick(L.vows);
    const f = L.finals.length && (lesson.finals || Math.random() < 0.3) && Math.random() < 0.6 ? pick(L.finals) : '';
    return compose(c, v, f);
  }

  // Savol: «read» — bo'g'in/so'z ko'rsatiladi, o'qilishini tanlash; «listen» — eshitib, harfini tanlash.
  function makeQuestion(i, n) {
    const L = learned(i);
    const lesson = LESSONS[i];
    const useWord = L.words.length && (lesson.id === 'h9' || n % 3 === 2);
    if (useWord) {
      const pool = lesson.id === 'h9' || !lesson.words ? L.words : lesson.words;
      const [ko, uz] = pick(pool);
      const right = translit(ko);
      const opts = new Set([right]);
      for (let k = 0; k < 40 && opts.size < 4; k++) {
        const t = translit(pick(L.words)[0]);
        opts.add(t);
      }
      return { kind: 'read', show: ko, hint: uz, say: ko, right, options: [...opts] };
    }
    const syl = syllableFor(i, n % 2 === 0);
    if (n % 2 === 1 && i > 0) {
      const opts = new Map([[translit(syl), syl]]);
      for (let k = 0; k < 40 && opts.size < 4; k++) {
        const s2 = syllableFor(i, false);
        if (!opts.has(translit(s2))) opts.set(translit(s2), s2);
      }
      return { kind: 'listen', say: syl, right: syl, options: [...opts.values()] };
    }
    const right = translit(syl);
    const opts = new Set([right]);
    for (let k = 0; k < 40 && opts.size < 4; k++) opts.add(translit(syllableFor(i, false)));
    return { kind: 'read', show: syl, say: syl, right, options: [...opts] };
  }

  function lettersPreview(lesson) {
    const list = [...(lesson.vowels || []), ...(lesson.consonants || []), ...(lesson.finals || [])].map((x) => x[0]);
    return list.length ? list.join(' ') : lesson.words.slice(0, 3).map((w) => w[0]).join(' ');
  }

  function renderHome() {
    const body = $('hangulBody');
    body.textContent = '';
    const done = LESSONS.filter((l) => isDone(l.id)).length;

    const intro = el('div', 'hg-intro');
    intro.appendChild(el('p', '', "Koreys yozuvi — Hangul — juda mantiqiy. 9 ta qisqa bosqichda harflarni o'rganib, so'zlarni o'qiy boshlaysiz. Har bosqich ~5 daqiqa."));
    const bar = el('div', 'xp-bar');
    const fill = el('div', 'xp-fill');
    fill.style.width = `${Math.round((done / LESSONS.length) * 100)}%`;
    bar.appendChild(fill);
    intro.append(bar, el('p', 'hint-left', `${done} / ${LESSONS.length} bosqich o'tildi`));
    body.appendChild(intro);

    const list = el('div', 'hg-lessons');
    LESSONS.forEach((lesson, i) => {
      const open = unlocked(i);
      const b = el('button', `hg-lesson${isDone(lesson.id) ? ' done' : ''}${open ? '' : ' locked'}`);
      b.type = 'button';
      const text = el('span', 'act-text');
      text.append(el('span', 'act-title', `${i + 1}. ${lesson.title}`), el('span', 'hg-preview no-tr', lettersPreview(lesson)));
      b.append(el('span', 'act-icon', lesson.icon), text, el('span', 'hg-state', isDone(lesson.id) ? '✅' : open ? '▶' : '🔒'));
      b.addEventListener('click', () => (open ? renderLesson(i) : window.Practice.toast("Avval oldingi bosqichni o'ting 🙂")));
      list.appendChild(b);
    });
    body.appendChild(list);

    const extra = el('div', 'hg-extra');
    const voice = el('button', 'primary big', '🎙️ Minji bilan ovozli harflar darsi');
    voice.type = 'button';
    voice.addEventListener('click', () => window.App.startLesson({ topic: 'hangul' }));
    const table = el('button', 'secondary', '📋 Barcha harflar jadvali');
    table.type = 'button';
    table.addEventListener('click', renderAlphabet);
    const mixed = el('button', 'secondary', '🎯 Aralash harf testi');
    mixed.type = 'button';
    mixed.addEventListener('click', () => startQuiz(LESSONS.length - 2, null));
    extra.append(voice, table, mixed);
    body.appendChild(extra);
  }

  function letterCards(title, list, playFor) {
    const box = el('section', 'hg-group');
    box.appendChild(el('h2', '', title));
    const grid = el('div', 'hg-cards no-tr');
    for (const [jamo, sound, tip] of list) {
      const b = el('button', 'hg-card');
      b.type = 'button';
      const sample = playFor(jamo);
      b.append(
        el('span', 'hg-jamo', jamo),
        el('span', 'hg-card-text', ''),
      );
      const t = b.lastChild;
      t.append(el('b', '', sound), el('span', '', tip), el('span', 'hg-syl', sample.map((x) => `${x} — ${translit(x)}`).join('  ·  ')));
      b.addEventListener('click', () => sample.forEach((x) => say(x)));
      grid.appendChild(b);
    }
    box.appendChild(grid);
    return box;
  }

  function renderLesson(i) {
    const lesson = LESSONS[i];
    const body = $('hangulBody');
    body.textContent = '';
    window.scrollTo(0, 0);
    body.appendChild(el('h1', 'hg-title', `${lesson.icon} ${i + 1}-bosqich: ${lesson.title}`));
    const intro = el('div', 'hg-intro');
    intro.appendChild(el('p', '', lesson.intro));
    intro.appendChild(el('p', 'hint-left', "Kartani bosing — ovozini eshitasiz. Ovoz chiqarib takrorlang!"));
    body.appendChild(intro);

    if (lesson.vowels) body.appendChild(letterCards('Yangi unlilar', lesson.vowels, (v) => [compose('ㅇ', v)]));
    if (lesson.consonants) {
      body.appendChild(
        letterCards('Yangi undoshlar', lesson.consonants, (c) => (c === 'ㅇ' ? ['아', '오'] : [compose(c, 'ㅏ'), compose(c, 'ㅗ')]))
      );
    }
    if (lesson.finals) body.appendChild(letterCards('Pastki undoshlar', lesson.finals, (f) => [compose(f === 'ㅇ' ? 'ㄱ' : 'ㅂ', 'ㅏ', f)]));

    const ex = el('section', 'hg-group');
    ex.appendChild(el('h2', '', "So'zlar"));
    const words = el('div', 'hg-words no-tr');
    for (const [ko, uz] of lesson.words) {
      const b = el('button', 'hg-word');
      b.type = 'button';
      b.append(el('b', '', ko), el('span', 'hg-word-tr', translit(ko)), el('span', 'muted', uz));
      b.addEventListener('click', () => say(ko));
      words.appendChild(b);
    }
    ex.appendChild(words);
    body.appendChild(ex);

    const actions = el('div', 'end-actions');
    const go = el('button', 'primary big', `✍️ Mashq qilish (${QUESTIONS} savol)`);
    go.type = 'button';
    go.addEventListener('click', () => startQuiz(i, lesson.id));
    const back = el('button', 'secondary', '← Bosqichlar');
    back.type = 'button';
    back.addEventListener('click', renderHome);
    actions.append(go, back);
    body.appendChild(actions);
  }

  // ---------- Mashq ----------

  let quiz = null;

  function startQuiz(lessonIndex, lessonId) {
    quiz = { i: lessonIndex, id: lessonId, n: 0, correct: 0, total: lessonId ? QUESTIONS : 10 };
    nextQuestion();
  }

  function nextQuestion() {
    const body = $('hangulBody');
    body.textContent = '';
    if (quiz.n >= quiz.total) return finishQuiz();
    const q = makeQuestion(quiz.i, quiz.n);
    const box = el('div', 'hg-quiz no-tr');
    box.appendChild(
      el('p', 'hint-left', `Savol ${quiz.n + 1} / ${quiz.total} · ${q.kind === 'listen' ? "Eshiting va to'g'ri bo'g'inni tanlang" : "Bu qanday o'qiladi?"}`)
    );
    const big = el('button', `hg-big${q.show && q.show.length > 2 ? ' word' : ''}`, q.kind === 'listen' ? '🔊' : q.show);
    big.type = 'button';
    big.addEventListener('click', () => say(q.say));
    box.appendChild(big);
    if (q.hint) box.appendChild(el('p', 'hint-left', `Ma'nosi: ${q.hint}`));
    if (q.kind === 'listen') setTimeout(() => say(q.say), 300);
    const grid = el('div', `options${q.kind === 'listen' ? ' hg-hangul-opts' : ''}`);
    for (const opt of q.options.sort(() => Math.random() - 0.5)) {
      const b = el('button', 'option', opt);
      b.type = 'button';
      b.addEventListener('click', () => {
        if (grid.dataset.done) return;
        grid.dataset.done = '1';
        const ok = opt === q.right;
        if (ok) quiz.correct++;
        b.classList.add(ok ? 'correct' : 'wrong');
        grid.querySelectorAll('.option').forEach((o) => {
          if (o.textContent === q.right) o.classList.add('correct');
        });
        if (q.kind !== 'listen') say(q.say);
        if (!ok && q.kind === 'listen') box.appendChild(el('p', 'hint-left', `${q.right} — ${translit(q.right)}`));
        quiz.n++;
        setTimeout(nextQuestion, ok ? 1000 : 2200);
      });
      grid.appendChild(b);
    }
    box.appendChild(grid);
    body.appendChild(box);
  }

  function finishQuiz() {
    const body = $('hangulBody');
    const box = el('div', 'hg-quiz');
    const passed = quiz.id ? quiz.correct >= PASS : quiz.correct >= 8;
    box.appendChild(el('div', 'hg-big', passed ? '🎉' : '💪'));
    box.appendChild(el('h2', '', `${quiz.correct} / ${quiz.total} to'g'ri`));
    const actions = el('div', 'end-actions');
    if (quiz.id) {
      const lesson = LESSONS[quiz.i];
      if (passed) {
        const firstTime = !isDone(lesson.id);
        const data = window.App.loadStored(PROGRESS_KEY) || {};
        window.App.store(PROGRESS_KEY, { ...data, done: { ...(data.done || {}), [lesson.id]: Math.max(quiz.correct, progress()[lesson.id] || 0) } });
        window.Practice.awardXp(firstTime ? 15 + quiz.correct : quiz.correct, 'Hangul');
        const next = LESSONS[quiz.i + 1];
        box.appendChild(
          el('p', 'hint-left', next ? `Bosqich o'tildi! Keyingisi: ${next.icon} ${next.title}` : "Tabriklaymiz! Siz Hangulni o'rgandingiz — endi ustoz bilan darsda o'qib ko'ring!")
        );
        if (next) {
          const go = el('button', 'primary', '➡️ Keyingi bosqich');
          go.type = 'button';
          go.addEventListener('click', () => renderLesson(quiz.i + 1));
          actions.appendChild(go);
        }
      } else {
        box.appendChild(el('p', 'hint-left', `O'tish uchun kamida ${PASS} ta to'g'ri javob kerak. Harflarni yana bir ko'rib chiqing va qayta urinib ko'ring.`));
        const again = el('button', 'primary', '🔁 Qayta mashq');
        again.type = 'button';
        again.addEventListener('click', () => startQuiz(quiz.i, quiz.id));
        const review = el('button', 'secondary', '👀 Harflarni ko\'rish');
        review.type = 'button';
        review.addEventListener('click', () => renderLesson(quiz.i));
        actions.append(again, review);
      }
    } else {
      if (quiz.correct) window.Practice.awardXp(quiz.correct * 2, 'Harf testi');
      const again = el('button', 'primary', '🔁 Yana test');
      again.type = 'button';
      again.addEventListener('click', () => startQuiz(quiz.i, null));
      actions.appendChild(again);
    }
    const home = el('button', 'secondary', '← Bosqichlar');
    home.type = 'button';
    home.addEventListener('click', renderHome);
    actions.appendChild(home);
    box.appendChild(actions);
    body.appendChild(box);
  }

  function open() {
    renderHome();
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
