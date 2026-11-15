// Yirik o'yinchilar (banklar, "kitlar", market-meykerlar) manipulyatsiyasini
// aniqlash. Bu 100% aniq emas — ehtimoliy belgilar. Bot ulardan himoya uchun
// foydalanadi: shubhali holatda sotib olmaydi.
const { atr, sma } = require('./indicators');

// Shamlar bo'yicha belgilar (oxirgi yopilgan sham uchun yoki istalgan i uchun)
function candleFlags(candles, i, pre) {
  const a = (pre?.atr || atr(candles, 14))[i];
  const vAvg = (pre?.vol || sma(candles.map((c) => c.volume), 48))[i - 1];
  if (!a || !vAvg || i < 50) return [];
  const c = candles[i];
  const flags = [];
  const volX = c.volume / vAvg;

  let lo = Infinity, hi = -Infinity;
  for (let j = i - 24; j < i; j++) {
    lo = Math.min(lo, candles[j].low);
    hi = Math.max(hi, candles[j].high);
  }

  // Stop-ov (liquidity sweep): narx oxirgi 24 shamning eng past nuqtasidan
  // keskin pastga "sanchib", stop-losslarni yig'ib, yana yuqorida yopiladi.
  if (c.low < lo - 0.3 * a && c.close > lo && volX > 1.5) {
    flags.push({ type: 'stop_hunt_down', severity: 'info', text: `Pastga stop-ov: narx ${lo.toFixed(4)} dan pastga sanchib, qaytib yopildi (hajm x${volX.toFixed(1)}). Ko'pincha keyin o'sish bo'ladi.` });
  }
  if (c.high > hi + 0.3 * a && c.close < hi && volX > 1.5) {
    flags.push({ type: 'stop_hunt_up', severity: 'warn', text: `Yuqoriga stop-ov: narx ${hi.toFixed(4)} dan yuqoriga chiqib, qaytib tushdi (hajm x${volX.toFixed(1)}). Soxta o'sish (bull trap) belgisi.` });
  }

  // Pamp: oxirgi 3 shamda juda tez o'sish + g'ayritabiiy hajm
  const move3 = c.close - candles[i - 3].close;
  let vol3 = 0;
  for (let j = i - 2; j <= i; j++) vol3 += candles[j].volume;
  const vol3X = vol3 / 3 / vAvg;
  if (move3 > 4 * a && vol3X > 3) {
    flags.push({ type: 'pump', severity: 'block', text: `Pamp belgisi: 3 shamda +${((move3 / candles[i - 3].close) * 100).toFixed(1)}%, hajm x${vol3X.toFixed(1)}. Cho'qqida sotib olish xavfli.` });
  }
  if (move3 < -4 * a && vol3X > 3) {
    flags.push({ type: 'dump', severity: 'block', text: `Damp belgisi: 3 shamda ${((move3 / candles[i - 3].close) * 100).toFixed(1)}%, hajm x${vol3X.toFixed(1)}. Panik sotuv yoki yirik o'yinchi chiqishi.` });
  }

  // Hajmsiz harakat yoki narx harakatsiz ulkan hajm (wash trading belgisi)
  const body = Math.abs(c.close - c.open);
  if (volX > 6 && body < 0.2 * a) {
    flags.push({ type: 'wash', severity: 'warn', text: `Ulkan hajm (x${volX.toFixed(1)}), lekin narx deyarli qimirlamadi — soxta hajm yoki yashirin yig'ish/tarqatish.` });
  }
  return flags;
}

// Buyurtmalar kitobi (order book) bo'yicha belgilar
function orderBookFlags(book, price) {
  const flags = [];
  if (!book || !book.bids?.length || !book.asks?.length) return flags;
  const near = (lvls) => lvls.filter(([p]) => Math.abs(p - price) / price < 0.02);
  const bids = near(book.bids);
  const asks = near(book.asks);
  const sum = (l) => l.reduce((s, [p, q]) => s + p * q, 0);
  const bidV = sum(bids);
  const askV = sum(asks);
  if (bidV + askV === 0) return flags;
  const imb = (bidV - askV) / (bidV + askV);

  if (imb > 0.6) flags.push({ type: 'bid_wall', severity: 'info', text: `Kitobda xaridorlar ustun (${(imb * 100).toFixed(0)}% nomutanosiblik).` });
  if (imb < -0.6) flags.push({ type: 'ask_wall', severity: 'warn', text: `Kitobda sotuvchilar ustun (${(-imb * 100).toFixed(0)}% nomutanosiblik) — narx bosim ostida.` });

  // Spoofing: bitta daraja qolganlardan 8 barobar katta "devor"
  const all = [...bids.map((l) => ['bid', ...l]), ...asks.map((l) => ['ask', ...l])];
  const sizes = all.map(([, p, q]) => p * q).sort((x, y) => x - y);
  const median = sizes[Math.floor(sizes.length / 2)] || 0;
  for (const [side, p, q] of all) {
    if (median > 0 && p * q > 8 * median && p * q > 0.25 * (bidV + askV)) {
      flags.push({
        type: side === 'bid' ? 'spoof_bid' : 'spoof_ask',
        severity: 'warn',
        text: `${side === 'bid' ? 'Xarid' : 'Sotuv'} tomonida ${p} narxda shubhali katta devor (${(p * q).toFixed(0)} USDT) — spoofing bo'lishi mumkin.`,
      });
      break;
    }
  }
  return flags;
}

module.exports = { candleFlags, orderBookFlags };
