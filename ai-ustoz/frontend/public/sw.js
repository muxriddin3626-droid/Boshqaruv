/**
 * MODUL 5: Offline Sync — PWA service worker.
 *
 * Faqat ilova "shell"ini (statik sahifa/asset) keshlaydi, shunda offline'da
 * ham ilova ochiladi. Backend API so'rovlariga (`/api/...`) tegilmaydi —
 * ularning offline holatidagi navbatga qo'yilishi frontend JS tomonida
 * (IndexedDB, `lib/offlineDb.ts`) boshqariladi.
 */
const CACHE_NAME = "ai-ustoz-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
