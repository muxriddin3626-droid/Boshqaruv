// Ikki mashq, ikkalasi ham AI'siz (bepul va limitga kirmaydi):
//  1) «Xatolarim» — o'quvchining o'z xatolaridan mashq: to'g'risini tanlash, gapni yig'ish, aytish.
//     Har xato 3 marta ketma-ket to'g'ri bajarilsa — «yengildi».
//  2) «Tinglab takrorlash» — o'z so'z va gaplarini tinglab, ovoz chiqarib takrorlash; har so'z baholanadi.
window.Drill = (() => {
  const App = window.App;
  const Learn = window.Learn;
  const $ = (id) => document.getElementById(id);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const MASTER = 3; // xato «yengilishi» uchun ketma-ket to'g'ri javoblar
  const SESSION = 8;

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

  const shuffle = (arr) => arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const say = (text, slow) => App.speak([{ lang: App.lang(), text, slow }]);
  const body = () => $('drillBody');
  const { words: splitWords, matchWords } = window.Games;
  const same = (a, b) => splitWords(a).join(' ') === splitWords(b).join(' ');

  function screen(title) {
    $('drillTitle').textContent = title;
    $('drillScore').textContent = '';
    body().textContent = '';
    window.scrollTo(0, 0);
    App.show('drill');
  }

  // ---------- Ovozni tanish (bitta urinish) ----------

  let rec = null;

  function stopListening() {
    if (rec) {
      rec.onend = null;
      try {
        rec.abort();
      } catch {}
      rec = null;
    }
  }

  // Mikrofon tugmasi: bosilganda tinglaydi, natijani onSaid(matn) ga beradi.
  function micButton(status, onSaid) {
    const mic = el('button', 'mic-btn');
    mic.type = 'button';
    mic.setAttribute('aria-label', 'Gapirish');
    mic.innerHTML =
      '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12z" fill="currentColor"/></svg>';
    if (!SR) {
      mic.disabled = true;
      status.textContent = "Bu brauzer ovozni tanimaydi — Chrome'da oching.";
      return mic;
    }
    mic.addEventListener('click', () => {
      if (rec) {
        rec.stop();
        return;
      }
      App.stopSpeaking();
      const r = new SR();
      rec = r;
      r.lang = App.locale();
      r.interimResults = true;
      let finalText = '';
      mic.classList.add('listening');
      status.textContent = 'Tinglayapman...';
      r.onresult = (e) => {
        let interim = '';
        finalText = '';
        for (const x of e.results) {
          if (x.isFinal) finalText += x[0].transcript;
          else interim += x[0].transcript;
        }
        status.textContent = (finalText + ' ' + interim).trim();
      };
      r.onerror = (e) => {
        if (e.error === 'not-allowed') status.textContent = 'Mikrofonga ruxsat berilmadi.';
      };
      r.onend = () => {
        rec = null;
        mic.classList.remove('listening');
        if (finalText.trim()) onSaid(finalText.trim());
        else if (status.textContent === 'Tinglayapman...') status.textContent = 'Eshitmadim — qaytadan bosib ayting.';
      };
      try {
        r.start();
      } catch {
        rec = null;
        mic.classList.remove('listening');
      }
    });
    return mic;
  }

  // Gapni so'zlarga bo'lib, aytilganiga qarab bo'yaydi.
  function paintPhrase(box, text, marks) {
    box.textContent = '';
    let w = 0;
    const tokens = text.split(/\s+/);
    tokens.forEach((tok, k) => {
      const span = el('span', 'sw', tok);
      const n = splitWords(tok).length;
      if (marks && n) span.classList.add(marks[w] ? 'ok' : 'miss');
      w += n;
      box.appendChild(span);
      if (k < tokens.length - 1) box.appendChild(document.createTextNode(' '));
    });
  }

  // =====================================================================
  // 1) Xatolarim ustida ishlash
  // =====================================================================

  const mKey = (lang) => `tu-mistake-drill-${lang}`;
  const mState = (lang) => App.loadStored(mKey(lang)) || {};
  const mId = (m) => splitWords(m.correct).join(' ');

  // Faol (hali yengilmagan) xatolar.
  function activeMistakes(lang = App.lang()) {
    const st = mState(lang);
    return Learn.mistakes(lang).filter((m) => m.correct && ((st[mId(m)] || {}).streak || 0) < MASTER);
  }

  function mistakeStats(lang = App.lang()) {
    const all = Learn.mistakes(lang).filter((m) => m.correct);
    const active = activeMistakes(lang).length;
    return { total: all.length, active, mastered: all.length - active };
  }

  function mark(lang, m, ok) {
    const st = mState(lang);
    const cur = st[mId(m)] || { streak: 0 };
    cur.streak = ok ? cur.streak + 1 : 0;
    cur.t = Date.now();
    st[mId(m)] = cur;
    App.store(mKey(lang), st);
    return cur.streak;
  }

  let ms = null; // sessiya

  function openMistakes() {
    stopListening();
    const lang = App.lang();
    const s = mistakeStats(lang);
    screen('🔁 Xatolarim');
    const b = body();
    const head = el('div', 'hg-intro');
    head.appendChild(el('h2', 'vc-goal', s.total ? `${s.active} ta xato ustida ishlash kerak` : "Hali xato yo'q"));
    if (s.total) {
      const bar = el('div', 'xp-bar');
      const fill = el('div', 'xp-fill');
      fill.style.width = `${Math.round((s.mastered / s.total) * 100)}%`;
      bar.appendChild(fill);
      head.append(bar, el('p', 'hint-left', `${s.mastered} / ${s.total} ta xato yengildi. Har xatoni ${MASTER} marta ketma-ket to'g'ri bajarsangiz — u yengilgan hisoblanadi.`));
    } else {
      head.appendChild(el('p', 'hint-left', "Ustoz bilan gaplashganingizda qilgan xatolaringiz dars hisobotidan shu yerga tushadi va siz ularni mashq qilib yengasiz."));
    }
    b.appendChild(head);
    const actions = el('div', 'hg-extra');
    if (s.active) actions.appendChild(button('primary big', `▶ Mashqni boshlash (${Math.min(SESSION, s.active)} ta xato)`, startMistakes));
    else if (s.total) actions.appendChild(el('p', 'hint-left', "🎉 Barcha xatolar yengildi! Yangi darslarda yangilari chiqsa, shu yerda paydo bo'ladi."));
    if (s.total) {
      actions.appendChild(button('secondary', "🧩 Shu xatolar bo'yicha yangi test (AI)", () => window.Games.start('quiz')));
    }
    actions.appendChild(button('secondary', "🎙️ Ustoz bilan gaplashish", () => App.startLesson()));
    b.appendChild(actions);

    if (s.total) {
      b.appendChild(el('h2', 'vc-h', 'Xatolar'));
      const list = el('div', 'vc-words');
      const st = mState(lang);
      for (const m of Learn.mistakes(lang).filter((x) => x.correct)) {
        const streak = Math.min(MASTER, (st[mId(m)] || {}).streak || 0);
        const row = button(`vc-word${streak >= MASTER ? ' mastered' : ''}`, '', () => say(m.correct));
        const top = el('span', 'vc-word-head');
        top.append(el('b', '', m.correct), el('span', 'dr-dots', '●'.repeat(streak) + '○'.repeat(MASTER - streak)));
        row.appendChild(top);
        if (m.wrong) row.appendChild(el('s', 'vc-ex-uz', m.wrong));
        if (m.explanation) row.appendChild(el('span', 'vc-ex-uz', m.explanation));
        list.appendChild(row);
      }
      b.appendChild(list);
    }
  }

  function startMistakes() {
    const lang = App.lang();
    const st = mState(lang);
    // Avval eng kam mashq qilinganlar.
    const items = activeMistakes(lang)
      .sort((a, c) => ((st[mId(a)] || {}).t || 0) - ((st[mId(c)] || {}).t || 0))
      .slice(0, SESSION);
    ms = { lang, items, i: 0, correct: 0, mastered: 0, all: Learn.mistakes(lang).filter((m) => m.correct) };
    nextMistake();
  }

  function nextMistake() {
    stopListening();
    if (ms.i >= ms.items.length) return finishMistakes();
    const m = ms.items[ms.i];
    const streak = (mState(ms.lang)[mId(m)] || {}).streak || 0;
    $('drillScore').textContent = `${ms.i + 1}/${ms.items.length}`;
    // Bosqich: 0 — to'g'risini tanlash, 1 — gapni yig'ish, 2 — aytish (mikrofon bo'lmasa yana yig'ish).
    const tokens = m.correct.split(/\s+/);
    const step = streak === 0 ? 'choose' : streak === 1 && tokens.length >= 3 ? 'build' : SR ? 'speak' : tokens.length >= 3 ? 'build' : 'choose';
    if (step === 'choose') stepChoose(m);
    else if (step === 'build') stepBuild(m, tokens);
    else stepSpeak(m);
  }

  function result(m, ok, note) {
    const streak = mark(ms.lang, m, ok);
    if (ok) ms.correct++;
    if (ok && streak >= MASTER) ms.mastered++;
    const b = body();
    const fb = el('div', `study-expl ${ok ? 'ok' : 'bad'}`);
    fb.appendChild(el('b', '', ok ? (streak >= MASTER ? '🏆 Bu xato yengildi!' : `✅ To'g'ri! (${streak}/${MASTER})`) : "❌ Hali emas — to'g'risi:"));
    fb.appendChild(el('p', 'dr-correct', m.correct));
    if (m.explanation) fb.appendChild(el('p', '', m.explanation));
    if (note) fb.appendChild(el('p', '', note));
    b.appendChild(fb);
    say(m.correct);
    // Xato qilingan bo'lsa, shu mashg'ulot oxirida yana bir marta chiqadi.
    if (!ok && !m.retried) {
      m.retried = true;
      ms.items.push(m);
    }
    ms.i++;
    b.appendChild(button('primary big', ms.i < ms.items.length ? 'Keyingi →' : 'Natija', nextMistake));
  }

  function stepChoose(m) {
    const b = body();
    b.textContent = '';
    b.appendChild(el('p', 'hint-left', "Qaysi biri to'g'ri?"));
    // Noto'g'ri variantlar: o'quvchining o'z xatosi + boshqa gaplar.
    const wrongs = [];
    if (m.wrong && !same(m.wrong, m.correct)) wrongs.push(m.wrong);
    for (const o of shuffle(ms.all)) {
      if (wrongs.length >= 2) break;
      if (!same(o.correct, m.correct) && o.wrong && !same(o.wrong, m.correct) && !wrongs.some((w) => same(w, o.wrong))) wrongs.push(o.wrong);
    }
    if (!wrongs.length) wrongs.push(m.correct.split(/\s+/).reverse().join(' '));
    if (m.explanation) b.appendChild(el('p', 'dr-hint', `💡 ${m.explanation}`));
    const grid = el('div', 'options no-tr');
    for (const opt of shuffle([m.correct, ...wrongs])) {
      grid.appendChild(
        button('option', opt, (e) => {
          if (grid.dataset.done) return;
          grid.dataset.done = '1';
          const ok = opt === m.correct;
          e.currentTarget.classList.add(ok ? 'correct' : 'wrong');
          grid.querySelectorAll('.option').forEach((o) => o.textContent === m.correct && o.classList.add('correct'));
          result(m, ok);
        })
      );
    }
    b.appendChild(grid);
  }

  function stepBuild(m, tokens) {
    const b = body();
    b.textContent = '';
    b.appendChild(el('p', 'hint-left', "So'zlarni to'g'ri tartibda tering:"));
    if (m.wrong) b.appendChild(el('p', 'dr-wrong', `❌ ${m.wrong}`));
    const answer = el('div', 'dr-answer no-tr');
    const pool = el('div', 'dr-pool no-tr');
    const placed = [];
    const check = button('primary big', 'Tekshirish', () => {
      check.hidden = true;
      pool.hidden = true;
      result(m, same(placed.map((t) => t.textContent).join(' '), m.correct));
    });
    check.disabled = true;
    shuffle(tokens).forEach((tok) => {
      const tile = button('dr-tile', tok, () => {
        if (check.hidden) return;
        if (tile.parentElement === pool) {
          answer.appendChild(tile);
          placed.push(tile);
        } else {
          pool.appendChild(tile);
          placed.splice(placed.indexOf(tile), 1);
        }
        check.disabled = placed.length !== tokens.length;
      });
      pool.appendChild(tile);
    });
    b.append(answer, pool, check);
  }

  function stepSpeak(m) {
    const b = body();
    b.textContent = '';
    b.appendChild(el('p', 'hint-left', "To'g'ri variantni ovoz chiqarib ayting:"));
    if (m.wrong) b.appendChild(el('p', 'dr-wrong', `❌ ${m.wrong}`));
    if (m.explanation) b.appendChild(el('p', 'dr-hint', `💡 ${m.explanation}`));
    const status = el('p', 'heard');
    const row = el('div', 'control-row');
    let tries = 0;
    const mic = micButton(status, (said) => {
      tries++;
      const marks = matchWords(m.correct, said);
      const ratio = marks.length ? marks.filter(Boolean).length / marks.length : 0;
      if (ratio >= 0.8 || tries >= 2) {
        row.hidden = true;
        result(m, ratio >= 0.8, `Siz aytdingiz: «${said}»`);
      } else {
        status.textContent = `«${said}» — yana bir urinib ko'ring.`;
      }
    });
    row.append(
      mic,
      button('round-btn', '⏭', () => {
        stopListening();
        row.hidden = true;
        result(m, false);
      })
    );
    b.append(row, status);
  }

  function finishMistakes() {
    Learn.bumpStat('mistakeDrills');
    window.dispatchEvent(new CustomEvent('tu:done', { detail: { kind: 'mistakes' } }));
    window.Practice.awardXp(5 + ms.correct * 2 + ms.mastered * 5, 'Xatolar ustida ishlash');
    const b = body();
    b.textContent = '';
    $('drillScore').textContent = '';
    const s = mistakeStats(ms.lang);
    const box = el('div', 'hg-quiz');
    box.append(el('div', 'hg-big', ms.mastered ? '🏆' : '💪'), el('h2', '', ms.mastered ? `${ms.mastered} ta xato yengildi!` : `${ms.correct} ta to'g'ri javob`));
    box.appendChild(el('p', 'hint-left', s.active ? `Yana ${s.active} ta xato qoldi. Har kuni ozgina — va ular qaytmaydi.` : "Barcha xatolar yengildi! Ustoz bilan yangi darsda o'zingizni sinab ko'ring."));
    const actions = el('div', 'end-actions');
    if (s.active) actions.appendChild(button('primary', '🔁 Yana mashq', startMistakes));
    actions.appendChild(button('secondary', '← Xatolar', openMistakes));
    box.appendChild(actions);
    b.appendChild(box);
  }

  // =====================================================================
  // 2) Tinglab takrorlash
  // =====================================================================

  // O'quvchining o'z materiali: xatolarning to'g'risi, lug'at misollari, grammatika misollari, daftar.
  function shadowSource(lang) {
    const out = new Map();
    const add = (text, tr) => {
      const t = String(text || '').trim();
      const n = splitWords(t).length;
      if (n >= 2 && n <= 12 && !out.has(t.toLowerCase())) out.set(t.toLowerCase(), { text: t, tr: tr || '' });
    };
    Learn.mistakes(lang).forEach((m) => add(m.correct, m.explanation));
    const vocab = App.loadStored(`tu-vocab-${lang}`) || {};
    Object.values(vocab).forEach((th) => (th.packs || []).forEach((p) => p.learned && p.words.forEach((w) => add(w.example, w.example_uz))));
    const grammar = App.loadStored(`tu-grammar-${lang}`) || {};
    Object.values(grammar).forEach((card) => (card.sections || []).forEach((s) => (s.examples || []).forEach((e) => add(e.text, e.uz))));
    Learn.deckList(lang).forEach((c) => add(c.word, c.translation));
    return [...out.values()];
  }

  let sh = null;

  function openShadow() {
    stopListening();
    const lang = App.lang();
    const pool = shadowSource(lang);
    screen('🎧 Tinglab takrorlash');
    const b = body();
    const head = el('div', 'hg-intro');
    head.appendChild(el('h2', 'vc-goal', 'Tinglang — takrorlang'));
    head.appendChild(
      el('p', 'hint-left', "Ustoz gapni aytadi, siz ovoz chiqarib takrorlaysiz. Har so'z baholanadi: yashil — to'g'ri, qizil — qayta ayting. Gaplar o'zingiz o'rgangan so'zlar, qoidalar va xatolaringizdan olinadi.")
    );
    b.appendChild(head);
    if (pool.length < 3) {
      b.appendChild(el('p', 'hint-left', "Hali yetarli gap yo'q. Avval lug'atdan bir to'plam yodlang, bosqich qoidasini o'qing yoki ustoz bilan bir dars o'ting — gaplar shu yerda paydo bo'ladi."));
      const a = el('div', 'hg-extra');
      a.append(button('primary big', "📚 Lug'atga o'tish", () => window.Vocab.open()), button('secondary', '🗣️ Talaffuz o\'yini (ustoz tuzadi)', () => window.Games.start('speak')));
      b.appendChild(a);
      return;
    }
    const a = el('div', 'hg-extra');
    a.append(
      button('primary big', `▶ Boshlash (${Math.min(SESSION, pool.length)} ta gap)`, () => startShadow(pool)),
      el('p', 'hint-left', `Jami ${pool.length} ta gap tayyor.${SR ? '' : " Bu brauzer ovozni tanimaydi — faqat tinglab, o'zingiz takrorlaysiz (Chrome'da baholanadi)."}`)
    );
    b.appendChild(a);
  }

  function startShadow(pool) {
    sh = { items: shuffle(pool).slice(0, SESSION), i: 0, scores: [], slow: false };
    nextShadow();
  }

  function nextShadow() {
    stopListening();
    if (sh.i >= sh.items.length) return finishShadow();
    const it = sh.items[sh.i];
    $('drillScore').textContent = `${sh.i + 1}/${sh.items.length}`;
    const b = body();
    b.textContent = '';
    b.appendChild(el('p', 'hint-left', 'Tinglang va ovoz chiqarib takrorlang:'));
    const phrase = el('p', 'speak-phrase');
    paintPhrase(phrase, it.text, null);
    b.appendChild(phrase);
    if (it.tr) b.appendChild(el('p', 'speak-tr', it.tr));
    const status = el('p', 'heard');
    const row = el('div', 'control-row');
    let tries = 0;
    let best = 0;
    const done = (score) => {
      sh.scores.push(score);
      sh.i++;
      row.hidden = true;
      b.appendChild(button('primary big', sh.i < sh.items.length ? 'Keyingi →' : 'Natija', nextShadow));
    };
    const mic = micButton(status, (said) => {
      tries++;
      const marks = matchWords(it.text, said);
      const ratio = marks.length ? marks.filter(Boolean).length / marks.length : 0;
      best = Math.max(best, ratio);
      paintPhrase(phrase, it.text, marks);
      const pct = Math.round(ratio * 100);
      if (ratio >= 0.85) {
        status.textContent = `${pct}% — ${ratio === 1 ? 'mukammal! 🎯' : 'juda yaxshi!'}`;
        done(best);
      } else if (tries >= 3) {
        status.textContent = `${pct}% — hechqisi yo'q, keyingisiga o'tamiz.`;
        done(best);
      } else {
        status.textContent = `${pct}% — qizil so'zlarga e'tibor bering va yana ayting (${tries}/3).`;
        say(it.text, true);
      }
    });
    row.append(
      button('round-btn', '🔊', () => say(it.text, false)),
      mic,
      button('round-btn', '🐢', () => say(it.text, true)),
      button('round-btn', '⏭', () => {
        stopListening();
        done(best);
      })
    );
    b.append(row, status, el('p', 'hint-left dr-legend', "🔊 oddiy tezlik · 🐢 sekin · ⏭ o'tkazib yuborish"));
    say(it.text, false);
  }

  function finishShadow() {
    const avg = sh.scores.length ? sh.scores.reduce((n, x) => n + x, 0) / sh.scores.length : 0;
    const perfect = sh.scores.filter((x) => x === 1).length;
    Learn.bumpStat('shadowDrills');
    if (perfect) Learn.bumpStat('perfectSpeak', perfect);
    window.dispatchEvent(new CustomEvent('tu:done', { detail: { kind: 'shadow' } }));
    window.Practice.awardXp(5 + Math.round(avg * sh.items.length * 2), 'Tinglab takrorlash');
    const b = body();
    b.textContent = '';
    $('drillScore').textContent = '';
    const box = el('div', 'hg-quiz');
    box.append(el('div', 'hg-big', avg >= 0.85 ? '🎯' : '🎧'), el('h2', '', `Talaffuz: ${Math.round(avg * 100)}%`));
    box.appendChild(el('p', 'hint-left', `${sh.items.length} ta gapdan ${perfect} tasi mukammal aytildi. Har kuni 5 daqiqa takrorlash — va nutqingiz ravon bo'ladi.`));
    const actions = el('div', 'end-actions');
    actions.append(button('primary', '🔁 Yana', openShadow), button('secondary', 'Menyu', () => App.openMenu()));
    box.appendChild(actions);
    b.appendChild(box);
  }

  // Menyu kartalari.
  function renderCards() {
    const s = mistakeStats();
    $('mistakesDesc').textContent = s.total
      ? s.active
        ? `${s.active} ta xato kutmoqda · ${s.mastered} tasi yengildi`
        : `Barcha ${s.total} ta xato yengildi 🎉`
      : 'Darsdagi xatolaringiz shu yerda mashq qilinadi';
    $('mistakesBadge').textContent = s.active;
    $('mistakesBadge').hidden = !s.active;
  }

  $('mistakesCard').addEventListener('click', openMistakes);
  $('shadowCard').addEventListener('click', openShadow);
  $('drillBack').addEventListener('click', () => {
    stopListening();
    App.stopSpeaking();
    App.openMenu();
  });

  return { openMistakes, openShadow, renderCards, mistakeStats };
})();
