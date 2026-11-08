// Harakat va hajm: orqa fondagi suzuvchi 3D harflar, kursorga (yoki telefon egilishiga)
// qarab buriladigan yuzcha va kartochkalar, ekran almashganda chuqurlikdan kirish,
// kartochkalarning aylanishi. «Kamroq harakat» sozlamasi yoqilgan bo'lsa, o'chadi.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  const root = document.documentElement;

  // ---------- Orqa fondagi 3D harflar ----------
  const GLYPHS = {
    ru: ['Я', 'Ж', 'Ё', 'Щ', 'Д', 'Ы', 'Б', 'Ф'],
    de: ['Ä', 'Ö', 'Ü', 'ß', 'W', 'Z', 'Ei', 'Sch'],
    ko: ['한', 'ㄱ', '가', 'ㅎ', '말', 'ㅏ', '사', '랑'],
    en: ['A', 'W', 'Th', 'Q', '&', 'Ee', 'Sh', 'Y'],
    all: ['Я', 'Ä', '한', 'Ж', 'Ü', '가', 'ß', 'Ё', 'ㅎ', 'O‘'],
  };
  const COLORS = ['var(--accent)', 'var(--teal)', 'var(--sun)', 'var(--plum)', 'var(--leaf)', '#e0679b'];
  const stage = document.createElement('div');
  stage.className = 'fx-stage no-tr';
  stage.setAttribute('aria-hidden', 'true');
  document.body.prepend(stage);
  let stageLang = null;

  function fillStage(lang) {
    if (stageLang === lang) return;
    stageLang = lang;
    stage.textContent = '';
    const list = GLYPHS[lang] || GLYPHS.all;
    const count = window.innerWidth < 600 ? 7 : 11;
    for (let i = 0; i < count; i++) {
      const g = document.createElement('span');
      g.className = 'fx-glyph';
      g.textContent = list[i % list.length];
      // Ekran chetlari bo'ylab joylashtiramiz — markazdagi matnga xalaqit bermasin.
      const side = i % 2 === 0;
      const x = side ? 2 + Math.random() * 18 : 80 + Math.random() * 16;
      const y = 6 + (i / count) * 86 + Math.random() * 6;
      const size = window.innerWidth < 600 ? 34 + Math.random() * 26 : 44 + Math.random() * 46;
      g.style.cssText = [
        `left:${x}%`,
        `top:${y}%`,
        `--s:${size.toFixed(0)}px`,
        `--g:${COLORS[i % COLORS.length]}`,
        `--d:${(14 + Math.random() * 10).toFixed(1)}s`,
        `--delay:${(-Math.random() * 20).toFixed(1)}s`,
        `--depth:${(8 + size / 4).toFixed(0)}`,
        `--rx0:${(Math.random() * 30 - 15).toFixed(0)}deg`,
        `--ry0:${(Math.random() * 50 - 25).toFixed(0)}deg`,
        `--rz0:${(Math.random() * 24 - 12).toFixed(0)}deg`,
      ].join(';');
      stage.appendChild(g);
    }
  }

  // ---------- Kursor / telefon egilishi ----------
  let px = 0;
  let py = 0;
  let raf = 0;

  function apply() {
    raf = 0;
    root.style.setProperty('--px', px.toFixed(3));
    root.style.setProperty('--py', py.toFixed(3));
    stage.querySelectorAll('.fx-glyph').forEach((g) => {
      g.style.setProperty('--px', px.toFixed(3));
      g.style.setProperty('--py', py.toFixed(3));
    });
    // Ko'rinib turgan yuzchalar foydalanuvchiga «qaraydi».
    document.querySelectorAll('.face-slot').forEach((f) => {
      if (!f.offsetParent) return;
      f.style.setProperty('--ry', `${(px * 16).toFixed(1)}deg`);
      f.style.setProperty('--rx', `${(-py * 12).toFixed(1)}deg`);
      f.style.setProperty('--lx', px.toFixed(2));
      f.style.setProperty('--ly', py.toFixed(2));
    });
  }

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    },
    { passive: true }
  );

  window.addEventListener(
    'deviceorientation',
    (e) => {
      if (e.gamma == null) return;
      px = Math.max(-1, Math.min(1, e.gamma / 30));
      py = Math.max(-1, Math.min(1, (e.beta - 40) / 30));
      schedule();
    },
    { passive: true }
  );

  // ---------- Kartochkalarni 3D egish ----------
  const TILT = '.lang-card, .big-card, .vc-theme, .plan-card, .hg-lesson';
  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const card = e.target.closest && e.target.closest(TILT);
      document.querySelectorAll('.fx-tilting').forEach((c) => {
        if (c !== card) {
          c.classList.remove('fx-tilting');
          c.style.transform = '';
        }
      });
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.classList.add('fx-tilting');
      card.style.transform = `perspective(700px) rotateY(${(x * 10).toFixed(2)}deg) rotateX(${(-y * 10).toFixed(2)}deg) translateY(-3px)`;
    },
    { passive: true }
  );

  // ---------- Ekran almashganda ----------
  function enter(screen) {
    screen.classList.remove('screen-enter');
    void screen.offsetWidth; // animatsiyani qaytadan boshlash
    screen.classList.add('screen-enter');
    setTimeout(() => screen.classList.remove('screen-enter'), 900);
    const lang = window.App && window.App.lang && window.App.lang();
    fillStage(screen.id === 'startScreen' ? 'all' : lang || 'all');
    // Harflar faqat bosh sahifa va menyuda — dars va mashqlarda diqqatni bo'lmasin.
    stage.classList.toggle('calm', !['startScreen', 'menuScreen', 'accountScreen'].includes(screen.id));
  }

  const screens = document.querySelectorAll('main.screen');
  const obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.attributeName === 'hidden' && !m.target.hidden) enter(m.target);
    }
  });
  screens.forEach((s) => obs.observe(s, { attributes: true, attributeFilter: ['hidden'] }));

  // ---------- Kartochka aylanishi (javob ochilganda va yangi so'z chiqqanda) ----------
  const fcBack = document.getElementById('fcBack');
  const fcFront = document.getElementById('fcFront');
  const flip = (el) => {
    el.classList.remove('flip-in');
    void el.offsetWidth;
    el.classList.add('flip-in');
  };
  if (fcBack) {
    new MutationObserver(() => !fcBack.hidden && flip(document.getElementById('flashcard'))).observe(fcBack, { attributes: true, attributeFilter: ['hidden'] });
  }
  if (fcFront) {
    new MutationObserver(() => flip(document.getElementById('flashcard'))).observe(fcFront, { childList: true, characterData: true, subtree: true });
  }
  // Lug'at kartochkalari har safar yangidan chiziladi — paydo bo'lganda aylantiramiz.
  new MutationObserver((list) => {
    for (const m of list) {
      m.addedNodes.forEach((n) => n.nodeType === 1 && n.classList && n.classList.contains('vc-flash') && flip(n));
    }
  }).observe(document.body, { childList: true, subtree: true });

  fillStage('all');
  apply();
})();
