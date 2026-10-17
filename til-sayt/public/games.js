// O'yinlar va testlar: test, so'z juftlash, gap tuzish, eshitib topish.
// Savollarni server (Claude) tayyorlaydi, o'yin esa brauzerda o'ynaladi.
window.Games = (() => {
  const App = window.App;
  const $ = (id) => document.getElementById(id);

  const TITLES = {
    quiz: '📝 Test',
    match: "🧩 So'z juftlash",
    order: '🔤 Gap tuzish',
    listen: '🎧 Eshitib top',
    speak: '🗣️ Talaffuz',
  };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
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
  let ctx = {}; // { unit, exam, prof } — kurs bosqichi yoki kasb mavzusidan ochilgan bo'lsa

  // Xato qilingan so'z yoki gap takrorlash daftariga tushadi.
  function remember(word, translation) {
    window.Learn.addWord(App.lang(), word, translation, { lapse: true });
  }

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
        if (!ok && q.correct.split(/\s+/).length <= 4) remember(q.correct, q.explanation);
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
      optionButtons(shuffle([q.text, ...q.wrong]), q.text, (ok) => {
        if (!ok) remember(q.text, q.translation);
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
      if (!ok) remember(q.sentence, q.translation);
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
        if (!missed.has(word.dataset.pair)) {
          const pair = round[Number(word.dataset.pair)];
          remember(pair.word, pair.translation);
        }
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

  // ---------- 5. Talaffuz ----------

  const words = (s) =>
    s
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/ß/g, 'ss')
      .replace(/[.,!?;:«»"„“”¿¡()–—-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

  // Aytilgan gapdagi so'zlarni namunaga moslaydi (eng uzun umumiy ketma-ketlik).
  // Qaysi so'zlar to'g'ri aytilganini (true/false ro'yxat) qaytaradi.
  function matchWords(target, said) {
    const a = words(target);
    const b = words(said);
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ok = new Array(a.length).fill(false);
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        ok[i] = true;
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return ok;
  }

  let recognition = null;

  function stopRecognition() {
    if (recognition) {
      recognition.onend = null;
      try { recognition.abort(); } catch {}
      recognition = null;
    }
  }

  function renderSpeak() {
    const q = data.items[index];
    let attempts = 0;
    let scored = false;

    body.appendChild(el('p', 'question', 'Tinglang va ovoz chiqarib takrorlang:'));
    const phrase = el('p', 'speak-phrase');
    const paint = (marks) => {
      phrase.textContent = '';
      // Matnni so'zlarga bo'lib, har birini aytilgan-aytilmaganiga qarab bo'yaymiz.
      const tokens = q.text.split(/\s+/);
      let w = 0;
      tokens.forEach((tok, k) => {
        const span = el('span', 'sw', tok);
        const hasWord = words(tok).length > 0;
        if (marks && hasWord) span.classList.add(marks[w] ? 'ok' : 'miss');
        if (hasWord) w += words(tok).length;
        phrase.appendChild(span);
        if (k < tokens.length - 1) phrase.appendChild(document.createTextNode(' '));
      });
    };
    paint(null);
    body.appendChild(phrase);
    body.appendChild(el('p', 'speak-tr', q.translation));
    if (q.tip) body.appendChild(el('p', 'speak-tip', `💡 ${q.tip}`));

    const heard = el('p', 'heard');
    const row = el('div', 'control-row');
    const play = el('button', 'round-btn', '🔊');
    play.type = 'button';
    play.setAttribute('aria-label', 'Eshitish');
    play.addEventListener('click', () => speakTarget(q.text));
    const mic = el('button', 'mic-btn');
    mic.type = 'button';
    mic.setAttribute('aria-label', 'Takrorlash');
    mic.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12z" fill="currentColor"/></svg>';
    const skip = el('button', 'round-btn', '⏭');
    skip.type = 'button';
    skip.setAttribute('aria-label', "O'tkazib yuborish");
    skip.addEventListener('click', () => {
      stopRecognition();
      if (!scored) remember(q.text, q.translation);
      step();
    });
    row.append(play, mic, skip);
    body.append(row, heard);

    if (!SR) {
      mic.disabled = true;
      heard.textContent = "Bu brauzer ovozni tanimaydi. Chrome'da oching yoki tinglab, o'zingiz takrorlang.";
    }

    const evaluate = (said) => {
      attempts++;
      const marks = matchWords(q.text, said);
      const ratio = marks.length ? marks.filter(Boolean).length / marks.length : 0;
      paint(marks);
      heard.textContent = `Siz: «${said}» — ${Math.round(ratio * 100)}%`;
      if (ratio >= 0.8) {
        scored = true;
        if (ratio === 1) window.Learn.bumpStat('perfectSpeak');
        react(true);
        showFeedback(ratio === 1 ? 'Mukammal talaffuz! 🎯' : "Juda yaxshi! Qizil so'zlarga yana e'tibor bering.", step);
      } else {
        react(false);
        if (attempts >= 3) {
          remember(q.text, q.translation);
          showFeedback("Hechqisi yo'q — bu iborani takrorlash daftaringizga qo'shdim.", step);
        } else {
          reaction.textContent += ` Yana urinib ko'ring (${attempts}/3).`;
          speakTarget(q.text);
        }
      }
    };

    mic.addEventListener('click', () => {
      if (!SR || scored) return;
      if (recognition) {
        recognition.stop();
        return;
      }
      App.stopSpeaking();
      const rec = new SR();
      recognition = rec;
      rec.lang = App.locale();
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      let finalText = '';
      mic.classList.add('listening');
      heard.textContent = 'Tinglayapman...';
      rec.onresult = (e) => {
        let interim = '';
        finalText = '';
        for (const r of e.results) {
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        heard.textContent = (finalText + ' ' + interim).trim();
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed') heard.textContent = 'Mikrofonga ruxsat berilmadi.';
      };
      rec.onend = () => {
        recognition = null;
        mic.classList.remove('listening');
        if (finalText.trim()) evaluate(finalText.trim());
        else if (heard.textContent === 'Tinglayapman...') heard.textContent = "Eshitmadim — mikrofonni bosib, qaytadan ayting.";
      };
      try {
        rec.start();
      } catch {
        recognition = null;
        mic.classList.remove('listening');
      }
    });

    speakTarget(q.text);
  }

  // ---------- Umumiy oqim ----------

  function render() {
    body.textContent = '';
    nextBtn.textContent = 'Keyingi';
    if (type === 'quiz') renderQuiz();
    else if (type === 'listen') renderListen();
    else if (type === 'order') renderOrder();
    else if (type === 'speak') renderSpeak();
    else renderMatch();
  }

  async function start(nextType, opts = {}) {
    type = nextType;
    ctx = { unit: opts.unit || null, exam: Boolean(opts.exam), prof: opts.prof || null };
    const token = ++loadToken;
    App.unlockAudio();
    stopRecognition();
    hideFeedback();
    $('gameTitle').textContent = ctx.exam ? '🏁 Imtihon' : TITLES[type];
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
        settings: { ...App.settings(), unit: ctx.unit, exam: ctx.exam, prof: ctx.prof },
        focus: App.focus(),
        profile: App.profile(),
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
      retry.addEventListener('click', () => start(type, ctx));
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

  // Natija oynasi: matn, yulduzlar va yuzcha. Hikoya (practice.js) ham shundan foydalanadi.
  function showResult({ score: s, total: t, title, text, unit }) {
    const ratio = t ? s / t : 0;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    $('resultStars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    $('resultTitle').textContent = title || `${t} dan ${s} ta to'g'ri!`;
    $('resultText').textContent = text;
    $('resultMenuBtn').textContent = unit ? '← Orqaga' : 'Menyu';
    Face.set($('resultFace'), ratio >= 0.9 ? 'excited' : ratio >= 0.6 ? 'happy' : mode() === 'strict' ? 'angry' : 'calm');
    App.show('result');
  }

  let resultBack = null;
  let replay = null;

  function finish() {
    App.stopSpeaking();
    stopRecognition();
    hideFeedback();
    const ratio = total ? score / total : 0;
    const name = App.tutor().name;
    const lang = App.lang();
    let text;
    let title;

    window.Learn.bumpStat('games');
    window.Practice.awardXp(5 + score * 3, TITLES[type]);

    if (ctx.unit) {
      const C = window.COURSE;
      if (ctx.exam) {
        const passed = ratio >= C.PASS_RATIO;
        window.Learn.completeStep(lang, ctx.unit, 'exam', { ratio, passed });
        if (passed) window.Cert.checkNew();
        title = passed ? `🎉 Imtihondan o'tdingiz! ${total} dan ${score}` : `${total} dan ${score} — yana bir urinish`;
        const idx = C.UNITS.findIndex((u) => u.id === ctx.unit);
        const next = C.UNITS[idx + 1];
        text = passed
          ? next
            ? `${name}: Barakalla! Yangi bosqich ochildi: ${next.icon} ${next.title}.`
            : `${name}: Siz butun kursni tugatdingiz! Endi erkin suhbatda mashq qilamiz.`
          : `${name}: O'tish uchun ${Math.ceil(C.PASS_RATIO * total)} ta to'g'ri javob kerak. So'zlarni takrorlab, yana urinib ko'ring!`;
        if (passed) window.Practice.awardXp(20, "Bosqich imtihoni");
      } else {
        window.Learn.completeStep(lang, ctx.unit, type === 'speak' ? 'speak' : 'words');
      }
    } else if (ctx.prof) {
      window.Roles.markDone(ctx.prof, type === 'quiz' ? 'quiz' : 'words');
    } else {
      const key = App.bestKey();
      const best = App.loadStored(key) || {};
      const prev = best[type];
      const record = !prev || score / prev.total > prev.score / prev.total;
      if (record) {
        best[type] = { score, total };
        App.store(key, best);
      }
      if (record && prev) title = `🏆 Yangi rekord! ${total} dan ${score}`;
    }

    if (!text) {
      if (ratio >= 0.9) text = `${name}: Ajoyib natija! Siz haqiqiy yulduzsiz.`;
      else if (ratio >= 0.6) text = `${name}: Yaxshi! Yana bir-ikki mashq — va mukammal bo'ladi.`;
      else text = mode() === 'strict' ? `${name}: Hmm... Yana o'ynaymiz, men kutaman!` : `${name}: Hechqisi yo'q, takrorlash — o'rganishning onasi!`;
      text += " Xato qilgan so'zlaringiz takrorlash daftariga qo'shildi.";
    }

    const unit = ctx.unit;
    const again = { type, ctx: { ...ctx } };
    replay = () => start(again.type, again.ctx);
    const prof = ctx.prof;
    resultBack = unit
      ? () => window.Practice.openUnit(unit)
      : prof
        ? () => window.Roles.back({ prof })
        : () => App.openMenu();
    showResult({ score, total, title, text, unit: unit || prof });
  }

  $('gameBackBtn').addEventListener('click', () => {
    loadToken++;
    App.stopSpeaking();
    stopRecognition();
    hideFeedback();
    if (ctx.unit) window.Practice.openUnit(ctx.unit);
    else if (ctx.prof) window.Roles.back({ prof: ctx.prof });
    else App.openMenu();
  });
  $('replayBtn').addEventListener('click', () => replay && replay());
  $('resultMenuBtn').addEventListener('click', () => (resultBack ? resultBack() : App.openMenu()));

  // Hikoya tugagach natija oynasini ko'rsatish uchun.
  function showExternalResult(opts, onReplay, onBack) {
    replay = onReplay;
    resultBack = onBack;
    showResult(opts);
  }

  return { start, showResult: showExternalResult };
})();
