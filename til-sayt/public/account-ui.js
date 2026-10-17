// Akkaunt oynasi: Telegram, Google yoki telefon raqam orqali kirish, Premium, kunlik limitlar va do'stlarni taklif qilish.
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

  const loginOn = () => Boolean(config.telegramBot || config.googleClientId || config.phoneLogin);

  // Kirish tugmalarini (Telegram, Google, telefon) kerakli joylarga qo'yamiz.
  function renderLoginButtons() {
    document.querySelectorAll('[data-login-slot]').forEach((slot) => {
      slot.textContent = '';
      if (me.user) return;
      if (config.telegramBot) {
        const tg = document.createElement('div');
        tg.className = 'tg-slot';
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://telegram.org/js/telegram-widget.js?22';
        s.setAttribute('data-telegram-login', config.telegramBot);
        s.setAttribute('data-size', 'large');
        s.setAttribute('data-radius', '12');
        s.setAttribute('data-onauth', 'TUonTelegramAuth(user)');
        s.setAttribute('data-request-access', 'write');
        tg.appendChild(s);
        slot.appendChild(tg);
      }
      if (config.googleClientId) {
        const g = document.createElement('div');
        g.className = 'g-slot';
        slot.appendChild(g);
        renderGoogle(g);
      }
      if (config.phoneLogin) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary phone-btn';
        b.textContent = '📱 Telefon raqam bilan';
        b.addEventListener('click', openPhone);
        slot.appendChild(b);
      }
    });
  }

  // Har qanday usulda kirgandan keyingi umumiy qadam. Xatoni chaqiruvchiga qaytaradi.
  async function completeLogin(path, payload) {
    let ref = null;
    try {
      ref = localStorage.getItem(REF_KEY);
    } catch {}
    const r = await App.postJson(path, { ...payload, ref });
    try {
      localStorage.removeItem(REF_KEY);
    } catch {}
    window.Practice.toast(
      r.bonus ? `🎉 Xush kelibsiz, ${r.user.firstName}! Taklif uchun ${r.bonus} kun Premium sovg'a!` : `👋 Xush kelibsiz, ${r.user.firstName}!`,
      3500
    );
    await refresh();
    window.Store.setLoggedIn(true);
    return r;
  }

  window.TUonTelegramAuth = (user) => completeLogin('/api/auth/telegram', { user }).catch((err) => window.Practice.toast(err.message));

  // ---------- Google ----------

  let googleReady = null;

  function loadGoogle() {
    if (!googleReady) {
      googleReady = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = () => {
          window.google.accounts.id.initialize({
            client_id: config.googleClientId,
            callback: (resp) =>
              completeLogin('/api/auth/google', { credential: resp.credential }).catch((err) => window.Practice.toast(err.message)),
          });
          resolve(window.google.accounts.id);
        };
        s.onerror = () => {
          googleReady = null;
          reject(new Error('Google yuklanmadi'));
        };
        document.head.appendChild(s);
      });
    }
    return googleReady;
  }

  function renderGoogle(box) {
    loadGoogle()
      .then((gid) =>
        gid.renderButton(box, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 260, locale: 'uz' })
      )
      .catch(() => {});
  }

  // ---------- Telefon raqam (SMS kod) ----------

  const phone = { number: '', step: 1, timer: null };

  function phoneError(text) {
    $('phoneError').textContent = text || '';
    $('phoneError').hidden = !text;
  }

  function setPhoneStep(step) {
    phone.step = step;
    $('phoneStep1').hidden = step !== 1;
    $('phoneStep2').hidden = step !== 2;
    $('phoneSubmit').textContent = step === 1 ? 'Kod yuborish' : 'Kirish';
  }

  function openPhone() {
    const d = $('phoneDialog');
    setPhoneStep(1);
    phoneError('');
    $('phoneHint').textContent = config.phoneUzOnly
      ? "O'zbekiston raqamingizga SMS orqali 6 xonali kod yuboramiz."
      : 'Raqamingizga SMS orqali 6 xonali kod yuboramiz.';
    $('phoneCode').value = '';
    if (d.showModal && !d.open) d.showModal();
    $('phoneInput').focus();
  }

  function startResendTimer(seconds) {
    clearInterval(phone.timer);
    let left = seconds;
    const btn = $('phoneResend');
    const tick = () => {
      btn.disabled = left > 0;
      btn.textContent = left > 0 ? `Kodni qayta yuborish (${left})` : 'Kodni qayta yuborish';
      if (left-- <= 0) clearInterval(phone.timer);
    };
    tick();
    phone.timer = setInterval(tick, 1000);
  }

  // 998901234567 → +998 90 123 45 67
  const fmtPhone = (p) => (/^998\d{9}$/.test(p) ? p.replace(/^(998)(\d\d)(\d{3})(\d\d)(\d\d)$/, '+$1 $2 $3 $4 $5') : `+${p}`);

  // Ism alohida so'ralmaydi: anketada yozilgan bo'lsa, o'shani olamiz (yangi akkaunt uchun).
  function surveyName() {
    for (const lang of ['ru', 'de']) {
      const p = window.Survey && window.Survey.profile(lang);
      if (p && p.name) return p.name;
    }
    return '';
  }

  async function sendPhoneCode() {
    const r = await App.postJson('/api/auth/phone/start', { phone: $('phoneInput').value });
    phone.number = r.phone;
    setPhoneStep(2);
    $('phoneHint').textContent = `Kod ${fmtPhone(r.phone)} raqamiga yuborildi. U ${r.minutes} daqiqa amal qiladi.`;
    startResendTimer(r.resendIn);
    $('phoneCode').focus();
  }

  $('phoneForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    phoneError('');
    const btn = $('phoneSubmit');
    btn.disabled = true;
    try {
      if (phone.step === 1) {
        await sendPhoneCode();
      } else {
        const code = $('phoneCode').value.replace(/\D/g, '');
        if (code.length !== 6) throw new Error('Kod 6 ta raqamdan iborat.');
        await completeLogin('/api/auth/phone/verify', { phone: phone.number, code, name: surveyName() });
        clearInterval(phone.timer);
        $('phoneDialog').close();
      }
    } catch (err) {
      phoneError(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('phoneResend').addEventListener('click', async () => {
    phoneError('');
    try {
      await sendPhoneCode();
    } catch (err) {
      phoneError(err.message);
    }
  });

  $('phoneCancel').addEventListener('click', () => {
    clearInterval(phone.timer);
    $('phoneDialog').close();
  });

  // Kod to'liq yozilganda avtomatik yuboramiz.
  $('phoneCode').addEventListener('input', (e) => {
    if (e.target.value.replace(/\D/g, '').length === 6) $('phoneForm').requestSubmit();
  });

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
    bar.hidden = !loginOn() && !me.limits;
    setAvatar($('accountAvatar'), user);
    $('accountName').textContent = user ? user.name : 'Kirish';
    $('accountPlan').textContent = user ? planText() : loginOn() ? "Natijalarni saqlash uchun kiring" : planText();
    $('planBadge').textContent = me.premium ? '⭐ PRO' : me.limits ? 'Bepul' : '';
    $('planBadge').classList.toggle('pro', me.premium);

    $('startLogin').hidden = !loginOn() || Boolean(user);

    // Akkaunt ekrani
    $('loginPanel').hidden = Boolean(user);
    $('loginOff').hidden = loginOn();
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
    $('codeForm').hidden = !loginOn();
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
