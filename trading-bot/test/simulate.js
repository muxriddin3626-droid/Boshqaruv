// Internetsiz sinov: sun'iy bozor (trend, flet, qulash) yaratib, o'rganish
// tizimi va botning to'liq siklini soxta birja bilan tekshiradi.
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}
function makeMarket(n, seed, regimes) {
  const r = rng(seed);
  const out = [];
  let p = 100;
  const H = 3600e3;
  const t0 = Math.floor(Date.now() / H) * H - n * H;
  for (let i = 0; i < n; i++) {
    const reg = regimes[Math.floor((i / n) * regimes.length)];
    let drift = 0;
    if (reg === 'up') drift = 0.0015;
    if (reg === 'down') drift = -0.0015;
    if (reg === 'range') drift = (100 - p) / p * 0.05;
    const o = p;
    p = p * (1 + drift + 0.008 * gauss(r));
    const hi = Math.max(o, p) * (1 + Math.abs(0.003 * gauss(r)));
    const lo = Math.min(o, p) * (1 - Math.abs(0.003 * gauss(r)));
    out.push({ time: t0 + i * H, open: o, high: hi, low: lo, close: p, volume: 1 });
  }
  return out;
}

// 1) Indikatorlar
const { ema, rsi, sma } = require('../src/indicators');
assert.deepStrictEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
assert.strictEqual(ema([1, 1, 1, 1], 2)[3], 1);
assert.strictEqual(rsi([1, 2, 3, 4, 5, 6], 3)[5], 100);
console.log('✓ indikatorlar');

// 2) O'rganish turli bozorlarda
const { learn } = require('../src/learner');
for (const [name, reg] of [['trend', ['up', 'up', 'range', 'up']], ['flet', ['range']], ['qulash', ['up', 'down', 'down']]]) {
  const c = makeMarket(1500, 7, reg);
  const r = learn(c);
  console.log(`✓ ${name}: ${r.tested} variant; tanlandi: ${r.best ? `${r.best.strategy} (tekshiruv ${(r.best.test.ret * 100).toFixed(1)}%)` : "hech biri — kutadi"}; buy&hold ${(r.buyHold * 100).toFixed(1)}%`);
  if (r.best) assert(r.best.test.ret > 0);
}

// 3) Botning to'liq sikli soxta birja bilan (paper rejim)
const market = makeMarket(1600, 7, ['range']);
let cursor = 1200; // har chaqiruvda bir sham oldinga suriladi
class FakeEx {
  constructor() {}
  setSandboxMode() {}
  parseTimeframe() { return 3600; }
  async fetchTicker() { return { last: market[cursor - 1].close }; }
  async fetchOHLCV() {
    cursor = Math.min(cursor + 1, market.length);
    // vaqtni hozirgi kunga moslab qaytaramiz, oxirgi sham "yopilgan" bo'lishi uchun
    const shift = Date.now() - 3600e3 * 2 - market[cursor - 1].time;
    return market.slice(0, cursor).map((k) => [k.time + shift, k.open, k.high, k.low, k.close, 1]);
  }
}
require.cache[require.resolve('ccxt')] = { id: 'ccxt', filename: 'ccxt', loaded: true, exports: { fake: FakeEx } };
const stateFile = path.join(os.tmpdir(), `tb-state-${process.pid}.json`);
Object.assign(process.env, { EXCHANGE: 'fake', MODE: 'paper', SYMBOLS: 'FAKE/USDT', CHECK_SECONDS: '0.001', STATE_FILE: stateFile, TELEGRAM_BOT_TOKEN: '', HISTORY: '1000' });
const logs = [];
const origLog = console.log;
console.log = (...a) => logs.push(a.join(' '));
require('../src/bot');
setTimeout(() => {
  console.log = origLog;
  const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  fs.unlinkSync(stateFile);
  assert(st.models['FAKE/USDT'], "model o'rganilmadi");
  const buys = logs.filter((l) => l.includes('SOTIB OLINDI')).length;
  const sells = logs.filter((l) => l.includes('SOTILDI')).length;
  const pos = Object.values(st.positions).reduce((a, p) => a + p.qty * market[cursor - 1].close, 0);
  console.log(`✓ bot sikli: ${cursor - 1200} sham o'tdi, ${buys} xarid, ${sells} sotuv, balans ${(st.paperCash + pos).toFixed(2)} USDT (boshida 1000)`);
  assert(st.paperCash >= 0, 'balans manfiy');
  assert(buys > 0, 'bot hech savdo qilmadi');
  console.log('\nBarcha sinovlar o\'tdi.');
  process.exit(0);
}, 4000);
