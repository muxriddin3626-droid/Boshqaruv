// Ko'p vaqt oralig'i (multi-timeframe) filtri.
// 1 soatlik shamlardan 4 soatlik va kunlik shamlarni yasaydi va katta
// trend yo'nalishini aniqlaydi. Faqat YOPILGAN katta shamlar ishlatiladi —
// kelajakdan "ko'z tashlash" yo'q, shuning uchun tarixiy sinov halol.
const { ema } = require('./indicators');

const H4 = 4 * 3600e3;
const D1 = 24 * 3600e3;

// candles -> har bir kichik sham uchun: shu paytgacha yopilgan katta shamda
// narx EMA'dan yuqorimi (true), pastmi (false) yoki ma'lumot yetarli emas (null)
function trendSeries(candles, bucketMs, period) {
  const closes = [];
  const bucketOfClose = []; // har bir katta shamning yopilish chegarasi
  let cur = null;
  for (const c of candles) {
    const b = Math.floor(c.time / bucketMs);
    if (b !== cur) {
      closes.push(c.close);
      bucketOfClose.push(b);
      cur = b;
    } else {
      closes[closes.length - 1] = c.close;
    }
  }
  const e = ema(closes, period);
  const out = new Array(candles.length).fill(null);
  const tf = candles.length > 1 ? candles[1].time - candles[0].time : bucketMs;
  let k = 0;
  for (let i = 0; i < candles.length; i++) {
    const b = Math.floor(candles[i].time / bucketMs);
    // joriy katta sham hali yopilmagan bo'lsa oldingisiga qaraymiz; agar
    // kichik sham katta shamni yopsa (masalan 03:00–04:00), u ham hisobga olinadi
    const lastInBucket = Math.floor((candles[i].time + tf) / bucketMs) !== b;
    while (k < bucketOfClose.length && bucketOfClose[k] < b) k++;
    const idx = lastInBucket ? k : k - 1;
    if (idx >= 0 && e[idx] != null) out[i] = closes[idx] > e[idx];
  }
  return out;
}

function prepare(candles) {
  return { h4: trendSeries(candles, H4, 50), d1: trendSeries(candles, D1, 20) };
}

// mode: 'off' — filtr yo'q; '4h' — 4 soatlik trend o'sishda bo'lsin;
// 'both' — 4 soatlik va kunlik trend ikkalasi ham o'sishda bo'lsin
function allows(mtf, i, mode) {
  if (!mode || mode === 'off') return true;
  if (mode === '4h') return mtf.h4[i] === true;
  return mtf.h4[i] === true && mtf.d1[i] === true;
}

function describe(mtf, i) {
  const t = (v) => (v == null ? "noma'lum" : v ? "o'sish ↑" : 'tushish ↓');
  return `4s: ${t(mtf.h4[i])}, kunlik: ${t(mtf.d1[i])}`;
}

module.exports = { prepare, allows, describe, trendSeries };
