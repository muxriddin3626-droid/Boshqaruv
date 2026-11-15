// 3) DCA / tushishda sotib olish: narx yaqindagi eng yuqori nuqtadan ma'lum
// foizga tushganda va RSI past bo'lsa sotib oladi, belgilangan foyda bilan sotadi.
const { rsi } = require('../indicators');

module.exports = {
  name: 'dca',
  title: 'DCA / tushishda sotib olish',
  paramGrid: () => {
    const out = [];
    for (const dropPct of [3, 6, 10])
      for (const takeProfitPct of [2, 4, 8])
        for (const lookback of [48, 168]) out.push({ dropPct, takeProfitPct, lookback });
    return out;
  },
  warmup: (p) => p.lookback + 1,
  prepare(candles) {
    return { rsi: rsi(candles.map((c) => c.close), 14) };
  },
  signal(i, candles, ind, pos, p) {
    const price = candles[i].close;
    if (pos) return price >= pos.entryPrice * (1 + p.takeProfitPct / 100) ? 'sell' : null;
    if (i < p.lookback || ind.rsi[i] == null) return null;
    let high = 0;
    for (let j = i - p.lookback; j < i; j++) high = Math.max(high, candles[j].high);
    if (price <= high * (1 - p.dropPct / 100) && ind.rsi[i] < 35) return 'buy';
    return null;
  },
};
