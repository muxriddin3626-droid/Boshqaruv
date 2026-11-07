// Bugungi yangiliklar: o'rganilayotgan til mamlakatidan 4-5 ta yangilik, sodda tilda — o'qish,
// tinglash, so'zlarni daftarga olish va ustoz bilan muhokama qilish.
window.News = (() => {
  const App = window.App;
  const $ = (id) => document.getElementById(id);
  const COUNTRY = { ru: 'Rossiya', de: 'Germaniya', ko: 'Koreya' };

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

  function renderCard() {
    const lang = App.lang();
    $('newsDesc').textContent = `${COUNTRY[lang] || ''}dan bugungi yangiliklar — o'qing, tinglang, ustoz bilan muhokama qiling`;
  }

  async function open() {
    const lang = App.lang();
    const body = $('newsBody');
    body.textContent = '';
    App.show('news');
    const wait = el('div', 'hg-intro study-loading');
    const face = el('div', 'face-slot small');
    wait.append(face, el('p', '', '⏳ Bugungi yangiliklar tayyorlanmoqda... (kunning birinchi ochilishida bir daqiqagacha)'));
    body.appendChild(wait);
    window.Face.set(face, 'thinking');
    let news;
    try {
      const res = await fetch(`/api/news?lang=${lang}`);
      news = await res.json();
      if (!res.ok) throw new Error(news.error || 'Xatolik');
    } catch (err) {
      body.textContent = '';
      const box = el('div', 'hg-intro');
      box.append(el('p', '', err.message), button('primary', '🔁 Qayta urinish', open));
      body.appendChild(box);
      return;
    }
    render(news);
    // Kuniga bir marta o'qigani uchun XP.
    const key = `tu-news-${lang}`;
    if (App.loadStored(key) !== news.day) {
      App.store(key, news.day);
      window.Practice.awardXp(5, 'Yangiliklar');
    }
  }

  function render(news) {
    const body = $('newsBody');
    body.textContent = '';
    const head = el('div', 'hg-intro');
    head.append(
      el('h2', 'vc-goal', `📰 ${COUNTRY[App.lang()]} · ${news.day.split('-').reverse().join('.')}`),
      el('p', 'hint-left', news.stale ? "Bugungi yangiliklar hali tayyor emas — kechagilari ko'rsatilmoqda." : "Matnni bosing — ovoz chiqarib o'qiladi. So'zni bosing — daftarga qo'shiladi.")
    );
    body.appendChild(head);
    for (const n of news.items) {
      const card = el('article', 'news-card');
      const title = button('news-title', n.title, () => say(`${n.title}. ${n.text}`));
      const text = button('news-text', n.text, () => say(n.text));
      const uz = el('p', 'news-uz', `🇺🇿 ${n.summaryUz}`);
      uz.hidden = true;
      const tools = el('div', 'news-tools');
      tools.append(
        button('chip', '🔊 Tinglash', () => say(`${n.title}. ${n.text}`)),
        button('chip', '🇺🇿 Tarjima', () => {
          uz.hidden = !uz.hidden;
        })
      );
      const words = el('div', 'news-words');
      for (const w of n.words) {
        words.appendChild(
          button('news-word', `${w.word} — ${w.translation}`, () => {
            window.Learn.addWord(App.lang(), w.word, w.translation);
            say(w.word);
            window.Practice.toast(`📒 «${w.word}» daftarga qo'shildi`);
          })
        );
      }
      card.append(title, text, uz, tools, words);
      if (n.sourceUrl) {
        const a = el('a', 'news-source', `Manba: ${n.sourceName || new URL(n.sourceUrl).hostname} ↗`);
        a.href = n.sourceUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        card.appendChild(a);
      }
      body.appendChild(card);
    }
    const go = button('primary big news-go', `🎙️ ${App.tutor().name} bilan muhokama qilish`, () => App.startLesson({ topic: 'news' }));
    body.appendChild(go);
  }

  $('newsCard').addEventListener('click', open);
  $('newsBack').addEventListener('click', () => App.openMenu());

  return { open, renderCard };
})();
