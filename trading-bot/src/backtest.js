// Tarixiy shamlarda strategiyani sinash (faqat long, bitta pozitsiya).
// Signal yopilgan sham narxida bajariladi — jonli bot ham xuddi shunday ishlaydi.
const { atr } = require('./indicators');
const mtfLib = require('./mtf');

function backtest(strategy, candles, params, opts = {}) {
  const fee = opts.fee ?? 0.001; // 0.1% har bir tomonga
  const stopAtr = params.stopAtr ?? 3;
  const from = Math.max(opts.from ?? 0, strategy.warmup(params), 15);
  const to = opts.to ?? candles.length;
  const ind = opts.ind || strategy.prepare(candles, params);
  const atrs = opts.atr || atr(candles, 14);
  const mtf = params.mtf && params.mtf !== 'off' ? opts.mtf || mtfLib.prepare(candles) : null;

  let equity = 1;
  let peak = 1;
  let maxDD = 0;
  let pos = null;
  const trades = [];

  const close = (i, price, reason) => {
    const r = (price / pos.entryPrice) * (1 - fee) * (1 - fee) - 1;
    equity *= 1 + r;
    trades.push({ entryIndex: pos.entryIndex, exitIndex: i, ret: r, reason });
    pos = null;
  };

  for (let i = from; i < to; i++) {
    const c = candles[i];
    if (pos && c.low <= pos.stop) {
      close(i, Math.min(c.open, pos.stop), 'stop');
    } else {
      const s = strategy.signal(i, candles, ind, pos, params);
      if (s === 'buy' && !pos && atrs[i] && (!mtf || mtfLib.allows(mtf, i, params.mtf))) {
        pos = { entryPrice: c.close, entryIndex: i, stop: c.close - stopAtr * atrs[i] };
      } else if (s === 'sell' && pos) {
        close(i, c.close, 'signal');
      }
    }
    const mark = pos ? equity * (c.close / pos.entryPrice) : equity;
    peak = Math.max(peak, mark);
    maxDD = Math.max(maxDD, (peak - mark) / peak);
  }
  if (pos) close(to - 1, candles[to - 1].close, 'end');

  const ret = equity - 1;
  const wins = trades.filter((t) => t.ret > 0).length;
  return {
    ret,
    maxDD,
    trades: trades.length,
    winRate: trades.length ? wins / trades.length : 0,
    score: ret - 0.5 * maxDD,
  };
}

module.exports = { backtest };
