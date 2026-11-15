// 4) Likvidlik ovi (stop-hunt reversal): yirik o'yinchilar narxni pastga
// "sanchib" stop-losslarni yig'gandan keyin narx odatda qaytadi. Bot shu
// qaytishda kiradi. Tarixda sinalib, faqat ishlasa tanlanadi.
const { atr, sma } = require('../indicators');
const { candleFlags } = require('../manipulation');

module.exports = {
  name: 'sweep',
  title: "Likvidlik ovi (manipulyatsiyadan keyingi qaytish)",
  paramGrid: () => {
    const out = [];
    for (const takeProfitAtr of [1.5, 3, 5])
      for (const maxBars of [12, 48]) out.push({ takeProfitAtr, maxBars });
    return out;
  },
  warmup: () => 60,
  prepare(candles) {
    const a = atr(candles, 14);
    const vol = sma(candles.map((c) => c.volume), 48);
    const sig = candles.map((_, i) => (i < 60 ? [] : candleFlags(candles, i, { atr: a, vol }).map((f) => f.type)));
    return { atr: a, sig };
  },
  signal(i, candles, ind, pos, p) {
    if (!pos) return ind.sig[i].includes('stop_hunt_down') ? 'buy' : null;
    const a = ind.atr[pos.entryIndex] || ind.atr[i];
    if (candles[i].close >= pos.entryPrice + p.takeProfitAtr * a) return 'sell';
    if (i - pos.entryIndex >= p.maxBars) return 'sell';
    if (ind.sig[i].includes('stop_hunt_up')) return 'sell';
    return null;
  },
};
