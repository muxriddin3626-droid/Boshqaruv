// "O'rganish": har bir juftlik uchun barcha strategiya va parametrlarni
// tarixda sinab, eng yaxshisini tanlaydi.
//
// Ortiqcha moslashib qolmaslik (overfitting) uchun kuchaytirilgan walk-forward:
//   - 60% ma'lumotda o'rganadi;
//   - keyin bot ko'rmagan IKKI alohida davrda (60–80% va 80–100%) tekshiradi;
//   - ikkala davrda ham foyda bergan strategiyagina tanlanadi, baho — ikki
//     davrning yomonrog'i bo'yicha (omadga emas, barqarorlikka qaraladi).
// Botning o'z savdolarida yutqazgan sozlamalari vaqtincha chetlatiladi (exclude).
const strategies = require('./strategies');
const { backtest } = require('./backtest');
const { atr } = require('./indicators');
const mtfLib = require('./mtf');

const STOPS = [2, 3, 4];
// Katta vaqt oralig'i filtri: o'chiq / 4 soatlik trend / 4s + kunlik trend
const MTF = ['off', '4h', 'both'];
const keyOf = (strategy, params) => `${strategy}:${JSON.stringify(params)}`;

// Bozor holati: Kaufman samaradorlik koeffitsienti + volatillik
function regime(candles, n = 100) {
  const c = candles.slice(-n);
  const change = Math.abs(c[c.length - 1].close - c[0].close);
  let path = 0;
  for (let i = 1; i < c.length; i++) path += Math.abs(c[i].close - c[i - 1].close);
  const er = path ? change / path : 0;
  const dir = c[c.length - 1].close > c[0].close ? 'o\'sish' : 'tushish';
  const a = atr(candles, 14)[candles.length - 1] / candles[candles.length - 1].close;
  const vol = a > 0.03 ? 'juda volatil' : a > 0.012 ? 'volatil' : 'tinch';
  if (er > 0.3) return `trend (${dir}), ${vol}`;
  return `yon bozor (flet), ${vol}`;
}

function learn(candles, { fee = 0.001, minTrades = 3, exclude = [] } = {}) {
  const n = candles.length;
  const s1 = Math.floor(n * 0.6);
  const s2 = Math.floor(n * 0.8);
  const atrs = atr(candles, 14);
  const mtf = mtfLib.prepare(candles);
  const banned = new Set(exclude);
  const results = [];

  for (const st of strategies) {
    const cands = [];
    for (const base of st.paramGrid()) {
      const ind = st.prepare(candles, base);
      for (const stopAtr of STOPS)
        for (const m of MTF) {
          const params = { ...base, stopAtr, mtf: m };
          if (banned.has(keyOf(st.name, params))) continue;
          const train = backtest(st, candles, params, { fee, to: s1, ind, atr: atrs, mtf });
          if (train.trades < minTrades || train.ret <= 0) continue;
          cands.push({ st, params, ind, train });
        }
    }
    cands.sort((a, b) => b.train.score - a.train.score);
    for (const c of cands.slice(0, 8)) {
      const v1 = backtest(c.st, candles, c.params, { fee, from: s1, to: s2, ind: c.ind, atr: atrs, mtf });
      const v2 = backtest(c.st, candles, c.params, { fee, from: s2, ind: c.ind, atr: atrs, mtf });
      const test = {
        ret: (1 + v1.ret) * (1 + v2.ret) - 1,
        maxDD: Math.max(v1.maxDD, v2.maxDD),
        trades: v1.trades + v2.trades,
        winRate: (v1.winRate * v1.trades + v2.winRate * v2.trades) / Math.max(1, v1.trades + v2.trades),
        score: Math.min(v1.score, v2.score),
        folds: [v1.ret, v2.ret],
      };
      results.push({ strategy: c.st.name, title: c.st.title, params: c.params, key: keyOf(c.st.name, c.params), train: c.train, test });
    }
  }

  const buyHold = candles[n - 1].close / candles[s1].close - 1;
  const ok = results
    .filter((r) => r.test.folds[0] > 0 && r.test.folds[1] > 0 && r.test.trades >= 2)
    .sort((a, b) => b.test.score - a.test.score);

  return { best: ok[0] || null, ranking: ok.slice(0, 5), buyHold, tested: results.length, regime: regime(candles) };
}

module.exports = { learn, keyOf };
