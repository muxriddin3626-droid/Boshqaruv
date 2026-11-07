// Ro'yxatdan o'tish so'rovnomasi (anketa). Savollar o'rganilayotgan tilda (rus, nemis yoki koreys),
// ostida o'zbekcha tarjima. Javoblar sozlamalarni to'ldiradi va ustozga o'quvchini tanitadi.
window.Survey = (() => {
  const App = window.App;
  const $ = (id) => document.getElementById(id);
  const key = (lang) => `tu-profile-${lang}`;

  // t: { ru, de, ko, uz } — matn to'rt tilda.
  const PROFS = [
    { id: 'builder', icon: '👷', ru: 'Строитель', de: 'Bauarbeiter', ko: '건설 노동자', uz: 'Quruvchi' },
    { id: 'driver', icon: '🚕', ru: 'Водитель', de: 'Fahrer', ko: '운전기사', uz: 'Haydovchi' },
    { id: 'cook', icon: '👨‍🍳', ru: 'Повар, официант', de: 'Koch, Kellner', ko: '요리사, 서빙 직원', uz: 'Oshpaz, ofitsiant' },
    { id: 'seller', icon: '🛒', ru: 'Продавец, кассир', de: 'Verkäufer, Kassierer', ko: '판매원, 계산원', uz: 'Sotuvchi, kassir' },
    { id: 'courier', icon: '📦', ru: 'Курьер, кладовщик', de: 'Kurier, Lagerarbeiter', ko: '택배 기사, 창고 직원', uz: 'Kuryer, omborchi' },
    { id: 'nurse', icon: '🧑‍⚕️', ru: 'Медсестра, сиделка', de: 'Pflegekraft', ko: '간병인', uz: 'Hamshira, parvarishchi' },
    { id: 'factory', icon: '🏭', ru: 'Рабочий на заводе', de: 'Fabrikarbeiter', ko: '공장 근로자', uz: 'Zavod ishchisi' },
    { id: 'cleaner', icon: '🧹', ru: 'Уборщик', de: 'Reinigungskraft', ko: '청소원', uz: 'Tozalash xizmati' },
    { id: 'student', icon: '🎓', ru: 'Студент', de: 'Student', ko: '학생', uz: 'Talaba' },
    { id: 'other', icon: '✨', ru: 'Другое', de: 'Etwas anderes', ko: '기타', uz: 'Boshqa' },
  ];

  const QUESTIONS = [
    {
      id: 'name',
      type: 'text',
      q: { ru: 'Как вас зовут?', de: 'Wie heißen Sie?', ko: '이름이 뭐예요?', uz: 'Ismingiz nima?' },
      hint: { ru: 'Меня зовут ...', de: 'Ich heiße ...', ko: '제 이름은 ...예요.', uz: 'Javob: «Mening ismim ...»' },
      placeholder: { ru: 'Например: Мухриддин', de: 'Zum Beispiel: Muxriddin', ko: '예: Muxriddin' },
      required: true,
    },
    {
      id: 'age',
      type: 'one',
      q: { ru: 'Сколько вам лет?', de: 'Wie alt sind Sie?', ko: '몇 살이에요?', uz: 'Yoshingiz nechida?' },
      options: [
        { id: 'u18', ru: 'до 18 лет', de: 'unter 18', ko: '18세 미만', uz: "18 yoshgacha" },
        { id: '18_25', ru: '18–25 лет', de: '18–25 Jahre', ko: '18–25세', uz: '18–25 yosh' },
        { id: '26_35', ru: '26–35 лет', de: '26–35 Jahre', ko: '26–35세', uz: '26–35 yosh' },
        { id: '36_50', ru: '36–50 лет', de: '36–50 Jahre', ko: '36–50세', uz: '36–50 yosh' },
        { id: '50p', ru: 'больше 50', de: 'über 50', ko: '50세 이상', uz: "50 dan katta" },
      ],
      optional: true,
    },
    {
      id: 'city',
      type: 'text',
      q: { ru: 'Откуда вы?', de: 'Woher kommen Sie?', ko: '어디에서 왔어요?', uz: 'Qayerdansiz?' },
      hint: { ru: 'Я из Ташкента.', de: 'Ich komme aus Taschkent.', ko: '저는 타슈켄트에서 왔어요.', uz: 'Javob: «Men Toshkentdanman»' },
      placeholder: { ru: 'Например: Самарканд', de: 'Zum Beispiel: Samarkand', ko: '예: 사마르칸트' },
      optional: true,
    },
    {
      id: 'goal',
      type: 'one',
      q: { ru: 'Зачем вы учите русский язык?', de: 'Warum lernen Sie Deutsch?', ko: '왜 한국어를 배워요?', uz: { ru: "Rus tilini nima uchun o'rganyapsiz?", de: "Nemis tilini nima uchun o'rganyapsiz?", ko: "Koreys tilini nima uchun o'rganyapsiz?" } },
      options: [
        { id: 'patent', only: 'ru', icon: '🛂', ru: 'Работать в России (патент)', uz: "Rossiyada ishlash (patent)" },
        { id: 'eps', only: 'ko', icon: '🏭', ko: '한국에서 일하기 (EPS-TOPIK)', uz: 'Koreyada ishlash (EPS-TOPIK)' },
        { id: 'work', icon: '💼', ru: 'Для работы', de: 'Für die Arbeit in Deutschland', ko: '일하려고요', uz: 'Ish uchun' },
        { id: 'study', icon: '🎓', ru: 'Для учёбы', de: 'Zum Studium', ko: '공부하려고요', uz: "O'qish uchun" },
        { id: 'family', icon: '👨‍👩‍👧', ru: 'Семья, переезд', de: 'Familie, Umzug', ko: '가족, 이사', uz: "Oila, ko'chib o'tish" },
        { id: 'exam', icon: '📜', ru: 'Сдать экзамен (ТРКИ)', de: 'Prüfung bestehen (Goethe)', ko: '시험 합격 (TOPIK)', uz: 'Imtihon topshirish' },
        { id: 'travel', icon: '✈️', ru: 'Для путешествий', de: 'Zum Reisen', ko: '여행하려고요', uz: 'Sayohat uchun' },
        { id: 'self', icon: '💡', ru: 'Для себя', de: 'Für mich', ko: '그냥 좋아서요', uz: "O'zim uchun" },
      ],
      required: true,
    },
    {
      id: 'level',
      type: 'one',
      q: { ru: 'Как хорошо вы знаете русский?', de: 'Wie gut sprechen Sie Deutsch?', ko: '한국어를 얼마나 잘해요?', uz: { ru: 'Rus tilini qanchalik bilasiz?', de: 'Nemis tilini qanchalik bilasiz?', ko: 'Koreys tilini qanchalik bilasiz?' } },
      options: [
        { id: 'zero', icon: '🌱', ru: 'Начинаю с нуля', de: 'Ich fange bei null an', ko: '처음부터 시작해요', uz: 'Noldan boshlayapman' },
        { id: 'little', icon: '🌿', ru: 'Немного знаю', de: 'Ein bisschen', ko: '조금 알아요', uz: 'Biroz bilaman' },
        { id: 'middle', icon: '🌳', ru: 'Средний уровень', de: 'Mittelstufe', ko: '중급이에요', uz: "O'rta daraja" },
        { id: 'good', icon: '🏔️', ru: 'Хорошо говорю', de: 'Ich spreche gut', ko: '잘해요', uz: 'Yaxshi gapiraman' },
      ],
      required: true,
    },
    {
      id: 'prof',
      type: 'one',
      q: { ru: 'Кем вы работаете или хотите работать?', de: 'Was sind Sie von Beruf oder was möchten Sie werden?', ko: '무슨 일을 해요? 아니면 무슨 일을 하고 싶어요?', uz: 'Kim bo\'lib ishlaysiz yoki ishlamoqchisiz?' },
      options: PROFS,
      optional: true,
    },
    {
      id: 'minutes',
      type: 'one',
      q: { ru: 'Сколько минут в день вы хотите заниматься?', de: 'Wie viele Minuten pro Tag möchten Sie lernen?', ko: '하루에 몇 분 공부하고 싶어요?', uz: 'Kuniga necha daqiqa shug\'ullanmoqchisiz?' },
      options: [
        { id: '5', icon: '☕', ru: '5 минут', de: '5 Minuten', ko: '5분', uz: '5 daqiqa' },
        { id: '10', icon: '🙂', ru: '10 минут', de: '10 Minuten', ko: '10분', uz: '10 daqiqa' },
        { id: '20', icon: '💪', ru: '20 минут', de: '20 Minuten', ko: '20분', uz: '20 daqiqa' },
        { id: '30', icon: '🚀', ru: '30 минут и больше', de: '30 Minuten und mehr', ko: '30분 이상', uz: '30 daqiqa va ko\'proq' },
      ],
      required: true,
    },
    {
      id: 'interests',
      type: 'many',
      q: { ru: 'Что вам интересно?', de: 'Was interessiert Sie?', ko: '무엇에 관심이 있어요?', uz: 'Sizga nima qiziq? (bir nechtasini tanlang)' },
      options: [
        { id: 'football', icon: '⚽', ru: 'Футбол', de: 'Fußball', ko: '축구', uz: 'Futbol' },
        { id: 'sport', icon: '🏋️', ru: 'Спорт', de: 'Sport', ko: '운동', uz: 'Sport' },
        { id: 'films', icon: '🎬', ru: 'Кино', de: 'Filme', ko: '영화', uz: 'Kino' },
        { id: 'music', icon: '🎵', ru: 'Музыка', de: 'Musik', ko: '음악', uz: 'Musiqa' },
        { id: 'food', icon: '🍲', ru: 'Еда, кухня', de: 'Essen, Kochen', ko: '음식, 요리', uz: 'Ovqat, oshpazlik' },
        { id: 'travel', icon: '🧳', ru: 'Путешествия', de: 'Reisen', ko: '여행', uz: 'Sayohat' },
        { id: 'tech', icon: '📱', ru: 'Технологии', de: 'Technik', ko: '기술', uz: 'Texnologiya' },
        { id: 'cars', icon: '🚗', ru: 'Машины', de: 'Autos', ko: '자동차', uz: 'Mashinalar' },
        { id: 'family', icon: '🏡', ru: 'Семья', de: 'Familie', ko: '가족', uz: 'Oila' },
        { id: 'nature', icon: '🌄', ru: 'Природа', de: 'Natur', ko: '자연', uz: 'Tabiat' },
        { id: 'books', icon: '📚', ru: 'Книги', de: 'Bücher', ko: '책', uz: 'Kitoblar' },
        { id: 'games', icon: '🎮', ru: 'Игры', de: 'Spiele', ko: '게임', uz: "O'yinlar" },
      ],
      optional: true,
    },
    {
      id: 'mode',
      type: 'one',
      q: { ru: 'Какой учитель вам нравится?', de: 'Was für einen Lehrer möchten Sie?', ko: '어떤 선생님이 좋아요?', uz: 'Qanday ustoz yoqadi?' },
      options: [
        { id: 'kind', icon: '😊', ru: 'Добрый и терпеливый', de: 'Freundlich und geduldig', ko: '친절하고 인내심 있는 선생님', uz: 'Mehribon va sabrli' },
        { id: 'strict', icon: '🔥', ru: 'Строгий, но весёлый', de: 'Streng, aber lustig', ko: '엄격하지만 재미있는 선생님', uz: "Qattiqqo'l, lekin hazilkash" },
      ],
      required: true,
    },
  ];

  const UI = {
    ru: { next: 'Дальше', back: 'Назад', skip: 'Пропустить', done: 'Готово!', start: 'Начать!', title: 'Анкета', plan: 'Ваш план', step: 'Вопрос' },
    de: { next: 'Weiter', back: 'Zurück', skip: 'Überspringen', done: 'Fertig!', start: "Los geht's!", title: 'Fragebogen', plan: 'Ihr Plan', step: 'Frage' },
    ko: { next: '다음', back: '이전', skip: '건너뛰기', done: '완료!', start: '시작해요!', title: '설문', plan: '나의 계획', step: '질문' },
  };

  const LEVEL_TO_SETTING = { zero: 'a1', little: 'auto', middle: 'b1', good: 'b2' };
  const GOAL_TO_TOPIC = { patent: 'migrant', eps: 'migrant', work: 'job', study: 'free', family: 'meet', exam: 'free', travel: 'travel', self: 'free' };
  const MINUTES_TO_XP = { 5: 20, 10: 50, 20: 100, 30: 100 };

  const get = (lang) => App.loadStored(key(lang));
  const done = (lang) => Boolean((get(lang) || {}).done);

  // Ustozga yuboriladigan qisqa profil.
  function profile(lang) {
    const p = get(lang);
    if (!p || !p.done) return null;
    return { name: p.name, age: p.age, city: p.city, goal: p.goal, level: p.level, prof: p.prof, interests: p.interests || [] };
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- Anketa jarayoni ----------

  let lang = null;
  let answers = {};
  let step = 0;
  let onFinish = null;

  const questions = () => QUESTIONS;
  const optionsFor = (q) => (q.options || []).filter((o) => !o.only || o.only === lang);
  const tr = (obj) => (obj && (obj[lang] || obj.ru)) || '';

  function start(nextLang, finish) {
    lang = nextLang;
    onFinish = finish || null;
    const prev = get(lang) || {};
    answers = { ...prev };
    if (!answers.name) {
      const me = window.AccountUI && window.AccountUI.me();
      const tgName = me && me.user && me.user.firstName;
      const certName = App.loadStored('tu-name');
      const guess = tgName || (certName ? String(certName).split(' ')[0] : '');
      // Nemischa va koreyscha anketaga kirillcha ismni qo'ymaymiz (ruscha anketada lotincha ham bo'laveradi).
      answers.name = lang !== 'ru' && /[\u0400-\u04FF]/.test(guess) ? '' : guess;
    }
    step = 0;
    render();
    App.show('survey');
  }

  function isAnswered(q) {
    const v = answers[q.id];
    if (q.type === 'many') return true;
    return typeof v === 'string' && v.trim() !== '';
  }

  function render() {
    const list = questions();
    const ui = UI[lang];
    const body = $('surveyBody');
    body.textContent = '';
    $('surveyTitle').textContent = `📝 ${ui.title}`;
    $('surveyProgress').style.width = `${Math.round((step / list.length) * 100)}%`;

    if (step >= list.length) return renderPlan();

    const q = list[step];
    $('surveyStep').textContent = `${ui.step} ${step + 1} / ${list.length}`;
    Face.set($('surveyFace'), step === 0 ? 'happy' : ['calm', 'happy', 'thinking', 'excited'][step % 4]);

    const head = el('div', 'survey-q');
    head.appendChild(el('h1', '', tr(q.q)));
    const say = el('button', 'icon-btn', '🔊');
    say.type = 'button';
    say.setAttribute('aria-label', 'Eshitish');
    say.addEventListener('click', () => App.speak([{ lang, text: tr(q.q) }]));
    head.appendChild(say);
    body.appendChild(head);
    // O'zbekcha tarjima: ba'zi savollarda tilga qarab farq qiladi (rus / nemis / koreys).
    const uz = typeof q.q.uz === 'object' ? q.q.uz[lang] : q.q.uz;
    body.appendChild(el('p', 'survey-uz', `🇺🇿 ${uz}`));

    if (q.type === 'text') {
      if (q.hint) body.appendChild(el('p', 'survey-hint', `💬 ${tr(q.hint)}  ·  ${q.hint.uz}`));
      const input = el('input', 'survey-input');
      input.type = 'text';
      input.maxLength = 40;
      input.placeholder = tr(q.placeholder);
      input.value = answers[q.id] || '';
      input.addEventListener('input', () => {
        answers[q.id] = input.value;
        updateNav();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && isAnswered(q)) next();
      });
      body.appendChild(input);
      setTimeout(() => input.focus(), 50);
    } else {
      const grid = el('div', `survey-options${q.type === 'many' ? ' many' : ''}`);
      for (const o of optionsFor(q)) {
        const selected = q.type === 'many' ? (answers[q.id] || []).includes(o.id) : answers[q.id] === o.id;
        const b = el('button', `survey-option${selected ? ' selected' : ''}`);
        b.type = 'button';
        if (o.icon) b.appendChild(el('span', 'so-icon', o.icon));
        const t = el('span', 'so-text');
        t.appendChild(el('b', '', tr(o)));
        t.appendChild(el('span', '', o.uz));
        b.appendChild(t);
        b.addEventListener('click', () => {
          if (q.type === 'many') {
            const set = new Set(answers[q.id] || []);
            if (set.has(o.id)) set.delete(o.id);
            else if (set.size < 6) set.add(o.id);
            answers[q.id] = [...set];
            render();
          } else {
            answers[q.id] = o.id;
            App.speak([{ lang, text: tr(o) }]);
            render();
            // Bitta javobli savolda tanlangach o'zi keyingisiga o'tadi.
            setTimeout(() => {
              if (questions()[step] === q) next();
            }, 450);
          }
        });
        grid.appendChild(b);
      }
      body.appendChild(grid);
    }
    updateNav();
  }

  function updateNav() {
    const list = questions();
    const ui = UI[lang];
    const q = list[step];
    $('surveyBack').textContent = `← ${ui.back}`;
    $('surveyBack').hidden = step === 0;
    const nextBtn = $('surveyNext');
    nextBtn.hidden = false;
    if (!q) return;
    const answered = isAnswered(q);
    nextBtn.textContent = answered || q.required ? `${ui.next} →` : `${ui.skip} →`;
    nextBtn.disabled = q.required && !answered;
  }

  function next() {
    const q = questions()[step];
    if (q && q.required && !isAnswered(q)) return;
    step++;
    render();
  }

  // ---------- Yakun: reja ----------

  function recommendation(goal) {
    const R = {
      eps: { text: "Sizga EPS-TOPIK imtihoniga tayyorgarlik va ish joyidagi kasbiy kurslar kerak.", label: '🏭 EPS-TOPIK sinoviga tayyorlanish', run: () => window.Exam.openList() },
      patent: { text: "Sizga patent imtihoniga tayyorgarlik va «Migrant hayoti» vaziyatlari kerak.", label: '🛂 Patent imtihoniga tayyorlanish', run: () => window.Exam.openList() },
      work: { text: "Sizga kasbiy kurs va ish joyidagi rolli vaziyatlar mos keladi.", label: '💼 Kasbiy kursni boshlash', run: () => window.Roles.openProfList() },
      exam: { text: "Avval kursni bosqichma-bosqich o'ting, so'ng imtihon sinovida o'zingizni tekshiring.", label: '🎓 Imtihon sinovlari', run: () => window.Exam.openList() },
      travel: { text: "Sizga sayohat mavzusi va hayotiy rolli vaziyatlar mos keladi.", label: '🎭 Rolli vaziyatlar', run: () => window.Roles.openScenarios() },
    };
    return R[goal] || { text: "Kursni 1-bosqichdan boshlang — har kuni bir oz, va natija tez ko'rinadi.", label: '🗺️ Kursni boshlash', run: () => window.Practice.openCourse() };
  }

  function renderPlan() {
    const ui = UI[lang];
    const body = $('surveyBody');
    $('surveyStep').textContent = '';
    $('surveyProgress').style.width = '100%';
    $('surveyBack').hidden = false;
    $('surveyNext').hidden = true;
    Face.set($('surveyFace'), 'excited');
    const name = (answers.name || '').trim();
    body.appendChild(el('h1', '', `${ui.done} ${name ? `${name}, ` : ''}${ui.plan.toLowerCase()} 👇`));

    const levelText = { zero: "noldan boshlaymiz (A1)", little: "darajangizni ustoz birinchi darsda aniqlaydi", middle: "o'rta daraja (A2-B1)", good: "yuqori daraja (B2+)" }[answers.level];
    const minutes = Number(answers.minutes) || 10;
    const goalXp = MINUTES_TO_XP[minutes] || 50;
    const prof = PROFS.find((p) => p.id === answers.prof);
    const lines = [
      `📊 Daraja: ${levelText}`,
      `🔥 Kunlik maqsad: ${minutes} daqiqa (${goalXp} XP)`,
      `${answers.mode === 'strict' ? '🔥' : '😊'} Ustoz: ${answers.mode === 'strict' ? "qattiqqo'l, lekin hazilkash" : 'mehribon va sabrli'}`,
    ];
    if (prof && !['student', 'other'].includes(prof.id)) lines.push(`${prof.icon} Kasbingiz uchun maxsus kurs bor: ${prof.uz}`);
    if ((answers.interests || []).length) lines.push(`💬 Ustoz misollarni qiziqishlaringizdan oladi`);
    const ul = el('ul', 'plan-list');
    lines.forEach((l) => ul.appendChild(el('li', '', l)));
    body.appendChild(ul);

    const rec = recommendation(answers.goal);
    const box = el('div', 'plan-rec');
    box.appendChild(el('p', '', `🎯 ${rec.text}`));
    body.appendChild(box);

    const startBtn = el('button', 'primary big', `${ui.start} 🚀`);
    startBtn.type = 'button';
    startBtn.addEventListener('click', () => {
      finish();
      rec.run();
    });
    const menuBtn = el('button', 'secondary', 'Menyuga o\'tish');
    menuBtn.type = 'button';
    menuBtn.addEventListener('click', () => {
      finish();
      App.openMenu();
    });
    const actions = el('div', 'end-actions');
    actions.append(startBtn, menuBtn);
    body.appendChild(actions);

    // Akkauntga kirish taklifi (natijalar yo'qolmasligi uchun) — sozlangan bo'lsa.
    if (!$('startLogin').hidden) {
      const login = el('div', 'login-hint');
      login.appendChild(el('p', '', "🔐 Anketa va natijalaringiz yo'qolmasligi uchun akkauntga kiring (ixtiyoriy)."));
      login.appendChild(button('secondary', '🔐 Kirish', () => {
        finish();
        window.AccountUI.open();
      }));
      body.appendChild(login);
    }
  }

  function button(cls, text, onClick) {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  // Javoblarni saqlab, sozlamalarni anketaga moslaymiz.
  function finish() {
    const p = { ...answers, name: (answers.name || '').trim(), city: (answers.city || '').trim(), done: true, updated: Date.now() };
    App.store(key(lang), p);
    App.setSettings({
      level: LEVEL_TO_SETTING[p.level] || 'auto',
      topic: GOAL_TO_TOPIC[p.goal] || 'free',
      mode: p.mode === 'strict' ? 'strict' : 'kind',
    });
    window.Learn.setGoal(MINUTES_TO_XP[Number(p.minutes)] || 50);
    if (p.name && !App.loadStored('tu-name')) App.store('tu-name', p.name);
    App.stopSpeaking();
    if (onFinish) onFinish();
  }

  $('surveyNext').addEventListener('click', next);
  $('surveyBack').addEventListener('click', () => {
    if (step > 0) {
      step--;
      render();
    }
  });
  $('surveyClose').addEventListener('click', () => {
    App.stopSpeaking();
    if (done(lang)) App.openMenu(lang);
    else App.show('start');
  });

  // Menyudagi "maqsad" kartochkasi uchun.
  function goalCard(forLang) {
    const p = get(forLang);
    if (!p || !p.done) return null;
    const g = QUESTIONS.find((q) => q.id === 'goal').options.find((o) => o.id === p.goal);
    const rec = recommendation(p.goal);
    return { goal: g ? `${g.icon} ${g.uz}` : '', label: rec.label, run: rec.run, name: p.name };
  }

  return { start, done, profile, goalCard };
})();
