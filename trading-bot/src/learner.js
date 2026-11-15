// "O'rganish": har bir juftlik uchun barcha strategiya va parametrlarni
// tarixda sinab, eng yaxshisini tanlaydi. Ortiqcha moslashib qolmaslik uchun
// walk-forward usuli: 70% ma'lumotda o'rganadi, qolgan 30% da (bot hali
// ko'rmagan davrda) tekshiradi. Ikkalasida ham foyda bermasa — savdo qilmaydi.
const strategies = require('./strategies');
const { backtest } = require('./backtest');
const { atr } = require('./indicators');

const STOPS = [2, 3, 4];

function learn(candles, { fee = 0.001, trainRatio = 0.7, minTrades = 3 } = {}) {
  const split = Math.floor(candles.length * trainRatio);
  const atrs = atr(candles, 14);
  const results = [];

  for (const st of strategies) {
    const cands = [];
    for (const base of st.paramGrid()) {
      const ind = st.prepare(candles, base);
      for (const stopAtr of STOPS) {
        const params = { ...base, stopAtr };
        const train = backtest(st, candles, params, { fee, to: split, ind, atr: atrs });
        if (train.trades < minTrades || train.ret <= 0) continue;
        cands.push({ st, params, ind, train });
      }
    }
    cands.sort((a, b) => b.train.score - a.train.score);
    for (const c of cands.slice(0, 5)) {
      const test = backtest(c.st, candles, c.params, { fee, from: split, ind: c.ind, atr: atrs });
      results.push({ strategy: c.st.name, title: c.st.title, params: c.params, train: c.train, test });
    }
  }

  const buyHold = candles[candles.length - 1].close / candles[split].close - 1;
  const ok = results
    .filter((r) => r.test.ret > 0 && r.test.trades >= 1)
    .sort((a, b) => b.test.score - a.test.score);

  return { best: ok[0] || null, ranking: ok.slice(0, 5), buyHold, tested: results.length };
}

module.exports = { learn };
