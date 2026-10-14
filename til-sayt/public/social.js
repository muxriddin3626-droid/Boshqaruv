// Yutuq nishonlari va haftalik reyting.
window.Social = (() => {
  const App = window.App;
  const Learn = window.Learn;
  const $ = (id) => document.getElementById(id);
  const BADGES_KEY = 'tu-badges';
  const LANGS = ['ru', 'de'];

  const sumLangs = (fn) => LANGS.reduce((n, l) => n + fn(l), 0);
  const deck = () => LANGS.map((l) => Learn.deckStats(l));
  const anyUnitDone = () =>
    LANGS.some((l) => Object.values(Learn.courseProgress(l)).some((u) => u.exam));
  const certCount = () => sumLangs((l) => Object.keys(App.loadStored(`tu-certs-${l}`) || {}).length);
  const stat = (name) => Learn.stats()[name] || 0;

  // Har nishon: progress() -> [hozirgi, kerakli].
  const BADGES = [
    { id: 'first_lesson', icon: '🎙️', title: 'Birinchi dars', desc: 'Ustoz bilan birinchi ovozli darsni o\'ting', progress: () => [stat('lessons'), 1] },
    { id: 'talker', icon: '🗣️', title: 'Suhbatdosh', desc: '10 ta ovozli dars', progress: () => [stat('lessons'), 10] },
    { id: 'streak3', icon: '🔥', title: '3 kun ketma-ket', desc: 'Kunlik maqsadni 3 kun bajaring', progress: () => [Learn.daily().streak, 3] },
    { id: 'streak7', icon: '⚡', title: 'Bir hafta', desc: '7 kunlik streak', progress: () => [Learn.daily().streak, 7] },
    { id: 'streak30', icon: '👑', title: 'Bir oy', desc: '30 kunlik streak', progress: () => [Learn.daily().streak, 30] },
    { id: 'words50', icon: '📚', title: "50 ta so'z", desc: "Daftarda 50 ta so'z", progress: () => [deck().reduce((n, d) => n + d.total, 0), 50] },
    { id: 'learned25', icon: '🧠', title: 'Yodlovchi', desc: "25 ta so'zni yaxshi yodlang", progress: () => [deck().reduce((n, d) => n + d.learned, 0), 25] },
    { id: 'learned100', icon: '🏛️', title: "Lug'at boyligi", desc: "100 ta so'zni yaxshi yodlang", progress: () => [deck().reduce((n, d) => n + d.learned, 0), 100] },
    { id: 'speaker', icon: '🎯', title: 'Talaffuz ustasi', desc: '5 ta iborani 100% to\'g\'ri ayting', progress: () => [stat('perfectSpeak'), 5] },
    { id: 'reader', icon: '📖', title: 'Kitobxon', desc: '5 ta hikoya o\'qing', progress: () => [stat('stories'), 5] },
    { id: 'gamer', icon: '🎮', title: "O'yinchi", desc: "20 ta o'yin o'ynang", progress: () => [stat('games'), 20] },
    { id: 'unit1', icon: '🗺️', title: 'Birinchi bosqich', desc: 'Kursning bitta bosqich imtihonidan o\'ting', progress: () => [anyUnitDone() ? 1 : 0, 1] },
    { id: 'graduate', icon: '📜', title: 'Bitiruvchi', desc: 'Kurs darajasi sertifikatini oling', progress: () => [certCount(), 1] },
    { id: 'exam_ready', icon: '🎓', title: 'Imtihonga tayyor', desc: "To'liq sinov imtihonidan o'ting", progress: () => [stat('mockPassed'), 1] },
    { id: 'patent', icon: '🛂', title: 'Patentga tayyor', desc: "Patent imtihoni sinovidan o'ting", progress: () => [stat('patentPassed'), 1] },
    { id: 'roleplay', icon: '🎭', title: 'Aktyor', desc: "5 ta rolli vaziyatda maqsadga erishing", progress: () => [stat('roleplayWins'), 5] },
    { id: 'xp1000', icon: '⭐', title: '1000 XP', desc: "Jami 1000 XP to'plang", progress: () => [Learn.totalXp(), 1000] },
  ];

  const earned = () => App.loadStored(BADGES_KEY) || {};

  // Yangi qo'lga kiritilgan nishonlarni saqlaydi va tabriklaydi.
  function check() {
    const have = earned();
    const fresh = [];
    for (const b of BADGES) {
      if (have[b.id]) continue;
      const [cur, need] = b.progress();
      if (cur >= need) {
        have[b.id] = Date.now();
        fresh.push(b);
      }
    }
    if (fresh.length) {
      App.store(BADGES_KEY, have);
      window.Practice.toast(`🏅 Yangi nishon: ${fresh.map((b) => `${b.icon} ${b.title}`).join(', ')}!`, 3500);
    }
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function openBadges() {
    check();
    const have = earned();
    const grid = $('badgeGrid');
    grid.textContent = '';
    const count = BADGES.filter((b) => have[b.id]).length;
    $('badgeCount').textContent = `${count} / ${BADGES.length} ta nishon`;
    for (const b of BADGES) {
      const got = Boolean(have[b.id]);
      const card = el('div', `badge${got ? ' got' : ''}`);
      card.appendChild(el('span', 'badge-icon', got ? b.icon : '🔒'));
      card.appendChild(el('b', '', b.title));
      card.appendChild(el('span', 'badge-desc', b.desc));
      if (!got) {
        const [cur, need] = b.progress();
        const bar = el('div', 'badge-bar');
        const fill = el('div', 'badge-fill');
        fill.style.width = `${Math.min(100, Math.round((cur / need) * 100))}%`;
        bar.appendChild(fill);
        card.append(bar, el('span', 'badge-desc', `${Math.min(cur, need)} / ${need}`));
      }
      grid.appendChild(card);
    }
    App.show('badges');
  }

  // ---------- Reyting ----------

  let tab = 'friends';
  let board = null;

  async function openRating() {
    App.show('rating');
    $('ratingList').textContent = '';
    $('ratingNote').textContent = 'Yuklanmoqda...';
    // Oxirgi XP serverga yetib borsin.
    await window.Store.push();
    try {
      const res = await fetch('/api/leaderboard');
      board = await res.json();
    } catch {
      board = null;
    }
    renderRating();
  }

  function renderRating() {
    document.querySelectorAll('#ratingScreen .pill').forEach((p) => p.classList.toggle('active', p.dataset.tab === tab));
    const list = $('ratingList');
    list.textContent = '';
    $('ratingLogin').hidden = Boolean(board && board.loggedIn);
    if (!board) {
      $('ratingNote').textContent = "Reytingni yuklab bo'lmadi. Internetni tekshiring.";
      return;
    }
    const rows = tab === 'friends' ? board.friends : board.global;
    $('ratingNote').textContent =
      tab === 'friends' && board.loggedIn && rows.length <= 1
        ? "Hali do'stlar yo'q — Akkaunt bo'limidan taklif havolasini yuboring!"
        : `Shu hafta to'plangan XP. Har dushanba yangidan boshlanadi.`;
    rows.forEach((r, i) => {
      const li = el('li', `rank${r.me ? ' me' : ''}`);
      li.appendChild(el('span', 'place', i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)));
      const av = el('span', 'avatar');
      if (r.photoUrl) {
        const img = document.createElement('img');
        img.src = r.photoUrl;
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        av.appendChild(img);
      } else av.textContent = (r.name || '?')[0];
      li.appendChild(av);
      li.appendChild(el('span', 'rank-name', r.me ? `${r.name} (siz)` : r.name));
      li.appendChild(el('b', '', `${r.xp} XP`));
      list.appendChild(li);
    });
    if (!rows.length) list.appendChild(el('li', 'rank empty', "Bu hafta hali hech kim XP to'plamagan — birinchi bo'ling!"));
  }

  document.querySelectorAll('#ratingScreen .pill').forEach((p) =>
    p.addEventListener('click', () => {
      tab = p.dataset.tab;
      renderRating();
    })
  );
  $('ratingLoginBtn').addEventListener('click', () => window.AccountUI.open());
  $('ratingBtn').addEventListener('click', openRating);
  $('badgesBtn').addEventListener('click', openBadges);

  return { check, openBadges, openRating };
})();
