// Ilova ma'lumotlarini saqlash: brauzerda (localStorage) va — foydalanuvchi kirgan
// bo'lsa — serverda. Har kalitning o'zgargan vaqti yoziladi; server bilan
// sinxronlashda har kalit uchun eng yangisi olinadi.
window.Store = (() => {
  const META_KEY = 'tu-meta';
  const isSynced = (key) => key !== META_KEY && /^(tu-|til-ustoz-settings$|til-ustoz-best-)/.test(key);

  function readRaw(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  function writeRaw(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  let meta = readRaw(META_KEY) || {};
  const saveMeta = () => writeRaw(META_KEY, meta);

  // Avvaldan bor (vaqti yozilmagan) ma'lumotlarga vaqt belgilaymiz.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (isSynced(key) && !meta[key]) meta[key] = 1;
    }
    saveMeta();
  } catch {}

  const listeners = [];
  let loggedIn = false;
  let timer = null;

  function get(key, fallback) {
    const v = readRaw(key);
    return v == null ? fallback : v;
  }

  function set(key, value) {
    writeRaw(key, value);
    if (isSynced(key)) {
      meta[key] = Date.now();
      saveMeta();
      schedule();
    }
  }

  function snapshot() {
    const out = {};
    for (const key of Object.keys(meta)) {
      const v = readRaw(key);
      if (v != null) out[key] = { v, t: meta[key] };
    }
    return out;
  }

  // Serverdan kelgan ma'lumotni qo'shadi: yangiroq kalitlar almashtiriladi.
  function apply(remote) {
    let changed = false;
    for (const [key, entry] of Object.entries(remote || {})) {
      if (!isSynced(key) || !entry || typeof entry.t !== 'number') continue;
      if (!meta[key] || entry.t > meta[key]) {
        writeRaw(key, entry.v);
        meta[key] = entry.t;
        changed = true;
      }
    }
    saveMeta();
    if (changed) listeners.forEach((fn) => fn());
  }

  function schedule() {
    if (!loggedIn) return;
    clearTimeout(timer);
    timer = setTimeout(push, 2500);
  }

  async function push() {
    clearTimeout(timer);
    timer = null;
    if (!loggedIn || !navigator.onLine) return;
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: snapshot() }),
      });
      if (res.ok) apply((await res.json()).data);
    } catch {}
  }

  async function pull() {
    try {
      const res = await fetch('/api/state');
      if (res.ok) apply((await res.json()).data);
    } catch {}
    await push();
  }

  function setLoggedIn(value) {
    loggedIn = value;
    if (value) pull();
  }

  // Sahifa yopilayotganda yuborilmagan o'zgarishlarni jo'natib qolamiz.
  window.addEventListener('pagehide', () => {
    if (loggedIn && timer && navigator.sendBeacon) {
      navigator.sendBeacon('/api/state', new Blob([JSON.stringify({ data: snapshot() })], { type: 'application/json' }));
    }
  });
  window.addEventListener('online', () => loggedIn && push());

  return { get, set, onChange: (fn) => listeners.push(fn), setLoggedIn, push, pull };
})();
