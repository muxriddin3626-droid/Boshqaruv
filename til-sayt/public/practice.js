// Menyudagi qo'shimcha bo'limlar: kunlik maqsad va streak, kurs xaritasi,
// aqlli takrorlash, daftar, hikoyalar va eslatma.
window.Practice = (() => {
  const App = window.App;
  const Learn = window.Learn;
  const C = window.COURSE;
  const $ = (id) => document.getElementById(id);
  const WEEKDAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function button(cls, text, onClick) {
    const b = el('button', cls, text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- Bildirishnoma va XP ----------

  const toastEl = $('toast');
  let toastTimer = null;

  // Bitta bildirishnoma: yangisi eskisining o'rnini egallaydi (navbatga turmaydi).
  function toast(text, ms = 2200) {
    clearTimeout(toastTimer);
    toastEl.textContent = text;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      toastTimer = setTimeout(() => {
        toastEl.hidden = true;
      }, 250);
    }, ms);
  }

  function awardXp(amount, label) {
    if (amount <= 0) return;
    const r = Learn.addXp(amount);
    if (r.reachedNow) {
      const d = Learn.daily();
      toast(`+${Math.round(amount)} XP · 🎉 Kunlik maqsad bajarildi! 🔥 ${d.streak} kun`, 3500);
    } else {
      toast(`+${Math.round(amount)} XP${label ? ` · ${label}` : ''}`);
    }
  }

  // ---------- Menyu ----------

  function renderMenu() {
    const lang = App.lang();
    const d = Learn.daily();
    $('streak').textContent = `🔥 ${d.streak} kun`;
    $('streak').classList.toggle('cold', d.streak === 0);
    $('dailyXp').textContent = d.done ? `✅ Bugun ${d.today} / ${d.goal} XP` : `Bugun ${d.today} / ${d.goal} XP`;
    $('xpFill').style.width = `${Math.min(100, Math.round((d.today / d.goal) * 100))}%`;
    const week = $('week');
    week.textContent = '';
    for (const day of Learn.week()) {
      const dot = el('span', `day${day.done ? ' done' : ''}${day.today ? ' today' : ''}`);
      dot.appendChild(el('i', '', day.done ? '🔥' : day.xp > 0 ? '•' : ''));
      dot.appendChild(el('b', '', WEEKDAYS[day.day]));
      week.appendChild(dot);
    }

    const cur = Learn.currentUnit(lang);
    const doneCount = C.UNITS.filter((_, i) => Learn.unitStatus(lang, i) === 'done').length;
    const unit = C.UNITS[cur];
    $('courseNow').textContent =
      doneCount === C.UNITS.length ? "Kurs tugadi! 🎓 Takrorlashni davom eting" : `${cur + 1}-bosqich: ${unit.icon} ${unit.title} (${unit.level})`;
    $('courseCount').textContent = `${doneCount}/${C.UNITS.length}`;

    const stats = Learn.deckStats(lang);
    $('reviewDesc').textContent = stats.total
      ? stats.due
        ? `${stats.due} ta so'z takrorlash vaqti keldi`
        : `Hammasi takrorlangan ✅ · daftarda ${stats.total} ta so'z`
      : "Darslar va o'yinlardagi so'zlar shu yerga yig'iladi";
    $('dueBadge').hidden = !stats.due;
    $('dueBadge').textContent = stats.due;
  }

  // ---------- Kurs ----------

  function openCourse() {
    const lang = App.lang();
    const path = $('unitPath');
    path.textContent = '';
    const progress = Learn.courseProgress(lang);
    C.UNITS.forEach((u, i) => {
      const status = Learn.unitStatus(lang, i);
      const p = progress[u.id] || {};
      const steps = ['lesson', 'words', 'speak', 'exam'].filter((s) => p[s]).length;
      const li = el('li', `unit-node ${status}`);
      const b = button('unit-btn', '', () => status !== 'locked' && openUnit(u.id));
      b.disabled = status === 'locked';
      b.appendChild(el('span', 'unit-badge', status === 'done' ? '✅' : status === 'locked' ? '🔒' : u.icon));
      const t = el('span', 'act-text');
      t.appendChild(el('span', 'act-title', `${i + 1}. ${u.title}`));
      t.appendChild(el('span', 'act-desc', status === 'locked' ? `${u.level} · oldingi bosqich imtihonidan o'ting` : `${u.level} · ${steps}/4 qadam`));
      b.appendChild(t);
      li.appendChild(b);
      path.appendChild(li);
    });
    App.show('course');
    const current = path.querySelector('.unit-node.open');
    if (current) current.scrollIntoView({ block: 'center' });
  }

  function openUnit(id) {
    const lang = App.lang();
    const u = C.byId(id);
    const p = Learn.courseProgress(lang)[id] || {};
    $('unitLevel').textContent = `${u.level} · ${C.UNITS.indexOf(u) + 1}-bosqich`;
    $('unitIcon').textContent = u.icon;
    $('unitTitle').textContent = u.title;
    $('unitGrammar').textContent = `Grammatika: ${u.grammar[lang]}`;
    document.querySelectorAll('#unitScreen .step').forEach((s) => {
      s.classList.toggle('done', Boolean(p[s.dataset.step]));
      s.dataset.unit = id;
    });
    $('examDesc').textContent = p.exam
      ? `O'tilgan ✅ (eng yaxshi natija: ${Math.round((p.examBest || 0) * 100)}%)`
      : `O'tish uchun ${Math.round(C.PASS_RATIO * 100)}% to'g'ri javob kerak` +
        (p.examBest ? ` · eng yaxshisi: ${Math.round(p.examBest * 100)}%` : '');
    App.show('unit');
  }

  document.querySelectorAll('#unitScreen .step').forEach((s) => {
    s.addEventListener('click', () => {
      const unit = s.dataset.unit;
      const step = s.dataset.step;
      if (step === 'lesson') App.startLesson({ unit });
      else if (step === 'words') window.Games.start('match', { unit });
      else if (step === 'speak') window.Games.start('speak', { unit });
      else window.Games.start('quiz', { unit, exam: true });
    });
  });

  $('courseCard').addEventListener('click', openCourse);

  // ---------- Aqlli takrorlash ----------

  let queue = [];
  let card = null;
  let known = 0;
  let reviewed = 0;
  let requeued = {};

  function startReview() {
    queue = Learn.dueCards(App.lang(), 20);
    known = 0;
    reviewed = 0;
    requeued = {};
    if (!queue.length) {
      const stats = Learn.deckStats(App.lang());
      window.Games.showResult(
        {
          score: 1,
          total: 1,
          title: stats.total ? 'Hozircha takrorlash yo\'q ✅' : "Daftaringiz hali bo'sh",
          text: stats.total
            ? `Daftaringizda ${stats.total} ta so'z, ${stats.learned} tasi yaxshi yodlangan. Keyingi takrorlash vaqti kelganda shu yerda chiqadi.`
            : "Ovozli dars, o'yinlar va hikoyalardagi yangi so'zlar va xatolaringiz shu yerga yig'iladi.",
        },
        startReview,
        () => App.openMenu()
      );
      return;
    }
    App.unlockAudio();
    App.show('review');
    nextCard();
  }

  function nextCard() {
    card = queue.shift();
    if (!card) {
      finishReview();
      return;
    }
    const total = reviewed + queue.length + 1;
    $('reviewLeft').textContent = `${queue.length + 1} ta qoldi`;
    $('reviewProgress').style.width = `${Math.round((reviewed / total) * 100)}%`;
    const mistake = card.kind === 'mistake';
    $('fcHint').textContent = mistake ? "To'g'ri qanday aytiladi?" : 'Tarjimasini eslang:';
    $('fcFront').textContent = mistake ? (card.wrong ? `❌ ${card.wrong}` : card.translation) : card.word;
    $('fcBack').textContent = mistake ? `✅ ${card.word}\n${card.translation}` : card.translation;
    $('fcBack').hidden = true;
    $('fcSay').hidden = mistake;
    $('revealBtn').hidden = false;
    $('gradeRow').hidden = true;
    if (!mistake) App.speak([{ lang: App.lang(), text: card.word }]);
  }

  $('fcSay').addEventListener('click', () => card && App.speak([{ lang: App.lang(), text: card.word }]));

  $('revealBtn').addEventListener('click', () => {
    $('fcBack').hidden = false;
    $('fcSay').hidden = false;
    $('revealBtn').hidden = true;
    $('gradeRow').hidden = false;
    if (card.kind === 'mistake') App.speak([{ lang: App.lang(), text: card.word }]);
  });

  function gradeCard(ok) {
    App.stopSpeaking();
    Learn.grade(App.lang(), card.key, ok);
    reviewed++;
    // Faqat birinchi ko'rishda bilgan so'zlar hisoblanadi.
    if (ok && !requeued[card.key]) known++;
    // Bilmagan so'z shu mashg'ulotning oxirida yana bir marta chiqadi.
    if (!ok && !requeued[card.key]) {
      requeued[card.key] = 1;
      queue.push(card);
    }
    nextCard();
  }

  $('gradeGood').addEventListener('click', () => gradeCard(true));
  $('gradeBad').addEventListener('click', () => gradeCard(false));

  function finishReview() {
    const total = reviewed - Object.keys(requeued).length;
    awardXp(2 + known, 'Takrorlash');
    const stats = Learn.deckStats(App.lang());
    window.Games.showResult(
      {
        score: known,
        total,
        title: `${total} ta so'zdan ${known} tasini bildingiz`,
        text: `${App.tutor().name}: Zo'r! Bilgan so'zlaringiz endi kamroq, bilmaganlaringiz tez-tez chiqadi. Daftarda ${stats.total} ta so'z, ${stats.learned} tasi yodlangan.`,
      },
      startReview,
      () => App.openMenu()
    );
  }

  $('reviewCard').addEventListener('click', startReview);

  // ---------- Daftar ----------

  let tab = 'words';

  function openNotebook() {
    renderNotebook();
    App.show('notebook');
  }

  function renderNotebook() {
    const lang = App.lang();
    document.querySelectorAll('#notebookScreen .pill').forEach((p) => p.classList.toggle('active', p.dataset.tab === tab));
    const list = $('noteList');
    list.textContent = '';
    if (tab === 'words') {
      const cards = Learn.deckList(lang).filter((c) => c.kind === 'word');
      const stats = Learn.deckStats(lang);
      $('notebookStats').textContent = cards.length
        ? `${stats.total} ta yozuv · ${stats.learned} tasi yodlangan · ${stats.due} tasi takrorlashni kutyapti`
        : "Hali so'z yo'q. Darslar, o'yinlar va hikoyalardan so'zlar shu yerga tushadi.";
      for (const c of cards) {
        const li = el('li', 'note');
        const text = el('div', 'note-text');
        text.appendChild(el('b', '', c.word));
        text.appendChild(el('span', '', c.translation));
        const level = el('span', 'level-dots', '●'.repeat(Math.min(c.level, 6)) + '○'.repeat(Math.max(0, 6 - c.level)));
        level.title = `${c.level}/6`;
        li.append(
          button('icon-btn', '🔊', () => App.speak([{ lang, text: c.word }])),
          text,
          level,
          button('icon-btn del', '✕', () => {
            Learn.removeWord(lang, c.key);
            renderNotebook();
          })
        );
        list.appendChild(li);
      }
    } else {
      const notes = Learn.mistakes(lang);
      $('notebookStats').textContent = notes.length
        ? `Ustoz shu xatolarni eslaydi va darslarda qayta mashq qildiradi.`
        : "Hali xato yozilmagan. Ovozli dars oxiridagi hisobotdan xatolar shu yerga tushadi.";
      for (const n of notes) {
        const li = el('li', 'note mistake-note');
        const text = el('div', 'note-text');
        if (n.wrong) text.appendChild(el('s', 'wrong', n.wrong));
        text.appendChild(el('b', 'correct', n.correct));
        if (n.explanation) text.appendChild(el('span', '', n.explanation));
        li.append(button('icon-btn', '🔊', () => App.speak([{ lang, text: n.correct }])), text);
        list.appendChild(li);
      }
    }
  }

  document.querySelectorAll('#notebookScreen .pill').forEach((p) => {
    p.addEventListener('click', () => {
      tab = p.dataset.tab;
      renderNotebook();
    });
  });

  $('notebookBtn').addEventListener('click', openNotebook);

  // ---------- Hikoya ----------

  const storyBody = $('storyBody');
  let story = null;
  let storyToken = 0;
  let popup = null;

  const norm = (s) => Learn.norm(s).replace(/ё/g, 'е');

  function closePopup() {
    if (popup) popup.remove();
    popup = null;
  }

  function showPopup(anchor, title, text, onAdd) {
    closePopup();
    popup = el('div', 'word-popup');
    popup.appendChild(el('b', '', title));
    popup.appendChild(el('span', '', text));
    if (onAdd) {
      const add = button('chip', "➕ Daftarga qo'shish", () => {
        onAdd();
        add.textContent = "✅ Qo'shildi";
        add.disabled = true;
      });
      popup.appendChild(add);
    }
    anchor.after(popup);
  }

  async function startStory() {
    const token = ++storyToken;
    App.unlockAudio();
    closePopup();
    storyBody.textContent = '';
    storyBody.appendChild(el('p', 'loading', `${App.tutor().name} hikoya yozyapti...`));
    App.show('story');
    try {
      story = await App.postJson('/api/game', {
        lang: App.lang(),
        type: 'story',
        settings: App.settings(),
        focus: App.focus(),
      });
    } catch (err) {
      if (token !== storyToken) return;
      storyBody.textContent = '';
      storyBody.appendChild(el('p', 'loading', err instanceof TypeError ? "Internet bilan aloqa yo'q." : err.message));
      storyBody.appendChild(button('primary', 'Qayta urinish', startStory));
      return;
    }
    if (token !== storyToken) return;
    renderStory();
  }

  function renderStory() {
    const lang = App.lang();
    storyBody.textContent = '';
    storyBody.appendChild(el('h1', 'story-title', story.title));
    storyBody.appendChild(el('p', 'lead small', `${story.title_uz} · so'zni bosing — tarjimasi chiqadi`));

    story.sentences.forEach((sent, si) => {
      const p = el('p', 'st-sent');
      p.dataset.index = si;
      const num = button('st-num', String(si + 1), () => {
        const tr = p.querySelector('.st-tr');
        tr.hidden = !tr.hidden;
      });
      num.title = 'Tarjimasi';
      p.appendChild(num);
      const glossary = sent.words.map((w) => ({ ...w, key: norm(w.form) }));
      sent.text.split(/\s+/).forEach((tok) => {
        const w = button('st-word', tok, () => {
          const key = norm(tok);
          const hit = glossary.find((g) => g.key === key) || glossary.find((g) => key && g.key.split(' ').includes(key));
          App.speak([{ lang, text: tok.replace(/[.,!?;:«»"„“”]/g, '') }]);
          if (hit) {
            showPopup(p, `${hit.form}${hit.base && norm(hit.base) !== hit.key ? ` (${hit.base})` : ''}`, hit.translation, () =>
              Learn.addWord(lang, hit.base || hit.form, hit.translation)
            );
          } else {
            showPopup(p, 'Gap tarjimasi', sent.translation);
          }
        });
        p.appendChild(w);
        p.appendChild(document.createTextNode(' '));
      });
      const tr = el('span', 'st-tr', sent.translation);
      tr.hidden = true;
      p.appendChild(tr);
      storyBody.appendChild(p);
    });

    if (story.questions.length) {
      storyBody.appendChild(el('h2', 'section-title', 'Tushundingizmi?'));
      let answered = 0;
      let correct = 0;
      const finishBtn = button('primary big', 'Tugatish', () => finishStory(correct, story.questions.length));
      finishBtn.disabled = true;
      story.questions.forEach((q) => {
        storyBody.appendChild(el('p', 'question small-q', q.question));
        const wrap = el('div', 'options');
        const buttons = shuffle([q.correct, ...q.wrong]).map((opt) => {
          const b = button('option', opt, () => {
            buttons.forEach((x) => {
              x.disabled = true;
              if (x.textContent === q.correct) x.classList.add('correct');
            });
            if (opt === q.correct) correct++;
            else b.classList.add('wrong');
            answered++;
            if (answered === story.questions.length) finishBtn.disabled = false;
          });
          wrap.appendChild(b);
          return b;
        });
        storyBody.appendChild(wrap);
      });
      storyBody.appendChild(finishBtn);
    } else {
      storyBody.appendChild(button('primary big', 'Tugatish', () => finishStory(0, 0)));
    }
  }

  async function playStory() {
    if (!story) return;
    const lang = App.lang();
    const token = ++storyToken;
    const sentences = storyBody.querySelectorAll('.st-sent');
    for (let i = 0; i < story.sentences.length; i++) {
      if (token !== storyToken) break;
      sentences.forEach((s) => s.classList.toggle('reading', Number(s.dataset.index) === i));
      sentences[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
      const finished = await App.speak([{ lang, text: story.sentences[i].text }]);
      if (!finished) break;
    }
    sentences.forEach((s) => s.classList.remove('reading'));
  }

  $('storyPlayBtn').addEventListener('click', playStory);
  storyBody.addEventListener('click', (e) => {
    if (!e.target.closest('.st-word, .word-popup')) closePopup();
  });

  function finishStory(correct, total) {
    storyToken++;
    App.stopSpeaking();
    awardXp(10 + correct * 5, 'Hikoya');
    const key = App.bestKey();
    const best = App.loadStored(key) || {};
    if (total && (!best.story || correct / total > best.story.score / best.story.total)) {
      best.story = { score: correct, total };
      App.store(key, best);
    }
    const name = App.tutor().name;
    window.Games.showResult(
      {
        score: total ? correct : 1,
        total: total || 1,
        title: total ? `${total} ta savoldan ${correct} tasiga to'g'ri javob` : 'Hikoya o\'qildi!',
        text: `${name}: Ofarin! Har kuni bitta hikoya — va tez orada kitob o'qiysiz. Bosgan so'zlaringizni daftarga qo'shishni unutmang.`,
      },
      startStory,
      () => App.openMenu()
    );
  }

  // ---------- Eslatma ----------

  const dialog = $('reminderDialog');
  $('reminderBtn').addEventListener('click', () => {
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
  });

  $('reminderSave').addEventListener('click', () => {
    const time = $('reminderTime').value || '20:00';
    const ics = Learn.reminderIcs(time, location.origin);
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'til-ustoz-eslatma.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    dialog.close ? dialog.close() : dialog.removeAttribute('open');
    toast(`⏰ Faylni oching — har kuni soat ${time} da eslatma bo'ladi`, 3500);
  });

  // ---------- Orqaga tugmalari ----------

  document.querySelectorAll('[data-back]').forEach((b) => {
    b.addEventListener('click', () => {
      storyToken++;
      closePopup();
      App.stopSpeaking();
      if (b.dataset.back === 'course') openCourse();
      else App.openMenu();
    });
  });

  return { renderMenu, awardXp, openUnit, openCourse, startStory, toast };
})();
