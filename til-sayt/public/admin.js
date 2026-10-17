// Til Ustoz admin paneli.
(() => {
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['login', 'stats', 'users', 'codes', 'settings'];

  const LABELS = {
    goal: { patent: '🛂 Patent (Rossiyada ish)', work: '💼 Ish', study: "🎓 O'qish", family: '👨‍👩‍👧 Oila, ko\'chish', exam: '📜 Imtihon', travel: '✈️ Sayohat', self: "💡 O'zi uchun" },
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
    if (tab === 'stats') loadStats();
    else if (tab === 'users') loadUsers();
    else if (tab === 'codes') loadCodes();
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
      kpi('🎟️ Kodlar', `${fmtNum(c.codesUsed)} / ${fmtNum(c.codesTotal)}`, 'ishlatilgan / jami'),
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
    if (s.usage.sms) usage.appendChild(kpi('📱 SMS kodlar', fmtNum(s.usage.sms.count), `${s.usage.sms.people} ta raqamga`));
    const lim = s.settings.limitsOn ? `Bepul limit: ${s.settings.freeLessons} / ${s.settings.freePractice} / ${s.settings.freeExam}` : "Limitlar o'chirilgan";
    usage.appendChild(kpi('⚙️ Limitlar', s.settings.limitsOn ? 'Yoqilgan' : "O'chiq", lim));

    const sv = s.survey;
    $('surveyNote').textContent = sv.total
      ? `${sv.total} ta anketa (rus tili: ${sv.langs.ru}, nemis tili: ${sv.langs.de}). Faqat akkauntga kirganlar hisoblanadi.`
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
  function renderBarChart(box, rows) {
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
      mk('text', { x: pad.l - 6, y: y + 4, class: 'axis', 'text-anchor': 'end' }, v);
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
        tip.textContent = `${r.day.slice(8)}.${r.day.slice(5, 7)} — ${r.count} ta yangi`;
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
    box.appendChild(el('p', 'hint-left', `Jami 14 kunda: ${total} ta yangi foydalanuvchi`));
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
      p.appendChild(el('span', `pill-badge${premium ? ' pro' : ''}`, premium ? `⭐ ${fmtDate(u.premiumUntil)} gacha` : 'Bepul'));
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

    for (const lang of ['ru', 'de']) {
      const l = d.langs[lang];
      if (!l.profile && !l.words && !l.lessons) continue;
      const sec = el('div', 'user-lang');
      sec.appendChild(el('h3', '', lang === 'ru' ? '🇷🇺 Rus tili' : '🇩🇪 Nemis tili'));
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
    prem.appendChild(el('h3', '', '⭐ Premium'));
    prem.appendChild(el('p', '', premium ? `Faol: ${fmtDate(u.premiumUntil)} gacha` : "Premium yo'q"));
    const row = el('div', 'chips');
    for (const days of [7, 30, 90, 365]) {
      row.appendChild(button('chip', `+${days} kun`, () => setPremium(u.id, { days })));
    }
    if (premium) row.appendChild(button('chip danger', "Olib qo'yish", () => {
      if (confirm('Premium olib qo\'yilsinmi?')) setPremium(u.id, { remove: true });
    }));
    prem.appendChild(row);
    box.appendChild(prem);

    const dlg = $('userDialog');
    if (!dlg.open) dlg.showModal();
  }

  async function setPremium(userId, opts) {
    try {
      await api('/api/admin/premium', { userId, ...opts });
      toast(opts.remove ? "Premium olib qo'yildi" : `+${opts.days} kun Premium berildi`);
      await openUser(userId);
      loadUsers();
    } catch (err) {
      toast(err.message);
    }
  }

  // ---------- Kodlar ----------

  let codes = [];

  async function loadCodes() {
    try {
      codes = (await api('/api/admin/codes')).codes;
    } catch (err) {
      return toast(err.message);
    }
    const body = $('codesBody');
    body.textContent = '';
    for (const c of codes) {
      const tr = el('tr');
      tr.append(el('td', 'mono', c.code), el('td', 'num', c.days), el('td', '', fmtDate(c.createdAt)));
      const st = el('td');
      st.appendChild(
        el('span', `pill-badge${c.usedBy ? '' : ' free'}`, c.usedBy ? `✅ ${c.usedByName || c.usedBy} · ${fmtDate(c.usedAt)}` : '🆕 Ishlatilmagan')
      );
      tr.appendChild(st);
      body.appendChild(tr);
    }
    if (!codes.length) {
      const tr = el('tr');
      const td = el('td', 'muted', "Hali kod yo'q.");
      td.colSpan = 4;
      tr.appendChild(td);
      body.appendChild(tr);
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  $('codeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api('/api/admin/codes', { count: Number($('codeCount').value), days: Number($('codeDays').value) });
      const box = $('newCodes');
      box.textContent = '';
      box.appendChild(el('p', '', `${r.days} kunlik ${r.codes.length} ta yangi kod:`));
      box.appendChild(el('pre', 'mono', r.codes.join('\n')));
      box.appendChild(button('secondary', '📋 Nusxalash', async () => toast((await copyText(r.codes.join('\n'))) ? 'Nusxalandi' : "Nusxalab bo'lmadi")));
      box.hidden = false;
      loadCodes();
    } catch (err) {
      toast(err.message);
    }
  });

  $('copyUnused').addEventListener('click', async () => {
    const unused = codes.filter((c) => !c.usedBy).map((c) => `${c.code} (${c.days} kun)`);
    if (!unused.length) return toast("Ishlatilmagan kod yo'q");
    toast((await copyText(unused.join('\n'))) ? `${unused.length} ta kod nusxalandi` : "Nusxalab bo'lmadi");
  });

  // ---------- Sozlamalar ----------

  const FIELDS = {
    limitsOn: ['setLimitsOn', 'bool'],
    freeLessons: ['setFreeLessons', 'int'],
    freePractice: ['setFreePractice', 'int'],
    freeExam: ['setFreeExam', 'int'],
    refBonusDays: ['setRefBonusDays', 'int'],
    premiumPrice: ['setPremiumPrice', 'str'],
    premiumContact: ['setPremiumContact', 'str'],
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
  }

  $('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const patch = {};
    for (const [key, [id, type]] of Object.entries(FIELDS)) {
      if (type === 'bool') patch[key] = $(id).checked;
      else if (type === 'int') patch[key] = parseInt($(id).value, 10) || 0;
      else patch[key] = $(id).value;
    }
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
