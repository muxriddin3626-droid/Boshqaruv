// 2) Grid / oraliq savdosi: narx yon (flet) harakatlanayotganda Bollinger
// oralig'ining pastki chegarasida sotib olib, o'rtasi yoki yuqorisida sotadi.
const { sma, stddev } = require('../indicators');

module.exports = {
  name: 'grid',
  title: 'Grid / oraliq savdosi (yon bozor)',
  paramGrid: () => {
    const out = [];
    for (const period of [20, 40])
      for (const width of [1.5, 2, 2.5])
        for (const exitAt of ['mid', 'upper']) out.push({ period, width, exitAt });
    return out;
  },
  warmup: (p) => p.period + 1,
  prepare(candles, p) {
    const close = candles.map((c) => c.close);
    return { mid: sma(close, p.period), sd: stddev(close, p.period) };
  },
  signal(i, candles, ind, pos, p) {
    const mid = ind.mid[i], sd = ind.sd[i];
    if (mid == null || sd == null) return null;
    const price = candles[i].close;
    const lower = mid - p.width * sd;
    const upper = mid + p.width * sd;
    if (!pos && price < lower) return 'buy';
    if (pos && price >= (p.exitAt === 'mid' ? mid : upper)) return 'sell';
    return null;
  },
};
