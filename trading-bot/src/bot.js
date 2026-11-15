// To'liq avtomatik trading bot.
// Har bir juftlik uchun: bozorni o'rganadi -> eng yaxshi strategiyani tanlaydi ->
// yangi sham yopilganda signal tekshiradi -> xavf qoidalari bo'yicha savdo qiladi.
const fs = require('fs');
const cfg = require('./config');
const strategies = require('./strategies');
const { learn } = require('./learner');
const { atr } = require('./indicators');
const { createExchange, fetchCandles, Broker } = require('./exchange');
const telegram = require('./telegram');

const byName = Object.fromEntries(strategies.map((s) => [s.name, s]));
const pct = (x) => `${(x * 100).toFixed(2)}%`;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(cfg.stateFile, 'utf8'));
  } catch {
    return { positions: {}, models: {}, lastCandle: {}, paused: false, day: null, dayStartEquity: null, history: [] };
  }
}
const state = loadState();
const save = () => fs.writeFileSync(cfg.stateFile, JSON.stringify(state, null, 2));

const ex = createExchange(cfg);
const broker = new Broker(ex, cfg, state);
const log = (msg) => {
  console.log(new Date().toISOString(), msg);
  telegram.send(msg);
};

const lastPrices = {};

async function equity() {
  let total = await broker.cash(cfg.symbols[0]);
  for (const [sym, p] of Object.entries(state.positions)) total += p.qty * (lastPrices[sym] || p.entryPrice);
  return total;
}

async function relearn(symbol, candles) {
  const r = learn(candles, { fee: cfg.fee });
  state.models[symbol] = r.best
    ? { strategy: r.best.strategy, params: r.best.params, test: r.best.test, at: Date.now() }
    : { strategy: null, at: Date.now() };
  save();
  if (r.best) {
    log(
      `🧠 ${symbol}: bozor o'rganildi (${r.tested} variant sinaldi).\n` +
        `Tanlandi: ${r.best.title}\nParametrlar: ${JSON.stringify(r.best.params)}\n` +
        `Ko'rilmagan davrdagi natija: ${pct(r.best.test.ret)}, maks. tushish ${pct(r.best.test.maxDD)}, ` +
        `${r.best.test.trades} savdo (shu davrda "sotib olib kutish": ${pct(r.buyHold)})`
    );
  } else {
    log(`🧠 ${symbol}: hech bir strategiya hozirgi bozorda ishonchli foyda ko'rsatmadi — yangi savdo ochilmaydi, kutaman.`);
  }
}

async function checkDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.day !== today) {
    state.day = today;
    state.dayStartEquity = await equity();
    state.dailyHalt = false;
    save();
  }
  const eq = await equity();
  if (!state.dailyHalt && eq < state.dayStartEquity * (1 - cfg.dailyLossLimit)) {
    state.dailyHalt = true;
    save();
    log(`🛑 Kunlik zarar chegarasi (${pct(cfg.dailyLossLimit)}) oshdi. Bugun yangi savdo ochilmaydi.`);
  }
}

async function closePosition(symbol, price, reason) {
  const p = state.positions[symbol];
  const r = await broker.sell(symbol, p.qty, price);
  const pnl = r.got - p.cost;
  state.history.push({ symbol, entry: p.entryPrice, exit: r.price, pnl, reason, at: Date.now() });
  delete state.positions[symbol];
  save();
  log(`${pnl >= 0 ? '✅' : '❌'} SOTILDI ${symbol} @ ${r.price} (${reason}). Natija: ${pnl.toFixed(2)} USDT`);
}

async function onNewCandle(symbol, candles) {
  const model = state.models[symbol];
  const i = candles.length - 1;
  const price = candles[i].close;
  const pos = state.positions[symbol];

  if (!model || !model.strategy) {
    // Model yo'q yoki bozor noqulay: ochiq pozitsiyani faqat stop himoya qiladi
    return;
  }
  const st = byName[model.strategy];
  const ind = st.prepare(candles, model.params);
  const sig = st.signal(i, candles, ind, pos, model.params);

  if (sig === 'sell' && pos) return closePosition(symbol, price, 'strategiya signali');

  if (sig === 'buy' && !pos && !state.paused && !state.dailyHalt) {
    const a = atr(candles, 14)[i];
    if (!a) return;
    const stop = price - model.params.stopAtr * a;
    const eq = await equity();
    const riskAmount = eq * cfg.riskPerTrade;
    let spend = (riskAmount / (price - stop)) * price;
    spend = Math.min(spend, eq * cfg.maxPosition, (await broker.cash(symbol)) * 0.99);
    if (spend < 10) return log(`⚠️ ${symbol}: sotib olish signali bor, lekin mablag' yetarli emas.`);
    const r = await broker.buy(symbol, spend, price);
    state.positions[symbol] = { qty: r.qty, entryPrice: r.price, stop, cost: spend, strategy: model.strategy, at: Date.now() };
    save();
    log(
      `🟢 SOTIB OLINDI ${symbol} @ ${r.price}\nSumma: ${spend.toFixed(2)} USDT, stop: ${stop.toFixed(4)} ` +
        `(${pct((price - stop) / price)} pastda)\nStrategiya: ${st.title}`
    );
  }
}

async function tick() {
  await checkDay();
  for (const symbol of cfg.symbols) {
    try {
      const ticker = await ex.fetchTicker(symbol);
      lastPrices[symbol] = ticker.last;
      const pos = state.positions[symbol];
      if (pos && ticker.last <= pos.stop) {
        await closePosition(symbol, ticker.last, 'stop-loss');
      }

      const candles = await fetchCandles(ex, symbol, cfg.timeframe, cfg.history);
      if (candles.length < 300) continue;
      const lastT = candles[candles.length - 1].time;
      if (state.lastCandle[symbol] === lastT) continue; // yangi sham yo'q
      state.lastCandle[symbol] = lastT;

      const m = state.models[symbol];
      if (!m || Date.now() - m.at > cfg.relearnHours * 3600e3 || state.forceRelearn) {
        await relearn(symbol, candles);
      }
      await onNewCandle(symbol, candles);
    } catch (e) {
      console.error(symbol, e.message);
    }
  }
  state.forceRelearn = false;
  save();
}

async function statusText() {
  const eq = await equity();
  const lines = [
    `📊 Rejim: ${cfg.mode === 'paper' ? 'SINOV (xayoliy pul)' : 'HAQIQIY'} | Birja: ${cfg.exchange}`,
    `Umumiy balans: ${eq.toFixed(2)} USDT${state.paused ? ' | ⏸ to\'xtatilgan' : ''}${state.dailyHalt ? ' | 🛑 kunlik limit' : ''}`,
  ];
  for (const s of cfg.symbols) {
    const m = state.models[s];
    const p = state.positions[s];
    lines.push(
      `\n${s}: ${m ? (m.strategy ? byName[m.strategy].title : 'kutmoqda (bozor noqulay)') : "hali o'rganilmagan"}` +
        (p ? `\n  Pozitsiya: ${p.qty.toFixed(6)} @ ${p.entryPrice}, hozir ${lastPrices[s] ?? '?'}, stop ${p.stop.toFixed(4)}` : '')
    );
  }
  const closed = state.history;
  if (closed.length) {
    const total = closed.reduce((a, t) => a + t.pnl, 0);
    const wins = closed.filter((t) => t.pnl > 0).length;
    lines.push(`\nYopilgan savdolar: ${closed.length}, yutuq: ${wins}, jami: ${total.toFixed(2)} USDT`);
  }
  return lines.join('\n');
}

telegram.start(cfg, {
  status: statusText,
  pause: () => { state.paused = true; save(); },
  resume: () => { state.paused = false; save(); },
  relearn: () => { state.forceRelearn = true; for (const s of cfg.symbols) delete state.lastCandle[s]; save(); },
  sellAll: async () => { for (const s of Object.keys(state.positions)) await closePosition(s, lastPrices[s], "qo'lda"); },
});

(async () => {
  log(`🤖 Bot ishga tushdi. Rejim: ${cfg.mode === 'paper' ? 'SINOV (xayoliy pul)' : 'HAQIQIY PUL'}. Juftliklar: ${cfg.symbols.join(', ')}`);
  for (;;) {
    try {
      await tick();
    } catch (e) {
      console.error('tick xatosi:', e.message);
    }
    await new Promise((r) => setTimeout(r, cfg.checkSeconds * 1000));
  }
})();
