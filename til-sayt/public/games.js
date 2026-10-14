// O'yinlar va testlar: test, so'z juftlash, gap tuzish, eshitib topish.
// Savollarni server (Claude) tayyorlaydi, o'yin esa brauzerda o'ynaladi.
window.Games = (() => {
  const App = window.App;
  const $ = (id) => document.getElementById(id);

  const TITLES = { quiz: '📝 Test', match: "🧩 So'z juftlash", order: '🔤 Gap tuzish', listen: '🎧 Eshitib top' };
  const PRAISE = {
    kind: ['Barakalla!', "Zo'r!", 'Ofarin!', "To'ppa-to'g'ri!", 'Juda yaxshi!'],
    strict: ['Hmm, nihoyat!', 'Mana bu boshqa gap.', "Yomon emas... davom et.", 'Qoyil, kutmagandim!'],
  };
  const OOPS = {
    kind: ["Hechqisi yo'q, mana to'g'risi:", 'Deyarli! Yana bir bor qarang:', 'Xato — lekin shunday o\'rganamiz.'],
    strict: ['Yana-a?! Qara, mana to\'g\'risi:', "Bu nima bo'ldi endi?!", 'Ey-ey! Diqqat bilan!'],
  };

  const body = $('gameBody');
  const face = $('gameFace');
  const reaction = $('gameReaction');
  const feedback = $('feedback');
  const feedbackText = $('feedbackText');
  const nextBtn = $('nextBtn');

  let type = null;
  let data = null;
  let index = 0;
  let score = 0;
  let total = 0;
  let streak = 0;
  let onNext = null;
  let loadToken = 0;

  // ---------- Yordamchilar ----------

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const mode = () => App.settings().mode;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Qisqa ovozli signal: to'g'ri javobga ikki ko'tariluvchi ton, xatoga past ton.
  let audioCtx = null;
  function beep(ok) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = ok ? [660, 880] : [220, 180];
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t = audioCtx.currentTime + i * 0.11;
        osc.type = ok ? 'sine' : 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(ok ? 0.18 : 0.08, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch {}
  }

  function updateBar() {
    $('gameScore').textContent = `⭐ ${score}`;
    $('gameProgress').style.width = `${total ? Math.round((index / total) * 100) : 0}%`;
  }

  function react(ok) {
    beep(ok);
    if (ok) {
      score++;
      streak++;
      Face.set(face, streak >= 3 ? 'excited' : 'happy');
      reaction.textContent = streak >= 3 ? `${pick(PRAISE[mode()])} 🔥 ${streak} ta ketma-ket!` : pick(PRAISE[mode()]);
    } else {
      streak = 0;
      Face.set(face, mode() === 'strict' ? 'angry' : 'surprised');
      reaction.textContent = pick(OOPS[mode()]);
    }
    updateBar();
  }

  function showFeedback(text, next) {
    feedbackText.textContent = text || '';
    feedbackText.hidden = !text;
    feedback.hidden = false;
    onNext = next;
    nextBtn.focus({ preventScroll: true });
  }

  function hideFeedback() {
    feedback.hidden = true;
    onNext = null;
  }

  nextBtn.addEventListener('click', () => {
    const fn = onNext;
    hideFeedback();
    if (fn) fn();
  });

  function step() {
    index++;
    updateBar();
    if (index >= total) finish();
    else render();
  }

  function speakTarget(text) {
    return App.speak([{ lang: App.lang(), text }]);
  }

  // Variantlar tugmalari (test va eshitib topish uchun).
  function optionButtons(options, correct, after) {
    const wrap = el('div', 'options');
    const buttons = options.map((opt) => {
      const b = el('button', 'option', opt);
      b.type = 'button';
      b.addEventListener('click', () => {
        buttons.forEach((x) => {
          x.disabled = true;
          if (x.textContent === correct) x.classList.add('correct');
        });
        const ok = opt === correct;
        if (!ok) b.classList.add('wrong');
        react(ok);
        after(ok);
      });
      wrap.appendChild(b);
      return b;
    });
    return wrap;
  }

  // ---------- 1. Test ----------

  function renderQuiz() {
    const q = data.items[index];
    body.appendChild(el('p', 'question', q.question));
    body.appendChild(
      optionButtons(shuffle([q.correct, ...q.wrong]), q.correct, (ok) => {
        showFeedback(ok ? q.explanation : `To'g'ri javob: ${q.correct}. ${q.explanation}`, step);
      })
    );
  }

  // ---------- 2. Eshitib top ----------

  function renderListen() {
    const q = data.items[index];
    body.appendChild(el('p', 'question', 'Eshiting va eshitganingizni tanlang:'));
    const play = el('button', 'play-btn', '🔊 Eshitish');
    play.type = 'button';
    play.addEventListener('click', () => speakTarget(q.text));
    body.appendChild(play);
    body.appendChild(
      optionButtons(shuffle([q.text, ...q.wrong]), q.text, () => {
        showFeedback(`${q.text} — ${q.translation}`, step);
      })
    );
    speakTarget(q.text);
  }

  // ---------- 3. Gap tuzish ----------

  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:«»"„“”¿¡()–—-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  function renderOrder() {
    const q = data.items[index];
    const words = q.sentence.split(/\s+/).filter(Boolean);
    let tiles = shuffle(words.map((w, i) => ({ w, i })));
    // Aralashtirilgan tartib to'g'ri tartib bilan bir xil chiqmasin.
    for (let k = 0; k < 5 && tiles.every((t, i) => t.w === words[i]); k++) tiles = shuffle(tiles);

    body.appendChild(el('p', 'question', `Gapni tuzing: «${q.translation}»`));
    const answer = el('div', 'answer-line');
    const pool = el('div', 'tile-pool');
    const check = el('button', 'primary big check-btn', 'Tekshirish');
    check.type = 'button';
    check.disabled = true;
    const placed = [];

    const refresh = () => {
      answer.classList.toggle('empty', placed.length === 0);
      check.disabled = placed.length !== words.length;
    };

    tiles.forEach((t) => {
      const tile = el('button', 'tile', t.w);
      tile.type = 'button';
      tile.addEventListener('click', () => {
        if (check.dataset.done) return;
        if (tile.parentElement === pool) {
          answer.appendChild(tile);
          placed.push(tile);
        } else {
          pool.appendChild(tile);
          placed.splice(placed.indexOf(tile), 1);
        }
        refresh();
      });
      pool.appendChild(tile);
    });

    check.addEventListener('click', () => {
      check.dataset.done = '1';
      check.hidden = true;
      const built = placed.map((t) => t.textContent).join(' ');
      const ok = normalize(built) === normalize(q.sentence);
      answer.classList.add(ok ? 'correct' : 'wrong');
      react(ok);
      speakTarget(q.sentence);
      showFeedback(ok ? q.sentence : `To'g'risi: ${q.sentence}`, step);
    });

    body.append(answer, pool, check);
    refresh();
  }

  // ---------- 4. So'z juftlash ----------

  const ROUND = 4;

  function renderMatch() {
    // index — juftlangan so'zlar soni; har raundda 4 tadan so'z chiqadi.
    const round = data.pairs.slice(index, index + ROUND);
    const missed = new Set();
    let selected = null;
    let done = 0;

    body.appendChild(el('p', 'question', "So'zni bosing, so'ng uning tarjimasini bosing:"));
    const grid = el('div', 'match-grid');
    const left = el('div', 'match-col');
    const right = el('div', 'match-col');

    const makeCard = (text, pairIdx, side) => {
      const c = el('button', 'match-card', text);
      c.type = 'button';
      c.dataset.pair = pairIdx;
      c.dataset.side = side;
      c.addEventListener('click', () => choose(c));
      return c;
    };

    round.forEach((p, i) => left.appendChild(makeCard(p.word, i, 'word')));
    shuffle(round.map((p, i) => ({ p, i }))).forEach(({ p, i }) => right.appendChild(makeCard(p.translation, i, 'tr')));

    function choose(card) {
      if (card.classList.contains('matched')) return;
      if (card.dataset.side === 'word') speakTarget(card.textContent);
      if (!selected || selected.dataset.side === card.dataset.side) {
        if (selected) selected.classList.remove('selected');
        selected = card;
        card.classList.add('selected');
        return;
      }
      const a = selected;
      selected = null;
      a.classList.remove('selected');
      const word = a.dataset.side === 'word' ? a : card;
      if (a.dataset.pair === card.dataset.pair) {
        a.classList.add('matched');
        card.classList.add('matched');
        const firstTry = !missed.has(word.dataset.pair);
        if (firstTry) react(true);
        else {
          beep(true);
          Face.set(face, 'happy');
        }
        done++;
        index++;
        updateBar();
        if (done === round.length) {
          if (index >= total) setTimeout(finish, 600);
          else showFeedback('', render);
          nextBtn.textContent = 'Keyingi raund';
        }
      } else {
        missed.add(word.dataset.pair);
        [a, card].forEach((c) => {
          c.classList.add('shake');
          setTimeout(() => c.classList.remove('shake'), 400);
        });
        react(false);
      }
    }

    grid.append(left, right);
    body.appendChild(grid);
  }

  // ---------- Umumiy oqim ----------

  function render() {
    body.textContent = '';
    nextBtn.textContent = 'Keyingi';
    if (type === 'quiz') renderQuiz();
    else if (type === 'listen') renderListen();
    else if (type === 'order') renderOrder();
    else renderMatch();
  }

  async function start(nextType) {
    type = nextType;
    const token = ++loadToken;
    App.unlockAudio();
    hideFeedback();
    $('gameTitle').textContent = TITLES[type];
    $('gameScore').textContent = '';
    $('gameProgress').style.width = '0%';
    body.textContent = '';
    body.appendChild(el('p', 'loading', `${App.tutor().name} savollar tayyorlayapti...`));
    reaction.textContent = '';
    Face.set(face, 'thinking');
    face.dataset.state = 'thinking';
    App.show('game');

    try {
      const result = await App.postJson('/api/game', {
        lang: App.lang(),
        type,
        settings: App.settings(),
        focus: App.focus(),
      });
      if (token !== loadToken) return;
      data = result;
    } catch (err) {
      if (token !== loadToken) return;
      face.dataset.state = 'idle';
      Face.set(face, 'surprised');
      body.textContent = '';
      body.appendChild(el('p', 'loading', err instanceof TypeError ? "Internet bilan aloqa yo'q." : err.message));
      const retry = el('button', 'primary', 'Qayta urinish');
      retry.type = 'button';
      retry.addEventListener('click', () => start(type));
      body.appendChild(retry);
      return;
    }

    face.dataset.state = 'idle';
    Face.set(face, 'calm');
    index = 0;
    score = 0;
    streak = 0;
    total = (data.pairs || data.items).length;
    updateBar();
    render();
  }

  function finish() {
    App.stopSpeaking();
    hideFeedback();
    const ratio = total ? score / total : 0;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    $('resultStars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    $('resultTitle').textContent = `${total} dan ${score} ta to'g'ri!`;

    const key = App.bestKey();
    const best = App.loadStored(key) || {};
    const prev = best[type];
    const record = !prev || score / prev.total > prev.score / prev.total;
    if (record) {
      best[type] = { score, total };
      App.store(key, best);
    }

    const name = App.tutor().name;
    let text;
    if (ratio >= 0.9) text = `${name}: Ajoyib natija! Siz haqiqiy yulduzsiz.`;
    else if (ratio >= 0.6) text = `${name}: Yaxshi! Yana bir-ikki mashq — va mukammal bo'ladi.`;
    else text = mode() === 'strict' ? `${name}: Hmm... Yana o'ynaymiz, men kutaman!` : `${name}: Hechqisi yo'q, takrorlash — o'rganishning onasi!`;
    if (record && prev) text += ' 🏆 Yangi rekord!';
    $('resultText').textContent = text;

    Face.set($('resultFace'), ratio >= 0.9 ? 'excited' : ratio >= 0.6 ? 'happy' : mode() === 'strict' ? 'angry' : 'calm');
    App.show('result');
  }

  $('gameBackBtn').addEventListener('click', () => {
    loadToken++;
    App.stopSpeaking();
    hideFeedback();
    App.openMenu();
  });
  $('replayBtn').addEventListener('click', () => start(type));
  $('resultMenuBtn').addEventListener('click', () => App.openMenu());

  return { start };
})();
