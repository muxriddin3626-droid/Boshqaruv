// Akkaunt oynasi: Telegram orqali kirish, Premium, kunlik limitlar va do'stlarni taklif qilish.
window.AccountUI = (() => {
  const App = window.App;
  const $ = (id) => document.getElementById(id);
  const REF_KEY = 'tilustoz-ref'; // taklif kodi (sinxronlanmaydi)
  const KIND_LABELS = { lesson: '🎙️ Ovozli dars', practice: "🎮 O'yin va hikoya", exam: "🎓 Imtihon bo'limi" };

  let config = {};
  let me = { user: null, premium: false, usage: {}, limits: null };

  // Taklif havolasi orqali kelgan bo'lsa, kodni eslab qolamiz.
  try {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref) localStorage.setItem(REF_KEY, ref.toUpperCase().slice(0, 12));
  } catch {}

  const fmtDate = (t) => {
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };

  function setAvatar(el, user) {
    el.textContent = '';
    if (user && user.photoUrl) {
      const img = document.createElement('img');
      img.src = user.photoUrl;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      el.appendChild(img);
    } else {
      el.textContent = user ? (user.firstName || '?')[0].toUpperCase() : '👤';
    }
  }

  // Telegram tugmasini kerakli joylarga qo'yamiz.
  function renderLoginButtons() {
    document.querySelectorAll('[data-tg-slot]').forEach((slot) => {
      slot.textContent = '';
      if (!config.telegramBot || me.user) return;
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://telegram.org/js/telegram-widget.js?22';
      s.setAttribute('data-telegram-login', config.telegramBot);
      s.setAttribute('data-size', 'large');
      s.setAttribute('data-radius', '12');
      s.setAttribute('data-onauth', 'TUonTelegramAuth(user)');
      s.setAttribute('data-request-access', 'write');
      slot.appendChild(s);
    });
  }

  window.TUonTelegramAuth = async (user) => {
    let ref = null;
    try {
      ref = localStorage.getItem(REF_KEY);
    } catch {}
    try {
      const r = await App.postJson('/api/auth/telegram', { user, ref });
      try {
        localStorage.removeItem(REF_KEY);
      } catch {}
      window.Practice.toast(
        r.bonus ? `🎉 Xush kelibsiz, ${r.user.firstName}! Taklif uchun ${r.bonus} kun Premium sovg'a!` : `👋 Xush kelibsiz, ${r.user.firstName}!`,
        3500
      );
      await refresh();
      window.Store.setLoggedIn(true);
    } catch (err) {
      window.Practice.toast(err.message);
    }
  };

  async function refresh() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) me = await res.json();
    } catch {}
    render();
    return me;
  }

  function planText() {
    if (me.premium) return `⭐ Premium · ${fmtDate(me.user.premiumUntil)} gacha`;
    if (!me.limits) return 'Cheksiz (limitlar o\'chirilgan)';
    return 'Bepul reja';
  }

  function render() {
    const user = me.user;
    // Menyu tepasidagi akkaunt qatori
    const bar = $('accountBar');
    bar.hidden = !config.telegramBot && !me.limits;
    setAvatar($('accountAvatar'), user);
    $('accountName').textContent = user ? user.name : 'Kirish';
    $('accountPlan').textContent = user ? planText() : config.telegramBot ? "Natijalarni saqlash uchun kiring" : planText();
    $('planBadge').textContent = me.premium ? '⭐ PRO' : me.limits ? 'Bepul' : '';
    $('planBadge').classList.toggle('pro', me.premium);

    $('startLogin').hidden = !config.telegramBot || Boolean(user);

    // Akkaunt ekrani
    $('loginPanel').hidden = Boolean(user);
    $('loginOff').hidden = Boolean(config.telegramBot);
    $('profilePanel').hidden = !user;
    $('invitePanel').hidden = !user;
    if (user) {
      setAvatar($('profileAvatar'), user);
      $('profileName').textContent = user.name;
      $('ratingToggle').checked = user.showInRating;
      const link = `${location.origin}/?ref=${user.refCode}`;
      $('inviteLink').value = link;
      $('inviteText').textContent =
        `Havolani do'stingizga yuboring. U shu havola orqali kirsa, reytingda do'st bo'lasiz` +
        (config.refBonusDays ? ` va ikkalangiz ${config.refBonusDays} kun Premium olasiz.` : '.') +
        ` Sizning kodingiz: ${user.refCode}`;
    }

    $('planState').textContent = planText();
    const usage = $('usageList');
    usage.textContent = '';
    if (me.limits && !me.premium) {
      for (const [kind, limit] of Object.entries(me.limits)) {
        const used = Math.min(me.usage[kind] || 0, limit);
        const li = document.createElement('li');
        li.textContent = `${KIND_LABELS[kind]}: bugun ${used} / ${limit}`;
        if (used >= limit) li.className = 'full';
        usage.appendChild(li);
      }
    }
    const buy = [];
    if (config.premiumPrice) buy.push(`Narxi: ${config.premiumPrice}.`);
    if (config.premiumContact) buy.push(`Sotib olish uchun yozing: ${config.premiumContact} — to'lovdan keyin sizga kod beriladi.`);
    $('premiumBuy').textContent = buy.join(' ');
    $('premiumBuy').hidden = !buy.length;
    $('codeForm').hidden = !config.telegramBot;
  }

  function open() {
    refresh();
    App.show('account');
  }

  // Server "limit tugadi" degan javob qaytarganda.
  function onLimit() {
    refresh();
    const d = $('limitDialog');
    window.Face.set($('limitFace'), 'surprised');
    if (d.showModal && !d.open) d.showModal();
  }

  $('limitPremium').addEventListener('click', () => {
    $('limitDialog').close();
    open();
  });

  $('accountBar').addEventListener('click', open);

  $('logoutBtn').addEventListener('click', async () => {
    try {
      await App.postJson('/api/auth/logout', {});
    } catch {}
    window.Store.setLoggedIn(false);
    await refresh();
    renderLoginButtons();
    window.Practice.toast("Akkauntdan chiqdingiz. Natijalar shu telefonda qoladi.");
  });

  $('ratingToggle').addEventListener('change', async (e) => {
    try {
      await App.postJson('/api/rating/visibility', { show: e.target.checked });
    } catch (err) {
      window.Practice.toast(err.message);
    }
  });

  $('codeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('codeInput').value.trim();
    if (!code) return;
    try {
      const r = await App.postJson('/api/premium/redeem', { code });
      $('codeInput').value = '';
      window.Practice.toast(`⭐ Premium faollashdi: +${r.days} kun!`, 3500);
      refresh();
    } catch (err) {
      window.Practice.toast(err.message, 3000);
    }
  });

  $('friendForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('friendInput').value.trim();
    if (!code) return;
    try {
      const r = await App.postJson('/api/friends/add', { code });
      $('friendInput').value = '';
      window.Practice.toast(`👥 ${r.name} do'stlaringizga qo'shildi!`);
    } catch (err) {
      window.Practice.toast(err.message);
    }
  });

  $('inviteShare').addEventListener('click', async () => {
    const url = $('inviteLink').value;
    const text = `Men Til Ustoz'da rus va nemis tilini o'rganyapman — ustoz bilan ovozli gaplashib! Qo'shiling: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      window.Practice.toast('🔗 Havola nusxalandi');
    } catch {
      $('inviteLink').select();
    }
  });

  // Ishga tushganda: sozlamalar va foydalanuvchini olamiz.
  App.config().then(async (c) => {
    config = c || {};
    // Admin panelidan qo'yilgan e'lon.
    const ann = $('announceBar');
    ann.textContent = config.announcement || '';
    ann.hidden = !config.announcement;
    await refresh();
    renderLoginButtons();
    if (me.user) window.Store.setLoggedIn(true);
  });

  return { open, onLimit, refresh, me: () => me };
})();
