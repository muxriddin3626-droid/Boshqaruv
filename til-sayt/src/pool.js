// Umumiy materiallar ombori: bir marta tuzilgan grammatika kartochkasi, lug'at to'plami, daraja testi,
// imtihon bo'limi va o'yinlar bazada saqlanadi va keyingi o'quvchilarga AI'siz (bepul) beriladi.
// Ombor to'lguncha yangi variantlar tuziladi, keyin tayyorlaridan tasodifiy tanlanadi.
const db = require('./db');

const cache = new Map(); // `${kind}|${key}` -> [{ id, data }]
const stats = { hits: 0, misses: 0 };

async function list(kind, key) {
  const k = `${kind}|${key}`;
  if (!cache.has(k)) cache.set(k, await db.poolList(kind, key));
  return cache.get(k);
}

// Ombordan mos variant: { id, data } yoki null (yangi tuzish kerak).
// target — omborda nechta variant bo'lishi kerak; accept(item) — shu o'quvchiga mosmi.
async function take(kind, key, { target = 1, accept = () => true } = {}) {
  const items = await list(kind, key);
  const ok = items.filter(accept);
  // Ombor hali to'lmagan bo'lsa — ba'zan yangi variant tuzamiz (xilma-xillik uchun), aks holda tayyoridan.
  if (!ok.length || (items.length < target && Math.random() < 0.5)) {
    stats.misses++;
    return null;
  }
  stats.hits++;
  return ok[Math.floor(Math.random() * ok.length)];
}

async function add(kind, key, data, max = 30) {
  const items = await list(kind, key);
  if (items.length >= max) return null;
  const id = await db.poolAdd(kind, key, data);
  items.push({ id, data });
  return id;
}

module.exports = { take, add, list, stats };
