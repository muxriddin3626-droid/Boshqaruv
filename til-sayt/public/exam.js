// Sinov imtihoni: Goethe / ТРКИ formatidagi bo'limlar, vaqt cheklovi va baholash.
window.Exam = (() => {
  const App = window.App;
  const E = window.EXAMS;
  const $ = (id) => document.getElementById(id);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const MAX_PLAYS = 2; // tinglash matnini necha marta eshitish mumkin (haqiqiy imtihondagidek)

  // Bo'lim natijasiga qarab tavsiya qilinadigan mashq.
  const PRACTICE = {
    grammar: { label: '📝 Test', run: () => window.Games.start('quiz') },
    reading: { label: '📖 Hikoya', run: () => window.Practice.startStory() },
    listening: { label: '🎧 Eshitib top', run: () => window.Games.start('listen') },
    writing: { label: "✍️ Yozish bo'limini qayta ishlash", run: null },
    history: { label: "📜 Tarix bo'limini mashq qilish", run: null },
    law: { label: "⚖️ Qonunchilik bo'limini mashq qilish", run: null },
    speaking: { label: '🎙️ Ovozli dars', run: () => App.startLesson() },
  };

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

  const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const historyKey = () => `tu-exams-${App.lang()}`;

  // ---------- Imtihonlar ro'yxati ----------

  function openList() {
    const list = $('examList');
    list.textContent = '';
    const history = App.loadStored(historyKey()) || [];
    for (const exam of E.EXAMS[App.lang()]) {
      const card = el('section', 'exam-item');
      card.appendChild(el('h2', '', exam.name));
      card.appendChild(el('p', 'act-desc', exam.about));
      if (exam.note) card.appendChild(el('p', 'disclaimer left', `⚠️ ${exam.note}`));
      const total = exam.sections.reduce((n, s) => n + s.minutes, 0);
      const chips = el('div', 'chips');
      for (const s of exam.sections) {
        const info = E.SECTION_INFO[s.id];
        chips.appendChild(button('chip', `${info.icon} ${info.title} · ${s.minutes} daq`, () => start(exam, [s.id])));
      }
      card.appendChild(button('primary big', `To'liq sinov · ${total} daqiqa`, () => start(exam)));
      card.appendChild(el('p', 'hint-left', "Yoki bitta bo'limni mashq qiling (har savoldan keyin o'zbekcha izoh bilan):"));
      card.appendChild(chips);
      const tries = history.filter((h) => h.exam === exam.id && h.full).slice(0, 3);
      if (tries.length) {
        const ul = el('ul', 'tries');
        for (const t of tries) {
          ul.appendChild(
            el('li', t.passed ? 'pass' : 'fail', `${new Date(t.date).toLocaleDateString('ru-RU')} — ${t.total}% ${t.passed ? "✅ o'tdi" : "❌ o'tmadi"}`)
          );
        }
        card.appendChild(el('p', 'hint-left', 'Oxirgi urinishlar:'));
        card.appendChild(ul);
      }
      list.appendChild(card);
    }
    App.show('examList');
  }

  // ---------- Imtihon jarayoni ----------

  let exam = null;
  let sections = [];
  let full = false;
  let idx = 0;
  let results = [];
  let cache = {};
  let timerId = null;
  let deadline = 0;
  let submitCurrent = null;
  let runToken = 0;

  function fetchSection(id) {
    if (!cache[id]) {
      cache[id] = App.postJson('/api/exam/section', { lang: App.lang(), exam: exam.id, section: id });
      cache[id].catch(() => delete cache[id]);
    }
    return cache[id];
  }

  function start(nextExam, only) {
    exam = nextExam;
    full = !only;
    sections = exam.sections.filter((s) => !only || only.includes(s.id));
    idx = 0;
    results = [];
    cache = {};
    runToken++;
    App.unlockAudio();
    runSection();
  }

  function renderSteps() {
    const steps = $('examSteps');
    steps.textContent = '';
    sections.forEach((s, i) => {
      const info = E.SECTION_INFO[s.id];
      steps.appendChild(el('span', `exam-step${i < idx ? ' done' : i === idx ? ' now' : ''}`, `${info.icon} ${info.title}`));
    });
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function startTimer(minutes) {
    stopTimer();
    deadline = Date.now() + minutes * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      $('examTimer').textContent = `⏱ ${fmt(left)}`;
      $('examTimer').classList.toggle('low', left <= 60);
      if (left === 0) {
        stopTimer();
        App.stopSpeaking();
        window.Practice.toast("⏰ Vaqt tugadi — bo'lim yakunlandi");
        if (submitCurrent) submitCurrent();
      }
    };
    tick();
    timerId = setInterval(tick, 500);
  }

  async function runSection() {
    const token = ++runToken;
    const section = sections[idx];
    const info = E.SECTION_INFO[section.id];
    submitCurrent = null;
    stopTimer();
    $('examSectionTitle').textContent = `${info.icon} ${info.title}`;
    $('examTimer').textContent = `⏱ ${fmt(section.minutes * 60)}`;
    $('examSubmitBtn').hidden = true;
    renderSteps();
    const body = $('examBody');
    body.textContent = '';
    body.appendChild(el('p', 'loading', `${App.tutor().name} ${info.title.toLowerCase()} bo'limini tayyorlayapti...`));
    App.show('exam');

    let content;
    try {
      content = await fetchSection(section.id);
    } catch (err) {
      if (token !== runToken) return;
      body.textContent = '';
      body.appendChild(el('p', 'loading', err instanceof TypeError ? "Internet bilan aloqa yo'q." : err.message));
      body.appendChild(button('primary', 'Qayta urinish', runSection));
      return;
    }
    if (token !== runToken) return;
    // Keyingi bo'limni oldindan tayyorlab qo'yamiz.
    if (sections[idx + 1]) fetchSection(sections[idx + 1].id).catch(() => {});

    body.textContent = '';
    if (content.instructions_uz) body.appendChild(el('p', 'exam-instr', `ℹ️ ${content.instructions_uz}`));
    if (info.kind === 'choice') renderChoice(section, content, body);
    else if (info.kind === 'writing') renderWriting(section, content, body);
    else renderSpeaking(section, content, body);
    $('examSubmitBtn').hidden = false;
    startTimer(section.minutes);
  }

  // Test ko'rinishidagi bo'limlar: grammatika, o'qish, tinglash.
  function renderChoice(section, content, body) {
    const answers = [];
    const listening = section.id === 'listening';
    let n = 0;
    content.passages.forEach((p, pi) => {
      const box = el('section', 'passage');
      if (p.title) box.appendChild(el('h3', '', listening ? `${pi + 1}. ${p.title}` : p.title));
      if (listening) {
        let plays = 0;
        const play = button('play-btn small', `🔊 Eshitish (${MAX_PLAYS})`, async () => {
          if (plays >= MAX_PLAYS) return;
          plays++;
          play.disabled = true;
          await App.speak([{ lang: App.lang(), text: p.text }]);
          play.textContent = plays >= MAX_PLAYS ? '🔇 Eshitib bo\'lindi' : `🔊 Yana eshitish (${MAX_PLAYS - plays})`;
          play.disabled = plays >= MAX_PLAYS;
        });
        box.appendChild(play);
      } else if (p.text) {
        box.appendChild(el('div', 'passage-text', p.text));
      }
      for (const q of p.questions) {
        n++;
        const qi = answers.length;
        answers.push({ q, chosen: null });
        box.appendChild(el('p', 'exam-q', `${n}. ${q.question}`));
        const opts = el('div', 'options compact');
        const why = el('p', 'exam-why');
        why.hidden = true;
        const buttons = shuffle([q.correct, ...q.wrong]).map((opt) =>
          button('option', opt, (e) => {
            answers[qi].chosen = opt;
            if (full) {
              // To'liq sinovda javobni o'zgartirish mumkin, natija oxirida chiqadi.
              buttons.forEach((b) => b.classList.toggle('chosen', b === e.currentTarget));
              return;
            }
            // Mashq rejimi: darhol to'g'ri javob va o'zbekcha izoh.
            buttons.forEach((b) => {
              b.disabled = true;
              if (b.textContent === q.correct) b.classList.add('correct');
            });
            if (opt !== q.correct) e.currentTarget.classList.add('wrong');
            why.textContent = `${opt === q.correct ? '✅' : `❌ To'g'risi: ${q.correct}.`} ${q.explanation || ''}`;
            why.hidden = false;
          })
        );
        buttons.forEach((b) => opts.appendChild(b));
        box.append(opts, why);
      }
      body.appendChild(box);
    });

    submitCurrent = () => {
      const mistakes = answers.filter((a) => a.chosen !== a.q.correct);
      const score = Math.round(((answers.length - mistakes.length) / answers.length) * 100);
      finishSection({
        score,
        correct: answers.length - mistakes.length,
        count: answers.length,
        mistakes: mistakes.map((a) => ({ question: a.q.question, chosen: a.chosen, correct: a.q.correct, explanation: a.q.explanation })),
      });
    };
  }

  const countWords = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

  function renderWriting(section, content, body) {
    const task = el('div', 'passage');
    task.appendChild(el('div', 'passage-text', content.task));
    const tr = el('p', 'speak-tr', content.task_uz);
    tr.hidden = true;
    task.appendChild(button('link-btn', "🇺🇿 Tarjimasini ko'rsatish", () => (tr.hidden = !tr.hidden)));
    task.appendChild(tr);
    if (content.points.length) {
      const ul = el('ul', 'points');
      content.points.forEach((pt) => ul.appendChild(el('li', '', pt)));
      task.appendChild(el('p', 'exam-q', 'Javobingizda albatta bo\'lsin:'));
      task.appendChild(ul);
    }
    body.appendChild(task);
    const area = el('textarea', 'exam-text');
    area.rows = 8;
    area.placeholder = 'Shu yerga yozing...';
    const counter = el('p', 'hint-left', `0 / ${content.min_words} so'z`);
    area.addEventListener('input', () => {
      const n = countWords(area.value);
      counter.textContent = `${n} / ${content.min_words} so'z`;
      counter.classList.toggle('enough', n >= content.min_words);
    });
    body.append(area, counter);
    area.focus();
    submitCurrent = () => gradeAndFinish(section, content, area.value);
  }

  function renderSpeaking(section, content, body) {
    const areas = [];
    let active = null;

    const stopRec = () => {
      if (active) {
        active.rec.onend = null;
        try { active.rec.stop(); } catch {}
        active.mic.classList.remove('listening');
        active = null;
      }
    };

    content.tasks.forEach((t, i) => {
      const box = el('section', 'passage');
      box.appendChild(el('p', 'exam-q', `${i + 1}. ${t.prompt}`));
      box.appendChild(el('p', 'speak-tr', t.prompt_uz));
      const area = el('textarea', 'exam-text');
      area.rows = 3;
      area.placeholder = SR ? "🎤 ni bosib gapiring — aytganingiz shu yerda yoziladi" : "Bu brauzer ovozni tanimaydi — javobingizni yozing";
      const row = el('div', 'control-row');
      row.appendChild(button('round-btn', '🔊', () => App.speak([{ lang: App.lang(), text: t.prompt }])));
      const mic = el('button', 'mic-btn small');
      mic.type = 'button';
      mic.setAttribute('aria-label', 'Gapirish');
      mic.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12z" fill="currentColor"/></svg>';
      mic.disabled = !SR;
      mic.addEventListener('click', () => {
        if (active && active.mic === mic) {
          stopRec();
          return;
        }
        stopRec();
        App.stopSpeaking();
        const rec = new SR();
        rec.lang = App.locale();
        rec.continuous = true;
        rec.interimResults = true;
        const base = area.value ? area.value.trim() + ' ' : '';
        rec.onresult = (e) => {
          let text = '';
          for (const r of e.results) text += r[0].transcript;
          area.value = (base + text).trim();
        };
        rec.onend = () => {
          mic.classList.remove('listening');
          if (active && active.rec === rec) active = null;
        };
        active = { rec, mic };
        mic.classList.add('listening');
        try {
          rec.start();
        } catch {
          stopRec();
        }
      });
      row.appendChild(mic);
      box.append(row, area);
      areas.push(area);
      body.appendChild(box);
    });

    submitCurrent = () => {
      stopRec();
      gradeAndFinish(section, content, areas.map((a) => a.value));
    };
  }

  async function gradeAndFinish(section, content, answer) {
    const token = runToken;
    stopTimer();
    submitCurrent = null;
    $('examSubmitBtn').hidden = true;
    const body = $('examBody');
    body.textContent = '';
    body.appendChild(el('p', 'loading', `${App.tutor().name} javobingizni baholayapti...`));
    try {
      const g = await App.postJson('/api/exam/grade', {
        lang: App.lang(),
        exam: exam.id,
        section: section.id,
        task: content,
        answer,
      });
      if (token !== runToken) return;
      finishSection({ score: g.score, grade: g });
    } catch (err) {
      if (token !== runToken) return;
      body.textContent = '';
      body.appendChild(el('p', 'loading', err instanceof TypeError ? "Internet bilan aloqa yo'q." : err.message));
      body.appendChild(button('primary', 'Qayta baholash', () => gradeAndFinish(section, content, answer)));
    }
  }

  function finishSection(result) {
    stopTimer();
    submitCurrent = null;
    App.stopSpeaking();
    results.push({ id: sections[idx].id, ...result });
    idx++;
    if (idx < sections.length) runSection();
    else showResults();
  }

  $('examSubmitBtn').addEventListener('click', () => {
    if (!submitCurrent) return;
    const left = Math.round((deadline - Date.now()) / 1000);
    if (left > 30 && !confirm("Bo'limni yakunlaysizmi? Javoblarni keyin o'zgartirib bo'lmaydi.")) return;
    submitCurrent();
  });

  $('examQuitBtn').addEventListener('click', () => {
    if (!confirm("Imtihonni to'xtatasizmi? Natija saqlanmaydi.")) return;
    runToken++;
    stopTimer();
    submitCurrent = null;
    App.stopSpeaking();
    openList();
  });

  // ---------- Natija ----------

  function showResults() {
    const total = Math.round(results.reduce((n, r) => n + r.score, 0) / results.length);
    const passLine = Math.round(exam.pass * 100);
    // Ba'zi bo'limlardan alohida eng kam ball talab qilinadi (masalan, patentda tinglash va gapirish).
    const required = exam.required || {};
    const failedRequired = results.filter((r) => required[r.id] && r.score < required[r.id] * 100);
    const passed =
      (exam.rule === 'each' ? results.every((r) => r.score >= passLine) : total >= passLine) && !failedRequired.length;
    const weakest = results.slice().sort((a, b) => a.score - b.score)[0];
    const name = App.tutor().name;

    $('examResultName').textContent = full ? exam.name : `${exam.name} — ${E.SECTION_INFO[results[0].id].title}`;
    $('examResultTitle').textContent = `${total}%`;
    let verdict;
    if (!full) verdict = total >= passLine ? `✅ O'tish chegarasidan (${passLine}%) yuqori` : `O'tish chegarasi — ${passLine}%. Yana mashq qilamiz!`;
    else if (passed && total >= passLine + 15) verdict = "🟢 Haqiqiy imtihondan o'tish ehtimoli: YUQORI";
    else if (passed) verdict = "🟡 Haqiqiy imtihondan o'tish ehtimoli: O'RTACHA — chegaraga yaqin, yana bir-ikki sinov qiling";
    else verdict = "🔴 Haqiqiy imtihondan o'tish ehtimoli: HOZIRCHA PAST — tayyorgarlikni davom ettiramiz";
    if (full && exam.rule === 'each' && !passed && total >= passLine) {
      verdict += `. Eslatma: bu imtihonda HAR bir bo'limdan ${passLine}% kerak.`;
    }
    if (full && failedRequired.length) {
      const names = failedRequired.map((r) => E.SECTION_INFO[r.id].title.toLowerCase()).join(' va ');
      verdict += `. ${names[0].toUpperCase()}${names.slice(1)} bo'limidan kamida ${Math.round(required[failedRequired[0].id] * 100)}% kerak.`;
    }
    $('examVerdict').textContent = verdict;
    $('examVerdict').className = `verdict ${passed || (!full && total >= passLine) ? 'pass' : 'fail'}`;

    const scores = $('sectionScores');
    scores.textContent = '';
    for (const r of results) {
      const info = E.SECTION_INFO[r.id];
      const row = el('div', 'score-row');
      row.appendChild(el('span', 'score-name', `${info.icon} ${info.title}`));
      const bar = el('div', 'score-bar');
      const fill = el('div', `score-fill ${r.score >= passLine ? 'pass' : 'fail'}`);
      fill.style.width = `${r.score}%`;
      bar.appendChild(fill);
      bar.appendChild(el('i', 'pass-line'));
      bar.lastChild.style.left = `${passLine}%`;
      row.appendChild(bar);
      row.appendChild(el('b', '', r.count ? `${r.correct}/${r.count}` : `${r.score}%`));
      scores.appendChild(row);
    }

    const fb = $('examFeedback');
    fb.textContent = '';
    for (const r of results) {
      const info = E.SECTION_INFO[r.id];
      const d = el('details', 'feedback-block');
      d.appendChild(el('summary', '', `${info.icon} ${info.title}: ${r.score}%`));
      if (r.grade) {
        d.appendChild(el('p', '', r.grade.feedback));
        if (r.grade.strengths.length) {
          d.appendChild(el('h4', '', "👍 Kuchli tomonlar"));
          const ul = el('ul');
          r.grade.strengths.forEach((x) => ul.appendChild(el('li', '', x)));
          d.appendChild(ul);
        }
        if (r.grade.improvements.length) {
          d.appendChild(el('h4', '', '🛠 Nimani yaxshilash kerak'));
          const ul = el('ul');
          r.grade.improvements.forEach((x) => ul.appendChild(el('li', '', x)));
          d.appendChild(ul);
        }
        if (r.grade.corrected) {
          d.appendChild(el('h4', '', "✅ To'g'rilangan variant"));
          d.appendChild(el('p', 'passage-text', r.grade.corrected));
        }
      } else if (r.mistakes.length) {
        const ul = el('ul', 'exam-mistakes');
        for (const m of r.mistakes) {
          const li = el('li');
          li.appendChild(el('span', '', m.question));
          li.appendChild(el('s', 'wrong', m.chosen || '— javob berilmagan'));
          li.appendChild(el('b', 'correct', m.correct));
          if (m.explanation) li.appendChild(el('span', 'why', m.explanation));
          ul.appendChild(li);
          // Xato javoblardagi qisqa iboralar takrorlash daftariga tushadi.
          if (m.correct.split(/\s+/).length <= 4) window.Learn.addWord(App.lang(), m.correct, m.question, { lapse: true });
        }
        d.appendChild(ul);
      } else {
        d.appendChild(el('p', '', "Xato yo'q — zo'r! 🎉"));
      }
      fb.appendChild(d);
    }
    if (fb.firstChild && results.length > 0) fb.firstChild.open = results.length === 1;

    if (weakest && weakest.score < 85) {
      const tip = PRACTICE[weakest.id];
      const box = el('div', 'weak-tip');
      box.appendChild(el('p', '', `${name}: Eng zaif joyingiz — ${E.SECTION_INFO[weakest.id].title.toLowerCase()} (${weakest.score}%). Shuni mashq qilaylik:`));
      box.appendChild(
        button('primary', tip.label, () => {
          if (tip.run) tip.run();
          else start(exam, [weakest.id]);
        })
      );
      fb.appendChild(box);
    }

    Face.set($('examResultFace'), passed ? 'excited' : total >= passLine - 15 ? 'happy' : 'thinking');

    const history = App.loadStored(historyKey()) || [];
    history.unshift({ exam: exam.id, date: Date.now(), total, passed, full, sections: results.map((r) => ({ id: r.id, score: r.score })) });
    App.store(historyKey(), history.slice(0, 20));
    window.Practice.awardXp(full ? 40 : 10, full ? 'Sinov imtihoni' : "Imtihon bo'limi");

    const again = { exam, only: full ? null : results.map((r) => r.id) };
    $('examAgainBtn').onclick = () => start(again.exam, again.only);
    App.show('examResult');
  }

  $('examListBtn').addEventListener('click', openList);
  $('examCard').addEventListener('click', openList);

  return { openList };
})();
