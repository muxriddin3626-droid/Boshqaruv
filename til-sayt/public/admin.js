// Til Ustoz admin paneli.
(() => {
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['login', 'stats', 'users', 'payments', 'costs', 'knowledge', 'settings'];

  const LABELS = {
    goal: { patent: '🛂 Patent (Rossiyada ish)', eps: '🏭 EPS (Koreyada ish)', ielts: '🎓 IELTS / CEFR', work: '💼 Ish', study: "🎓 O'qish", family: '👨‍👩‍👧 Oila, ko\'chish', exam: '📜 Imtihon', travel: '✈️ Sayohat', self: "💡 O'zi uchun" },
    prof: { builder: '👷 Quruvchi', driver: '🚕 Haydovchi', cook: '👨‍🍳 Oshpaz', seller: '🛒 Sotuvchi', courier: '📦 Kuryer', nurse: '🧑‍⚕️ Hamshira', factory: '🏭 Zavod', cleaner: '🧹 Tozalash', student: '🎓 Talaba', other: '✨ Boshqa' },
    level: { zero: '🌱 Noldan', little: '🌿 Biroz biladi', middle: "🌳 O'rta", good: '🏔️ Yaxshi' },
    age: { u18: '18 gacha', '18_25': '18–25', '26_35': '26–35', '36_50': '36–50', '50p': '50+' },
    interests: { football: '⚽ Futbol', sport: '🏋️ Sport', films: '🎬 Kino', music: '🎵 Musiqa', food: '🍲 Ovqat', travel: '🧳 Sayohat', tech: '📱 Texnologiya', cars: '🚗 Mashinalar', family: '🏡 Oila', nature: '🌄 Tabiat', books: '📚 Kitoblar', games: "🎮 O'yinlar" },
    kind: { lesson: '🎙️ Ovozli darslar', practice: "🎮 O'yin va hikoyalar", exam: "🎓 Imtihon bo'limlari" },
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
    b.addEventListener('click', onClick);
    return b;
  }

  const fmtNum = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
  const fmtDate = (t) => {
    if (!t) return '—';
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };
  const ago = (t) => {
    if (!t) return '—';
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 60) return `${m} daq oldin`;
    if (m < 1440) return `${Math.round(m / 60)} soat oldin`;
    return `${Math.round(m / 1440)} kun oldin`;
  };

  let toastTimer = null;
  function toast(text) {
    const t = $('toast');
    clearTimeout(toastTimer);
    t.textContent = text;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => (t.hidden = true), 250);
    }, 2500);
  }

  async function api(url, data) {
    const res = await fetch(url, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json().catch(() => ({}));
    if (res.status === 403) {
      show('login');
      throw new Error(json.error || "Ruxsat yo'q");
    }
    if (!res.ok) throw new Error(json.error || 'Xatolik');
    return json;
  }

  function show(view) {
    for (const v of VIEWS) $(`${v}View`).hidden = v !== view;
    const logged = view !== 'login';
    $('tabs').hidden = !logged;
    $('logoutBtn').hidden = !logged;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === view));
  }

  // ---------- Kirish ----------

  async function init() {
    let me = { admin: false };
    try {
      me = await (await fetch('/api/admin/me')).json();
    } catch {}
    if (me.admin) return openTab('stats');
    $('loginHint').textContent = [
      me.passwordLogin ? '' : "Diqqat: serverda ADMIN_SECRET sozlanmagan — parol bilan kirib bo'lmaydi.",
      me.accountAdmins ? "Akkauntingiz admin ro'yxatida bo'lsa, avval saytda akkauntga kiring va bu sahifani yangilang." : '',
    ]
      .filter(Boolean)
      .join(' ');
    show('login');
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('loginError').hidden = true;
    try {
      await api('/api/admin/login', { secret: $('secretInput').value });
      $('secretInput').value = '';
      openTab('stats');
    } catch (err) {
      $('loginError').textContent = err.message;
      $('loginError').hidden = false;
    }
  });

  $('logoutBtn').addEventListener('click', async () => {
    await api('/api/admin/logout', {}).catch(() => {});
    show('login');
  });

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => openTab(t.dataset.tab)));

  function openTab(tab) {
    show(tab);
    if (tab !== 'payments') refreshBadge();
    if (tab === 'stats') {
      loadStats();
      loadInsights();
    }
    else if (tab === 'users') loadUsers();
    else if (tab === 'payments') loadPayments();
    else if (tab === 'knowledge') loadKnowledge();
    else if (tab === 'costs') loadCosts();
    else if (tab === 'settings') loadSettings();
  }

  // ---------- Statistika ----------

  function kpi(label, value, sub) {
    const tile = el('div', 'kpi');
    tile.appendChild(el('span', 'kpi-label', label));
    tile.appendChild(el('b', 'kpi-value', value));
    if (sub) tile.appendChild(el('span', 'kpi-sub', sub));
    return tile;
  }

  async function loadStats() {
    let s;
    try {
      s = await api('/api/admin/stats');
    } catch (err) {
      return toast(err.message);
    }
    const c = s.counts;
    const kpis = $('kpis');
    kpis.textContent = '';
    kpis.append(
      kpi('Foydalanuvchilar', fmtNum(c.users), `+${c.newToday} bugun · +${c.new7d} 7 kunda`),
      kpi('Faol', fmtNum(c.activeToday), `bugun · ${fmtNum(c.active7d)} 7 kunda`),
      kpi('⭐ Premium', fmtNum(c.premium), c.users ? `${Math.round((c.premium / c.users) * 100)}% foydalanuvchilar` : ''),
      kpi('👥 Taklif orqali', fmtNum(c.referred), 'ro\'yxatdan o\'tgan'),
      kpi('🔥 Haftalik XP', fmtNum(c.weekXp), 'barcha foydalanuvchilar'),
      kpi('🔐 Kirish usuli', fmtNum(c.users - c.google - c.phone), `Telegram · ${fmtNum(c.google)} Google · ${fmtNum(c.phone)} telefon`)
    );

    renderBarChart($('signupChart'), s.signups);

    const usage = $('usageToday');
    usage.textContent = '';
    for (const kind of ['lesson', 'practice', 'exam']) {
      const u = s.usage[kind] || { count: 0, people: 0, guests: 0 };
      usage.appendChild(kpi(LABELS.kind[kind], fmtNum(u.count), `${u.people} kishi (${u.guests} mehmon)`));
    }
    const lim = s.settings.limitsOn ? `Bepul limit: ${s.settings.freeLessons} / ${s.settings.freePractice} / ${s.settings.freeExam}` : "Limitlar o'chirilgan";
    usage.appendChild(kpi('⚙️ Limitlar', s.settings.limitsOn ? 'Yoqilgan' : "O'chiq", lim));

    const sv = s.survey;
    $('surveyNote').textContent = sv.total
      ? `${sv.total} ta anketa (rus tili: ${sv.langs.ru}, nemis tili: ${sv.langs.de}, koreys tili: ${sv.langs.ko || 0}, ingliz tili: ${sv.langs.en || 0}). Faqat akkauntga kirganlar hisoblanadi.`
      : "Hali anketa yo'q. Faqat akkauntga kirgan foydalanuvchilarning anketasi serverga saqlanadi.";
    const dist = $('surveyDist');
    dist.textContent = '';
    for (const [key, title] of [
      ['goal', '🎯 Maqsad'],
      ['prof', '💼 Kasb'],
      ['level', '📊 Daraja'],
      ['age', '🎂 Yosh'],
      ['interests', '💬 Qiziqishlar'],
    ]) {
      dist.appendChild(renderDist(title, sv[key], LABELS[key]));
    }
  }

  // Bitta qatorli ustunli grafik: har kun — bitta ustun, ustiga borganda aniq son.
  // opts: { axis(v), tip(r), footer } — boshqa grafiklar (masalan, xarajat) uchun.
  function renderBarChart(box, rows, opts = {}) {
    box.textContent = '';
    // Grafik konteyner kengligida chiziladi, shunda telefonda ham yozuvlar o'qiladi.
    const W = Math.max(300, Math.min(1000, Math.round(box.clientWidth || 640)));
    const H = 200;
    const pad = { l: 28, r: 8, t: 12, b: 26 };
    const max = Math.max(1, ...rows.map((r) => r.count));
    const step = Math.max(1, Math.ceil(max / 4));
    const top = step * Math.ceil(max / step);
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const bw = iw / rows.length;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Oxirgi 14 kunda ro'yxatdan o'tishlar: ${rows.map((r) => `${r.day.slice(5)} — ${r.count}`).join(', ')}`);
    const mk = (tag, attrs, text) => {
      const n = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (text != null) n.textContent = text;
      svg.appendChild(n);
      return n;
    };
    for (let v = 0; v <= top; v += step) {
      const y = pad.t + ih - (v / top) * ih;
      mk('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'grid' });
      mk('text', { x: pad.l - 6, y: y + 4, class: 'axis', 'text-anchor': 'end' }, opts.axis ? opts.axis(v) : v);
    }
    const tip = el('div', 'chart-tip');
    tip.hidden = true;
    rows.forEach((r, i) => {
      const h = (r.count / top) * ih;
      const x = pad.l + i * bw + 3;
      const w = Math.max(4, bw - 6);
      const y = pad.t + ih - h;
      if (r.count > 0) {
        // Ustun: tepasi 4px yumaloq, pastki qismi o'qqa tegadi.
        const rr = Math.min(4, w / 2, h);
        mk('path', {
          d: `M${x},${pad.t + ih} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${pad.t + ih} Z`,
          class: 'bar',
        });
      }
      if (i % 2 === rows.length % 2 || rows.length < 8) {
        mk('text', { x: x + w / 2, y: H - 8, class: 'axis', 'text-anchor': 'middle' }, `${r.day.slice(8)}.${r.day.slice(5, 7)}`);
      }
      // Ustundan kattaroq ko'rinmas maydon — sichqoncha va barmoq bilan oson tanlash uchun.
      const hit = mk('rect', { x: pad.l + i * bw, y: pad.t, width: bw, height: ih, class: 'hit' });
      const showTip = () => {
        tip.textContent = opts.tip ? opts.tip(r) : `${r.day.slice(8)}.${r.day.slice(5, 7)} — ${r.count} ta yangi`;
        tip.hidden = false;
        tip.style.left = `${((pad.l + i * bw + bw / 2) / W) * 100}%`;
      };
      hit.addEventListener('mouseenter', showTip);
      hit.addEventListener('click', showTip);
      hit.addEventListener('mouseleave', () => (tip.hidden = true));
    });
    mk('line', { x1: pad.l, x2: W - pad.r, y1: pad.t + ih, y2: pad.t + ih, class: 'baseline' });
    box.append(svg, tip);
    const total = rows.reduce((n, r) => n + r.count, 0);
    box.appendChild(el('p', 'hint-left', opts.footer || `Jami 14 kunda: ${total} ta yangi foydalanuvchi`));
  }

  // Taqsimot: gorizontal ustunlar, qiymat matn rangida.
  function renderDist(title, rows, labels) {
    const box = el('div', 'dist');
    box.appendChild(el('h3', '', title));
    if (!rows.length) {
      box.appendChild(el('p', 'hint-left', "Ma'lumot yo'q"));
      return box;
    }
    const max = Math.max(...rows.map((r) => r.count));
    for (const r of rows.slice(0, 8)) {
      const row = el('div', 'dist-row');
      row.appendChild(el('span', 'dist-label', (labels && labels[r.key]) || r.key));
      const bar = el('div', 'dist-bar');
      const fill = el('div', 'dist-fill');
      fill.style.width = `${Math.max(3, (r.count / max) * 100)}%`;
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el('b', 'dist-value', r.count));
      box.appendChild(row);
    }
    return box;
  }

  // ---------- Foydalanuvchilar ----------

  let usersOffset = 0;
  let usersQuery = '';

  async function loadUsers() {
    let r;
    try {
      r = await api(`/api/admin/users?q=${encodeURIComponent(usersQuery)}&offset=${usersOffset}`);
    } catch (err) {
      return toast(err.message);
    }
    $('usersCount').textContent = `${r.total} ta foydalanuvchi${usersQuery ? ` («${usersQuery}» bo'yicha)` : ''}. Batafsil ko'rish uchun qatorni bosing.`;
    const body = $('usersBody');
    body.textContent = '';
    for (const u of r.users) {
      const tr = el('tr', 'clickable');
      const name = el('td');
      name.appendChild(el('b', '', [u.firstName, u.lastName].filter(Boolean).join(' ') || '—'));
      name.appendChild(el('span', 'muted', ` · ${loginLabel(u.id)}`));
      const premium = u.premiumUntil > Date.now();
      tr.append(
        name,
        el('td', '', fmtDate(u.createdAt)),
        el('td', '', ago(u.activeAt)),
        el('td', 'num', fmtNum(u.weekXp)),
        el('td', 'num', u.invited)
      );
      const p = el('td');
      p.appendChild(el('span', `pill-badge${premium ? ' pro' : ''}`, premium ? `${u.premiumUntil <= u.trialUntil ? '🎁 Sinov' : `⭐ ${planName(u.plan)}`} · ${fmtDate(u.premiumUntil)} gacha` : 'Bepul'));
      tr.appendChild(p);
      tr.addEventListener('click', () => openUser(u.id));
      body.appendChild(tr);
    }
    if (!r.users.length) {
      const tr = el('tr');
      const td = el('td', 'muted', 'Hech kim topilmadi.');
      td.colSpan = 6;
      tr.appendChild(td);
      body.appendChild(tr);
    }
    $('prevPage').disabled = usersOffset === 0;
    $('nextPage').disabled = usersOffset + r.users.length >= r.total;
  }

  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    usersQuery = $('searchInput').value.trim();
    usersOffset = 0;
    loadUsers();
  });
  $('prevPage').addEventListener('click', () => {
    usersOffset = Math.max(0, usersOffset - 30);
    loadUsers();
  });
  $('nextPage').addEventListener('click', () => {
    usersOffset += 30;
    loadUsers();
  });

  // Akkaunt ID'sidan kirish usuli.
  function loginLabel(id) {
    if (id.startsWith('g:')) return 'Google';
    if (id.startsWith('p:')) return `📱 +${id.slice(2)}`;
    return `Telegram ${id}`;
  }

  async function openUser(id) {
    let d;
    try {
      d = await api(`/api/admin/user?id=${encodeURIComponent(id)}`);
    } catch (err) {
      return toast(err.message);
    }
    const u = d.user;
    const box = $('userDetail');
    box.textContent = '';
    box.appendChild(el('h2', '', [u.firstName, u.lastName].filter(Boolean).join(' ') || '—'));
    const premium = u.premiumUntil > Date.now();
    box.appendChild(el('p', 'muted', `${loginLabel(u.id)} · taklif kodi: ${u.refCode} · reytingda: ${u.showInRating ? 'ha' : "yo'q"}`));

    const facts = el('div', 'kpis small');
    facts.append(
      kpi('Jami XP', fmtNum(d.totalXp)),
      kpi('Darslar', fmtNum(d.stats.lessons || 0)),
      kpi("O'yinlar", fmtNum(d.stats.games || 0)),
      kpi('Nishonlar', d.badges)
    );
    box.appendChild(facts);

    if (d.cost) {
      const c = el('div', 'user-lang');
      c.appendChild(el('h3', '', '💰 AI xarajati'));
      c.appendChild(el('p', '', `Bugun: $${d.cost.today.toFixed(2)} · 30 kunda: $${d.cost.d30.usd.toFixed(2)} (${d.cost.d30.calls} ta so'rov)`));
      box.appendChild(c);
    }

    if (d.memory && d.memory.length) {
      const mem = el('div', 'user-lang');
      mem.appendChild(el('h3', '', '🧠 Ustoz u haqida biladi'));
      d.memory.forEach((f) => mem.appendChild(el('p', '', `• ${f}`)));
      box.appendChild(mem);
    }

    for (const lang of ['ru', 'de', 'ko', 'en']) {
      const l = d.langs[lang];
      if (!l.profile && !l.words && !l.lessons) continue;
      const sec = el('div', 'user-lang');
      sec.appendChild(el('h3', '', { ru: '🇷🇺 Rus tili', de: '🇩🇪 Nemis tili', ko: '🇰🇷 Koreys tili', en: '🇬🇧 Ingliz tili' }[lang]));
      const p = l.profile || {};
      const lines = [
        p.name ? `Anketa: ${p.name}${p.city ? `, ${p.city}` : ''}${p.age ? `, ${LABELS.age[p.age] || p.age}` : ''}` : 'Anketa to\'ldirilmagan',
        p.goal ? `Maqsad: ${LABELS.goal[p.goal] || p.goal} · daraja: ${LABELS.level[p.level] || '—'} · kasb: ${LABELS.prof[p.prof] || '—'}` : '',
        `So'zlar: ${l.words} (${l.learned} ta yodlangan) · kurs bosqichlari: ${l.unitsPassed}/12${l.certs.length ? ` · sertifikat: ${l.certs.join(', ')}` : ''}`,
      ].filter(Boolean);
      lines.forEach((t) => sec.appendChild(el('p', '', t)));
      box.appendChild(sec);
    }

    const prem = el('div', 'user-premium');
    prem.appendChild(el('h3', '', '⭐ Obuna'));
    prem.appendChild(el('p', '', premium ? `Faol: ${planName(u.plan)} · ${fmtDate(u.premiumUntil)} gacha` : "Obuna yo'q"));
    let chosen = premium ? u.plan : 'standard';
    const plansRow = el('div', 'chips');
    for (const pl of window.PLANS.PLANS) {
      const c = button(`chip${pl.id === chosen ? ' selected' : ''}`, `${pl.name} · ${pl.minutes} daq`, () => {
        chosen = pl.id;
        plansRow.querySelectorAll('.chip').forEach((x) => x.classList.toggle('selected', x === c));
      });
      plansRow.appendChild(c);
    }
    prem.appendChild(plansRow);
    const row = el('div', 'chips');
    for (const [days, label] of [[7, '+7 kun'], [30, '+1 oy'], [90, '+3 oy'], [365, '+1 yil']]) {
      row.appendChild(button('chip', label, () => setPremium(u.id, { days, plan: chosen })));
    }
    if (premium) row.appendChild(button('chip danger', "Olib qo'yish", () => {
      if (confirm('Obuna olib qo\'yilsinmi?')) setPremium(u.id, { remove: true });
    }));
    prem.appendChild(row);
    box.appendChild(prem);

    if (u.id.startsWith('p:')) {
      const pw = el('div', 'user-premium');
      pw.appendChild(el('h3', '', '🔑 Parol'));
      pw.appendChild(el('p', '', "Parolini unutgan bo'lsa — yangi vaqtinchalik parol bering va unga yuboring."));
      const out = el('p', 'new-password');
      pw.appendChild(button('chip', 'Yangi parol berish', async () => {
        if (!confirm("Eski parol ishlamay qoladi. Yangi parol berilsinmi?")) return;
        try {
          const r = await api('/api/admin/password', { userId: u.id });
          out.textContent = `Yangi parol: ${r.password}`;
        } catch (err) {
          toast(err.message);
        }
      }));
      pw.appendChild(out);
      box.appendChild(pw);
    }

    const dlg = $('userDialog');
    if (!dlg.open) dlg.showModal();
  }

  function planName(id) {
    const p = window.PLANS.byId(id);
    return p ? p.name : 'Standard';
  }

  async function setPremium(userId, opts) {
    try {
      await api('/api/admin/premium', { userId, ...opts });
      toast(opts.remove ? "Obuna olib qo'yildi" : `${planName(opts.plan)}: +${opts.days} kun berildi`);
      await openUser(userId);
      loadUsers();
    } catch (err) {
      toast(err.message);
    }
  }

  // ---------- To'lovlar (chekni tekshirish) ----------

  const PAY_LABEL = { pending: '⏳ Kutilmoqda', approved: '✅ Tasdiqlangan', rejected: '❌ Rad etilgan' };
  const payLabel = (p) =>
    p.status === 'approved' && p.auto ? (p.reviewed ? '🤖 Avto-tasdiqlangan · ko\'rildi' : '🤖 Avto-tasdiqlangan · ko\'rib chiqing') : PAY_LABEL[p.status];
  const fmtMoney = (n) => window.PLANS.fmt(n);
  let payStatus = 'pending';

  function setBadge(n) {
    $('payBadge').textContent = n;
    $('payBadge').hidden = !n;
  }

  async function refreshBadge() {
    try {
      const r = await api('/api/admin/payments?status=pending');
      setBadge(r.pending + r.review);
    } catch {}
  }

  async function loadPayments() {
    let r;
    try {
      r = await api(`/api/admin/payments?status=${payStatus}`);
    } catch (err) {
      return toast(err.message);
    }
    setBadge(r.pending + r.review);
    const reviewChip = $('payFilter').querySelector('[data-status="review"]');
    reviewChip.textContent = `🤖 Avto-tasdiqlangan — ko'rib chiqing${r.review ? ` (${r.review})` : ''}`;
    $('payNote').textContent = r.payments.length
      ? payStatus === 'review'
        ? "Bu cheklar avtomatik tekshirilib, obuna allaqachon yoqilgan. Bank ilovangizda pul tushganini tekshiring: to'g'ri bo'lsa «👍 To'g'ri», soxta bo'lsa «↩️ Bekor qilish» — obuna qaytarib olinadi."
        : `${r.payments.length} ta to'lov. Chekdagi summa, sana va qabul qiluvchi kartani tekshiring, so'ng tasdiqlang — obuna o'zi yoqiladi.`
      : payStatus === 'pending'
        ? "Kutilayotgan to'lov yo'q. Yangi chek kelganda shu yerda chiqadi."
        : "Bu bo'limda to'lov yo'q.";
    const list = $('payList');
    list.textContent = '';
    for (const p of r.payments) list.appendChild(paymentCard(p));
  }

  function paymentCard(p) {
    const card = el('div', `panel pay-item pay-${p.status}`);
    const fileUrl = `/api/admin/payment-file?id=${p.id}`;
    if (p.fileMime === 'application/pdf') {
      const a = el('a', 'pay-pdf', '📄 PDF chekni ochish');
      a.href = fileUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      card.appendChild(a);
    } else {
      const a = el('a', 'pay-img-link');
      a.href = fileUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      const img = el('img', 'pay-img');
      img.src = fileUrl;
      img.alt = `Chek #${p.id}`;
      img.loading = 'lazy';
      a.appendChild(img);
      card.appendChild(a);
    }
    const info = el('div', 'pay-info');
    info.appendChild(el('b', 'pay-amount', fmtMoney(p.amount)));
    const period = (window.PLANS.PERIODS.find((x) => x.months === p.months) || {}).label || `${p.months} oy`;
    info.appendChild(el('span', '', `${planName(p.plan)} · ${period} (${p.days} kun)`));
    const who = el('button', 'link-btn pay-user', `${p.userName || 'Foydalanuvchi'} · ${loginLabel(p.userId)}`);
    who.type = 'button';
    who.addEventListener('click', () => openUser(p.userId));
    info.appendChild(who);
    info.appendChild(el('span', 'muted', `#${p.id} · ${fmtDate(p.createdAt)} ${new Date(p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`));
    info.appendChild(el('span', `pill-badge pay-badge-${p.status}`, payLabel(p) + (p.status === 'rejected' && p.note ? `: ${p.note}` : '')));
    card.appendChild(info);
    if (p.check) {
      const box = el('div', 'pay-check');
      box.appendChild(el('b', '', `🤖 ${p.check.summary || 'Avtomatik tekshiruv'}`));
      const ul = el('ul');
      for (const it of p.check.items || []) ul.appendChild(el('li', it.ok ? 'ok' : 'bad', `${it.ok ? '✓' : '✗'} ${it.text}`));
      if (p.check.read && p.check.read.txn) ul.appendChild(el('li', 'muted', `Tranzaksiya: ${p.check.read.txn}`));
      if (p.check.read && p.check.read.notes) ul.appendChild(el('li', 'muted', p.check.read.notes));
      box.appendChild(ul);
      card.appendChild(box);
    }
    if (p.status === 'approved' && p.auto && !p.reviewed) {
      const actions = el('div', 'end-actions pay-actions');
      actions.append(
        button('primary', "👍 To'g'ri", () => decide(p, 'reviewed')),
        button('secondary', '↩️ Bekor qilish', () => decide(p, 'revoke'))
      );
      card.appendChild(actions);
    }
    if (p.status === 'pending') {
      const actions = el('div', 'end-actions pay-actions');
      actions.append(
        button('primary', '✅ Tasdiqlash', () => decide(p, 'approve')),
        button('secondary', '❌ Rad etish', () => decide(p, 'reject'))
      );
      card.appendChild(actions);
    }
    return card;
  }

  async function decide(p, action) {
    let note = '';
    if (action === 'approve') {
      if (!confirm(`${fmtMoney(p.amount)} — ${planName(p.plan)}, ${p.days} kun. Tasdiqlab, obunani yoqasizmi?`)) return;
    } else if (action === 'reviewed') {
      // tasdiqlash so'ralmaydi
    } else if (action === 'revoke') {
      note = prompt(`Obuna (${p.days} kun) qaytarib olinadi. Sababi (foydalanuvchiga ko'rinadi):`, "Pul kartaga tushmadi");
      if (note === null) return;
    } else {
      note = prompt("Rad etish sababi (foydalanuvchiga ko'rinadi):", "Chekdagi summa mos kelmadi");
      if (note === null) return;
    }
    try {
      await api('/api/admin/payment', { id: p.id, action, note });
      toast(
        { approve: `✅ Tasdiqlandi — ${planName(p.plan)} +${p.days} kun yoqildi`, reviewed: "👍 Ko'rib chiqildi", revoke: '↩️ Bekor qilindi, obuna qaytarib olindi' }[action] ||
          '❌ Rad etildi'
      );
      loadPayments();
    } catch (err) {
      toast(err.message);
      loadPayments();
    }
  }

  $('payFilter').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    payStatus = chip.dataset.status;
    $('payFilter').querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === chip));
    loadPayments();
  });

  // Yangi cheklar haqida: har daqiqada nishonchani yangilaymiz.
  setInterval(() => !$('tabs').hidden && refreshBadge(), 60000);

  // ---------- AI xarajati ----------

  let costRate = 12800;
  const money = (usd) => `$${usd < 10 ? usd.toFixed(2) : Math.round(usd).toLocaleString('ru-RU')}`;
  const som = (usd) => `${Math.round((usd * costRate) / 1000).toLocaleString('ru-RU').replace(/,/g, ' ')} ming so'm`;
  const PLAN_NAMES = { light: 'Light', standard: 'Standard', pro: 'Pro' };

  async function loadCosts() {
    let r;
    try {
      r = await api('/api/admin/costs');
    } catch (err) {
      return toast(err.message);
    }
    costRate = r.usdRate;
    const k = $('costKpis');
    k.textContent = '';
    const revUsd = r.revenue.monthlyUzs / r.usdRate;
    const profit = revUsd - r.forecastMonth;
    k.append(
      kpi('Bugun', money(r.today), som(r.today)),
      kpi('7 kun', money(r.d7), som(r.d7)),
      kpi('30 kun', money(r.d30), som(r.d30)),
      kpi('Oylik prognoz', money(r.forecastMonth), "oxirgi 30 kun bo'yicha"),
      kpi(
        'Obunadan daromad (oyiga)',
        `${Math.round(r.revenue.monthlyUzs / 1000).toLocaleString('ru-RU').replace(/,/g, ' ')} ming so'm`,
        r.revenue.subs.map((x) => `${PLAN_NAMES[x.plan] || x.plan}: ${x.count}`).join(' · ') || "faol obuna yo'q"
      ),
      kpi(profit >= 0 ? '✅ Taxminiy foyda' : '⚠️ Taxminiy zarar', money(Math.abs(profit)), `${som(Math.abs(profit))} / oy`)
    );
    renderBarChart(
      $('costChart'),
      r.byDay.map((d) => ({ day: d.day, count: Math.round(d.usd * 100) })),
      {
        axis: (v) => `$${(v / 100).toFixed(v >= 1000 ? 0 : v >= 100 ? 1 : 2)}`,
        tip: (row) => `${row.day.slice(8)}.${row.day.slice(5, 7)} — $${(row.count / 100).toFixed(2)}`,
        footer: `30 kunda jami: ${money(r.d30)} (${som(r.d30)})`,
      }
    );
    const kinds = $('costKinds');
    kinds.textContent = '';
    const totalKinds = r.byKind.reduce((n, x) => n + x.usd, 0) || 1;
    for (const x of r.byKind) {
      const row = el('div', 'dist-row');
      const bar = el('div', 'dist-bar');
      const fill = el('div', 'dist-fill');
      fill.style.width = `${Math.max(3, (x.usd / totalKinds) * 100)}%`;
      bar.appendChild(fill);
      row.append(el('span', 'dist-label', x.label), bar, el('span', 'dist-value cost-val', money(x.usd)));
      row.title = `${x.calls} ta so'rov${x.searches ? `, ${x.searches} ta internet qidiruvi` : ''}`;
      kinds.appendChild(row);
    }
    if (!r.byKind.length) kinds.appendChild(el('p', 'muted', "Hali xarajat yo'q"));

    const al = $('costAlerts');
    al.textContent = '';
    al.hidden = !r.alerts.length;
    if (r.alerts.length) {
      al.appendChild(el('b', '', `⚠️ Bugun ${money(r.settings.costAlertUsd)} dan ko'p sarflaganlar:`));
      for (const a of r.alerts) al.appendChild(el('p', '', `${a.name || a.subject} — ${money(a.todayUsd)}${a.premium ? '' : ' (bepul!)'}`));
    }

    const body = $('costTop');
    body.textContent = '';
    for (const t of r.top) {
      const isUser = t.subject.startsWith('u:');
      const tr = el('tr', isUser ? 'clickable' : '');
      const who = isUser ? `${t.name || '—'} · ${loginLabel(t.subject.slice(2))}` : `Mehmon (IP ${t.subject.slice(3).replace(/\.\d+$/, '.*')})`;
      const plan = t.premium ? `⭐ ${PLAN_NAMES[t.plan] || 'Premium'}` : 'Bepul';
      tr.append(el('td', '', who), el('td', '', plan), el('td', 'num', money(t.todayUsd)), el('td', 'num', money(t.usd)), el('td', 'num', t.calls));
      if (isUser) tr.addEventListener('click', () => openUser(t.subject.slice(2)));
      body.appendChild(tr);
    }
    if (!r.top.length) {
      const tr = el('tr');
      const td = el('td', 'muted', "Hali ma'lumot yo'q");
      td.colSpan = 5;
      tr.appendChild(td);
      body.appendChild(tr);
    }
    $('setCostAlert').value = r.settings.costAlertUsd;
    $('setUserCap').value = r.settings.userDailyCapUsd;
    $('setDailyBudget').value = r.settings.dailyBudgetUsd;
    $('setUsdRate').value = r.settings.usdRate;
  }

  $('costForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
    try {
      await api('/api/admin/settings', {
        settings: {
          costAlertUsd: num('setCostAlert'),
          userDailyCapUsd: num('setUserCap'),
          dailyBudgetUsd: num('setDailyBudget'),
          usdRate: num('setUsdRate') || 12800,
        },
      });
      toast('✅ Saqlandi');
      loadCosts();
    } catch (err) {
      toast(err.message);
    }
  });

  // ---------- Bilim bazasi ----------

  const KB_LANG = { all: '🌍 Hamma tillar', ru: '🇷🇺 Rus', de: '🇩🇪 Nemis', ko: '🇰🇷 Koreys', en: '🇬🇧 Ingliz' };
  let kbLang = '';

  async function loadKnowledge() {
    let r;
    try {
      r = await api(`/api/admin/knowledge?lang=${kbLang}`);
    } catch (err) {
      return toast(err.message);
    }
    const ref = $('kbRefresh');
    ref.textContent = '';
    for (const l of ['ru', 'de', 'ko', 'en']) {
      const at = r.rulesUpdated[l];
      const b = button('secondary', `🔄 ${KB_LANG[l]} — ${at ? `yangilangan: ${fmtDate(at)}` : 'hali yangilanmagan'}`, async () => {
        b.disabled = true;
        b.textContent = `⏳ ${KB_LANG[l]} — internetdan tekshirilmoqda...`;
        try {
          const res = await api('/api/admin/knowledge/refresh', { lang: l });
          toast(`✅ ${res.count} ta ma'lumot yangilandi`);
        } catch (err) {
          toast(err.message);
        }
        loadKnowledge();
      });
      ref.appendChild(b);
    }
    const list = $('kbList');
    list.textContent = '';
    if (!r.items.length) list.appendChild(el('p', 'hint-left', "Hozircha ma'lumot yo'q. Yuqorida qo'shing yoki internetdan yangilang."));
    for (const k of r.items) {
      const card = el('div', `panel kb-item${k.enabled ? '' : ' off'}`);
      const head = el('div', 'kb-head');
      head.append(
        el('span', 'pill-badge', KB_LANG[k.lang] || k.lang),
        el('span', `pill-badge ${k.source === 'auto' ? 'pro' : 'free'}`, k.source === 'auto' ? '🤖 avto (internet)' : '✍️ admin'),
        k.topic ? el('span', 'pill-badge', `#${k.topic}`) : el('span'),
        el('span', 'muted', fmtDate(k.updatedAt))
      );
      card.append(head, el('b', 'kb-title', k.title), el('p', 'kb-body', k.body));
      if (k.sourceUrl) {
        const a = el('a', 'kb-src', `Manba ↗ ${k.sourceUrl.replace(/^https?:\/\//, '').slice(0, 60)}`);
        a.href = k.sourceUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        card.appendChild(a);
      }
      const actions = el('div', 'end-actions kb-actions');
      actions.append(
        button('chip', k.enabled ? '⏸️ O\'chirish' : '▶️ Yoqish', async () => {
          await api('/api/admin/knowledge', { action: 'toggle', id: k.id, enabled: !k.enabled }).catch((e) => toast(e.message));
          loadKnowledge();
        }),
        button('chip', '✏️ Tahrirlash', () => editKnowledge(k)),
        button('chip danger', "🗑️ O'chirib tashlash", async () => {
          if (!confirm("Bu ma'lumot o'chirib tashlansinmi?")) return;
          await api('/api/admin/knowledge', { action: 'delete', id: k.id }).catch((e) => toast(e.message));
          loadKnowledge();
        })
      );
      card.appendChild(actions);
      list.appendChild(card);
    }
  }

  function editKnowledge(k) {
    $('kbId').value = k ? k.id : '';
    $('kbLang').value = k ? k.lang : 'all';
    $('kbTopic').value = k ? k.topic : '';
    $('kbUrl').value = k ? k.sourceUrl : '';
    $('kbTitle').value = k ? k.title : '';
    $('kbBody').value = k ? k.body : '';
    $('kbCancel').hidden = !k;
    $('kbSave').textContent = k ? 'Saqlash (tahrir)' : 'Saqlash';
    if (k) $('kbForm').scrollIntoView({ behavior: 'smooth' });
  }

  $('kbForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/knowledge', {
        id: $('kbId').value || null,
        lang: $('kbLang').value,
        topic: $('kbTopic').value,
        sourceUrl: $('kbUrl').value,
        title: $('kbTitle').value,
        body: $('kbBody').value,
      });
      toast("✅ Saqlandi — ustoz endi buni biladi");
      editKnowledge(null);
      loadKnowledge();
    } catch (err) {
      toast(err.message);
    }
  });
  $('kbCancel').addEventListener('click', () => editKnowledge(null));
  $('kbFilter').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    kbLang = chip.dataset.lang;
    $('kbFilter').querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === chip));
    loadKnowledge();
  });

  async function loadInsights() {
    let r;
    try {
      r = await api('/api/admin/insights');
    } catch {
      return;
    }
    const box = $('insightsBox');
    box.textContent = '';
    for (const l of ['ru', 'de', 'ko', 'en']) {
      const list = r.weak[l] || [];
      const col = el('div', 'dist');
      col.appendChild(el('h3', '', KB_LANG[l]));
      if (!list.length) col.appendChild(el('p', 'muted', "Hali ma'lumot yo'q"));
      const max = Math.max(1, ...list.map((x) => x.count));
      for (const it of list) {
        const row = el('div', 'dist-row');
        const bar = el('div', 'dist-bar');
        const fill = el('div', 'dist-fill');
        fill.style.width = `${Math.round((it.count / max) * 100)}%`;
        bar.appendChild(fill);
        row.append(el('span', 'dist-label', it.text), bar, el('span', 'dist-value', it.count));
        row.title = it.text;
        col.appendChild(row);
      }
      box.appendChild(col);
    }
  }

  // ---------- Sozlamalar ----------

  const FIELDS = {
    limitsOn: ['setLimitsOn', 'bool'],
    freeLessons: ['setFreeLessons', 'int'],
    freePractice: ['setFreePractice', 'int'],
    freeExam: ['setFreeExam', 'int'],
    refBonusDays: ['setRefBonusDays', 'int'],
    trialDays: ['setTrialDays', 'int'],
    premiumContact: ['setPremiumContact', 'str'],
    cardNumber: ['setCardNumber', 'str'],
    cardHolder: ['setCardHolder', 'str'],
    cardBank: ['setCardBank', 'str'],
    autoApprove: ['setAutoApprove', 'bool'],
    announcement: ['setAnnouncement', 'str'],
  };

  async function loadSettings() {
    let s;
    try {
      s = (await api('/api/admin/settings')).settings;
    } catch (err) {
      return toast(err.message);
    }
    for (const [key, [id, type]] of Object.entries(FIELDS)) {
      if (type === 'bool') $(id).checked = Boolean(s[key]);
      else $(id).value = s[key] ?? '';
    }
    renderPrices(s.prices || window.PLANS.DEFAULT_PRICES);
  }

  // Narxlar jadvali: har tarif × muddat uchun bitta maydon.
  function renderPrices(prices) {
    const grid = $('pricesGrid');
    grid.textContent = '';
    grid.appendChild(el('span', 'price-empty'));
    for (const per of window.PLANS.PERIODS) grid.appendChild(el('b', '', per.label));
    for (const pl of window.PLANS.PLANS) {
      grid.appendChild(el('b', 'price-plan', `${pl.name} · ${pl.minutes} daq`));
      for (const per of window.PLANS.PERIODS) {
        const input = el('input');
        input.type = 'number';
        input.min = '0';
        input.step = '1000';
        input.id = `price-${pl.id}-${per.months}`;
        input.value = (prices[pl.id] || {})[per.months] ?? '';
        grid.appendChild(input);
      }
    }
  }

  function readPrices() {
    const out = {};
    for (const pl of window.PLANS.PLANS) {
      out[pl.id] = {};
      for (const per of window.PLANS.PERIODS) out[pl.id][per.months] = parseInt($(`price-${pl.id}-${per.months}`).value, 10) || 0;
    }
    return out;
  }

  $('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const patch = {};
    for (const [key, [id, type]] of Object.entries(FIELDS)) {
      if (type === 'bool') patch[key] = $(id).checked;
      else if (type === 'int') patch[key] = parseInt($(id).value, 10) || 0;
      else patch[key] = $(id).value;
    }
    patch.prices = readPrices();
    try {
      await api('/api/admin/settings', { settings: patch });
      toast('✅ Saqlandi');
      loadSettings();
    } catch (err) {
      toast(err.message);
    }
  });

  init();
})();
