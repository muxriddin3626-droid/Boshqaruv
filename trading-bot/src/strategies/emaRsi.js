// 1) Trend strategiyasi: tez EMA sekin EMA'ni pastdan kesib o'tsa va RSI
// haddan tashqari "qizib ketmagan" bo'lsa — sotib olish. Teskari kesishishda sotish.
const { ema, rsi } = require('../indicators');

module.exports = {
  name: 'ema-rsi',
  title: 'EMA kesishishi + RSI (trend)',
  paramGrid: () => {
    const out = [];
    for (const fast of [8, 12, 20])
      for (const slow of [26, 50, 100])
        for (const rsiMax of [65, 75])
          if (fast < slow) out.push({ fast, slow, rsiMax });
    return out;
  },
  warmup: (p) => p.slow + 2,
  prepare(candles, p) {
    const close = candles.map((c) => c.close);
    return { fast: ema(close, p.fast), slow: ema(close, p.slow), rsi: rsi(close, 14) };
  },
  signal(i, candles, ind, pos, p) {
    const f = ind.fast, s = ind.slow;
    if (f[i - 1] == null || s[i - 1] == null || ind.rsi[i] == null) return null;
    const crossUp = f[i - 1] <= s[i - 1] && f[i] > s[i];
    const crossDown = f[i - 1] >= s[i - 1] && f[i] < s[i];
    if (!pos && crossUp && ind.rsi[i] < p.rsiMax) return 'buy';
    if (pos && crossDown) return 'sell';
    return null;
  },
};
