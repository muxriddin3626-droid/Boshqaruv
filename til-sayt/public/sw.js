// Oflayn ishlash: sayt fayllari telefonda saqlanadi, internet bo'lmasa ham ochiladi.
// Takrorlash, daftar, kurs xaritasi va natijalar internetsiz ishlaydi; ustoz bilan
// suhbat, o'yin va imtihonlar uchun internet kerak.
const CACHE = 'til-ustoz-v10';
const FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/store.js',
  '/course.js',
  '/exams.js',
  '/learn.js',
  '/face.js',
  '/app.js',
  '/games.js',
  '/practice.js',
  '/hangul.js',
  '/themes.js',
  '/plans.js',
  '/vocab.js',
  '/exam.js',
  '/cert.js',
  '/account-ui.js',
  '/social.js',
  '/roles.js',
  '/survey.js',
  '/scenarios.js',
  '/pwa.js',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Server so'rovlari: faqat internet orqali; internet bo'lmasa tushunarli javob.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ error: "Internet yo'q.", offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          })
      )
    );
    return;
  }

  // Sayt fayllari: avval internetdan (yangilanishlar darhol keladi), bo'lmasa saqlanganidan.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error()))
      )
  );
});
