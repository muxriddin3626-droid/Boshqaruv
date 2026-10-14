// Ilovani telefonga o'rnatish va oflayn holat.
(() => {
  const $ = (id) => document.getElementById(id);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  // Internet holati: yo'q bo'lsa tepada ogohlantirish chiqadi.
  const banner = $('offlineBanner');
  const updateOnline = () => {
    banner.hidden = navigator.onLine;
  };
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  // "Ilovani o'rnatish" tugmasi (Android Chrome) va iPhone uchun yo'riqnoma.
  const btn = $('installBtn');
  let deferred = null;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });

  if (ios && !standalone) btn.hidden = false;

  btn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      if (choice && choice.outcome === 'accepted') btn.hidden = true;
      deferred = null;
    } else if (ios) {
      window.Practice.toast("iPhone: pastdagi «Ulashish» ⬆️ tugmasini bosing → «Bosh ekranga qo'shish»", 5000);
    }
  });

  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    window.Practice.toast("📲 Ilova o'rnatildi! Endi bosh ekrandan oching.");
  });
})();
