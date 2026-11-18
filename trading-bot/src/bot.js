// To'liq avtomatik trading bot.
// Har bir juftlik uchun: bozorni o'rganadi -> eng yaxshi strategiyani tanlaydi ->
// yangiliklar va AI tahlilini kuzatadi -> manipulyatsiya belgilarini tekshiradi ->
// yangi sham yopilganda xavf qoidalari bo'yicha savdo qiladi -> o'z
// xatolaridan o'rganadi (yutqazgan sozlamalarni vaqtincha chetlatadi).
const http = require('http');
const cfg = require('./config');
const strategies = require('./strategies');
const { learn, keyOf } = require('./learner');
const { atr } = require('./indicators');
const ccxt = require('ccxt');
const { createExchange, pickWorkingExchange, findAlternative, ExchangeHealth, CandleCache, Broker } = require('./exchange');
const { candleFlags, orderBookFlags } = require('./manipulation');
const news = require('./news');
const { AiAnalyst } = require('./ai');
const telegram = require('./telegram');
const mtfLib = require('./mtf');
const { createStore } = require('./store');
const { buildReport, buildDaily } = require('./report');

const byName = Object.fromEntries(strategies.map((s) => [s.name, s]));
const pct = (x) => `${(x * 100).toFixed(2)}%`;
const ACTION_UZ = { allow: 'ruxsat', reduce: 'kamaytirilgan summa', block: 'xarid bloklangan', exit: 'chiqish' };

const store = createStore(cfg);
const DEFAULT_STATE = {
  positions: {}, models: {}, lastCandle: {}, paused: false, day: null, dayStartEquity: null,
  history: [], flags: {}, intel: null, lossStreak: {}, excluded: {}, relearnSym: {},
  week: null, weekHistory: [], allTime: null, lastReportDay: null,
};
let state = null; // main() ichida yuklanadi
let broker = null;
let candleCache = null;
const save = () => store.save(state);

let ex = createExchange(cfg); // main() ichida ishlaydigan birja tanlanadi
const ai = new AiAnalyst(cfg);
const log = (msg) => {
  console.log(new Date().toISOString(), msg);
  telegram.send(msg);
};

const lastPrices = {};
const lastCandles = {};

async function equity() {
  let total = await broker.cash(cfg.symbols[0]);
  for (const [sym, p] of Object.entries(state.positions)) total += p.qty * (lastPrices[sym] || p.entryPrice);
  return total;
}

// ---------- O'rganish ----------
function activeExclusions(symbol) {
  const now = Date.now();
  state.excluded[symbol] = (state.excluded[symbol] || []).filter((x) => x.until > now);
  return state.excluded[symbol].map((x) => x.key);
}

async function relearn(symbol, candles) {
  const r = learn(candles, { fee: cfg.fee, exclude: activeExclusions(symbol) });
  state.models[symbol] = r.best
    ? { strategy: r.best.strategy, params: r.best.params, key: r.best.key, test: r.best.test, regime: r.regime, at: Date.now() }
    : { strategy: null, regime: r.regime, at: Date.now() };
  delete state.relearnSym[symbol];
  save();
  if (r.best) {
    log(
      `🧠 ${symbol}: bozor o'rganildi (${r.tested} variant). Holat: ${r.regime}.\n` +
        `Tanlandi: ${r.best.title}\nParametrlar: ${JSON.stringify(r.best.params)}\n` +
        `Ko'rilmagan 2 davrda: ${r.best.test.folds.map(pct).join(' va ')}, maks. tushish ${pct(r.best.test.maxDD)}, ` +
        `${r.best.test.trades} savdo ("sotib olib kutish": ${pct(r.buyHold)})`
    );
  } else {
    log(`🧠 ${symbol}: holat — ${r.regime}. Hech bir strategiya ikkala tekshiruv davrida ham foyda bermadi — yangi savdo ochilmaydi, kutaman.`);
  }
}

// ---------- Yangiliklar + AI ----------
async function refreshIntel() {
  if (!cfg.newsEnabled && !ai.enabled) return;
  const due = !state.intel || Date.now() - state.intel.at > cfg.aiEveryMinutes * 60e3;
  if (!due) return;

  const [headlines, fg] = await Promise.all([cfg.newsEnabled ? news.fetchHeadlines() : [], cfg.newsEnabled ? news.fearGreed() : null]);
  const market = {};
  for (const s of cfg.symbols) {
    const c = lastCandles[s];
    const m = state.models[s];
    market[s] = {
      narx: lastPrices[s],
      ozgarish_24s: c && c.length > 25 ? pct(c[c.length - 1].close / c[c.length - 25].close - 1) : null,
      bozor_holati: m?.regime,
      strategiya: m?.strategy,
      ochiq_pozitsiya: Boolean(state.positions[s]),
      manipulyatsiya_belgilari: (state.flags[s] || []).map((f) => f.text),
    };
  }

  const prev = state.intel;
  let intel = await ai.analyze({ symbols: cfg.symbols, headlines, fearGreed: fg, market });
  let source = `AI ${ai.label}`;
  if (!intel) {
    source = "kalit so'zlar (AI o'chiq yoki javob bermadi)";
    intel = { marketRisk: fg && (fg.value < 15 || fg.value > 90) ? 'high' : 'medium', summary: '', views: news.keywordView(cfg.symbols, headlines) };
  }
  state.intel = { ...intel, source, fearGreed: fg, headlines: headlines.length, at: Date.now() };
  save();

  const changed = !prev || prev.marketRisk !== intel.marketRisk || cfg.symbols.some((s) => prev.views?.[s]?.action !== intel.views[s]?.action);
  if (changed) {
    const lines = [`📰 Yangiliklar tahlili — ${source}`, `Bozor xavfi: ${intel.marketRisk}${fg ? ` | Qo'rquv/ochko'zlik: ${fg.value} (${fg.label})` : ''}`];
    if (intel.summary) lines.push(intel.summary);
    for (const s of cfg.symbols) {
      const v = intel.views[s];
      if (v) lines.push(`• ${s}: ${ACTION_UZ[v.action]} — ${v.reason}`);
    }
    log(lines.join('\n'));
  }
}

function intelFor(symbol) {
  const it = state.intel;
  if (!it) return { action: 'allow', mult: 1 };
  const v = it.views?.[symbol] || { action: 'allow' };
  let action = v.action;
  if (it.marketRisk === 'extreme' && action !== 'exit') action = 'block';
  let mult = action === 'reduce' ? 0.5 : 1;
  if (it.marketRisk === 'high') mult *= 0.5;
  return { action, mult, reason: v.reason };
}

// ---------- Savdo ----------
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
  state.history.push({ symbol, entry: p.entryPrice, exit: r.price, pnl, reason, strategy: p.strategy, at: Date.now() });
  delete state.positions[symbol];
  log(`${pnl >= 0 ? '✅' : '❌'} SOTILDI ${symbol} @ ${r.price} (${reason}). Natija: ${pnl.toFixed(2)} USDT`);

  // O'z xatolaridan o'rganish: ketma-ket yutqazishlar => sozlama chetlatiladi
  state.lossStreak[symbol] = pnl < 0 ? (state.lossStreak[symbol] || 0) + 1 : 0;
  if (state.lossStreak[symbol] >= cfg.lossStreakRelearn && p.key) {
    (state.excluded[symbol] ||= []).push({ key: p.key, until: Date.now() + cfg.excludeDays * 86400e3 });
    state.lossStreak[symbol] = 0;
    state.relearnSym[symbol] = true;
    log(`📉 ${symbol}: ${cfg.lossStreakRelearn} ta ketma-ket zarar. Bu sozlama ${cfg.excludeDays} kunga chetlatildi, bozor qayta o'rganiladi.`);
  }
  save();
}

function countBlocked(reason) {
  if (!state.week) return;
  const b = (state.week.blocked ||= {});
  b[reason] = (b[reason] || 0) + 1;
}

function entryIndex(candles, pos) {
  for (let i = candles.length - 1; i >= 0; i--) if (candles[i].time <= pos.at) return i;
  return 0;
}

async function onNewCandle(symbol, candles) {
  const i = candles.length - 1;
  const price = candles[i].close;
  const pos = state.positions[symbol];

  // Manipulyatsiya belgilari
  const flags = candleFlags(candles, i);
  if (cfg.orderBookCheck) {
    try {
      flags.push(...orderBookFlags(await ex.fetchOrderBook(symbol, 50), price));
    } catch {}
  }
  state.flags[symbol] = flags;
  const serious = flags.filter((f) => f.severity !== 'info' || f.type === 'stop_hunt_down');
  if (serious.length) log(`🐋 ${symbol} manipulyatsiya belgilari:\n${serious.map((f) => '• ' + f.text).join('\n')}`);

  const intel = intelFor(symbol);
  if (pos && intel.action === 'exit') return closePosition(symbol, price, `AI ogohlantirishi: ${intel.reason}`);

  const model = state.models[symbol];
  if (!model || !model.strategy) return; // ochiq pozitsiyani stop himoya qiladi

  const st = byName[model.strategy];
  const ind = st.prepare(candles, model.params);
  const posView = pos ? { ...pos, entryIndex: entryIndex(candles, pos) } : null;
  const sig = st.signal(i, candles, ind, posView, model.params);

  if (sig === 'sell' && pos) return closePosition(symbol, price, 'strategiya signali');
  if (sig !== 'buy' || pos || state.paused || state.dailyHalt) return;

  const mtf = mtfLib.prepare(candles);
  if (!mtfLib.allows(mtf, i, model.params.mtf)) {
    countBlocked('katta trend');
    return console.log(`${symbol}: xarid signali katta vaqt oralig'i filtri bilan rad etildi (${mtfLib.describe(mtf, i)})`);
  }
  if (intel.action === 'block') countBlocked('yangiliklar');
  if (intel.action === 'block') return log(`⛔ ${symbol}: xarid signali bor, lekin yangiliklar tahlili bloklad: ${intel.reason}`);
  const blockFlag = flags.find((f) => f.severity === 'block');
  if (blockFlag) countBlocked('manipulyatsiya');
  if (blockFlag) return log(`⛔ ${symbol}: xarid signali bor, lekin manipulyatsiya xavfi: ${blockFlag.text}`);

  const a = atr(candles, 14)[i];
  if (!a) return;
  const stop = price - model.params.stopAtr * a;
  const eq = await equity();
  let spend = ((eq * cfg.riskPerTrade) / (price - stop)) * price * intel.mult;
  const cash = (await broker.cash(symbol)) * 0.99;
  spend = Math.min(spend, eq * cfg.maxPosition * intel.mult, cash);
  if (spend < cfg.minOrder) {
    // Kichik hisob (masalan 20 USDT): xavf bo'yicha summa birja minimumidan kam chiqadi.
    // Minimal buyurtmaga ko'taramiz, lekin stopda yo'qotish balansning 3% idan oshmasin.
    const lossAtStop = cfg.minOrder * ((price - stop) / price);
    if (cash >= cfg.minOrder && lossAtStop <= eq * cfg.riskPerTrade * 3) spend = cfg.minOrder;
    else return log(`⚠️ ${symbol}: sotib olish signali bor, lekin mablag' yetarli emas (kerak: ${cfg.minOrder} USDT, stopda xavf ${lossAtStop.toFixed(2)} USDT).`);
  }

  const r = await broker.buy(symbol, spend, price);
  state.positions[symbol] = { qty: r.qty, entryPrice: r.price, stop, cost: spend, strategy: model.strategy, key: model.key, at: candles[i].time };
  save();
  log(
    `🟢 SOTIB OLINDI ${symbol} @ ${r.price}\nKatta trend: ${mtfLib.describe(mtf, i)}\nSumma: ${spend.toFixed(2)} USDT${intel.mult < 1 ? ' (AI tavsiyasi bilan kamaytirildi)' : ''}, ` +
      `stop: ${stop.toFixed(4)} (${pct((price - stop) / price)} pastda)\nStrategiya: ${st.title}`
  );
}

// Birjadan ma'lumot olinmasa Telegramga xabar (har juftlik uchun soatiga ko'pi bilan bir marta)
const dataErrors = {};
const transientSince = {}; // vaqtinchalik xatolar (limit, tarmoq) qachondan beri
const exHealth = new ExchangeHealth(30 * 60e3);
function dataProblem(symbol, msg) {
  const prev = dataErrors[symbol];
  if (prev && Date.now() - prev < 3600e3) return;
  dataErrors[symbol] = Date.now();
  const blocked = /451|403|restricted|location|forbidden|ENOTFOUND|ECONN|timed out|timeout/i.test(msg);
  log(
    `⚠️ ${symbol}: ${ex.id} birjasidan ma'lumot olib bo'lmadi.\nSabab: ${String(msg).slice(0, 300)}` +
      (cfg.mode === 'paper'
        ? "\nMuammo 30 daqiqa davom etsa, bot o'zi boshqa birjaga o'tadi."
        : blocked ? "\nMaslahat: birja server joylashuvini bloklayotgan bo'lishi mumkin. Server boshqa mamlakatda bo'lishi kerak." : '')
  );
}

// Joriy birja uzoq ishlamasa (sinov rejimida) zaxira birjaga o'tish
async function maybeSwitchExchange() {
  if (!exHealth.shouldSwitch()) return;
  exHealth.attempted();
  const old = ex.id;
  if (cfg.mode !== 'paper') {
    log(`🚨 ${old} birjasi 30 daqiqadan beri javob bermayapti. Haqiqiy rejimda birja avtomatik almashtirilmaydi — tekshirib ko'ring.`);
    return;
  }
  const alt = await findAlternative(cfg, old);
  if (!alt) {
    log(`🚨 ${old} 30 daqiqadan beri ishlamayapti va zaxira birjalarning hech biri javob bermadi. Bot urinishda davom etadi.`);
    return;
  }
  ex = alt;
  broker.ex = alt;
  candleCache = new CandleCache(alt, cfg.timeframe, cfg.history);
  exHealth.reset();
  for (const s of cfg.symbols) { dataErrors[s] = null; transientSince[s] = null; }
  log(`🔄 ${old} 30 daqiqadan beri ishlamayapti — narxlar endi ${alt.id} birjasidan olinadi (sinov rejimi).`);
}

async function tick() {
  await checkDay();
  let anyOk = false;
  for (const symbol of cfg.symbols) {
    try {
      const ticker = await ex.fetchTicker(symbol);
      lastPrices[symbol] = ticker.last;
      const pos = state.positions[symbol];
      if (pos && ticker.last <= pos.stop) await closePosition(symbol, ticker.last, 'stop-loss');

      const candles = await candleCache.get(symbol);
      transientSince[symbol] = null;
      anyOk = true;
      if (candles.length < 300) {
        dataProblem(symbol, `birja faqat ${candles.length} ta sham berdi (kamida 300 kerak)`);
        continue;
      }
      dataErrors[symbol] = null;
      lastCandles[symbol] = candles;
      const lastT = candles[candles.length - 1].time;
      if (state.lastCandle[symbol] === lastT) continue; // yangi sham yo'q
      state.lastCandle[symbol] = lastT;

      const m = state.models[symbol];
      if (!m || Date.now() - m.at > cfg.relearnHours * 3600e3 || state.relearnSym[symbol]) await relearn(symbol, candles);
      await onNewCandle(symbol, candles);
    } catch (e) {
      console.error(symbol, e.message);
      const transient = e instanceof ccxt.RateLimitExceeded || e instanceof ccxt.DDoSProtection || e instanceof ccxt.RequestTimeout || e instanceof ccxt.NetworkError;
      if (!transient) dataProblem(symbol, e.message);
      else {
        transientSince[symbol] ||= Date.now();
        if (Date.now() - transientSince[symbol] > 30 * 60e3) dataProblem(symbol, `30 daqiqadan beri: ${e.message}`);
      }
      continue;
    }
  }
  exHealth.record(anyOk);
  try {
    await maybeSwitchExchange();
  } catch (e) {
    console.error('birja almashtirish xatosi:', e.message);
  }
  try {
    await maybeDaily();
    await maybeReport();
  } catch (e) {
    console.error('hisobot xatosi:', e.message);
  }
  try {
    await refreshIntel();
  } catch (e) {
    console.error('yangiliklar xatosi:', e.message);
  }
  save();
}

// ---------- Haftalik hisobot ----------
function snapshot(eq) {
  return { start: Date.now(), equity: eq, prices: { ...lastPrices }, blocked: {} };
}

async function makeReport() {
  const eq = await equity();
  if (!state.week) state.week = snapshot(eq);
  const trades = state.history.filter((t) => t.at >= state.week.start);
  return buildReport({
    symbols: cfg.symbols, period: state.week, equityNow: eq, pricesNow: lastPrices,
    trades, blocked: state.week.blocked, history: state.weekHistory, allTime: state.allTime,
  });
}

function localDay(t = Date.now()) {
  return new Date(t + cfg.tzOffset * 3600e3).toISOString().slice(0, 10);
}

async function makeDaily() {
  const eq = await equity();
  const today = localDay();
  if (!state.dailyStart || state.dailyStart.day !== today) state.dailyStart = { day: today, equity: eq };
  return buildDaily({
    equityNow: eq, dayStart: state.dailyStart.equity, startEquity: state.allTime?.equity,
    trades: state.history.filter((t) => localDay(t.at) === today),
    positions: state.positions, prices: lastPrices, mode: cfg.mode,
  });
}

async function maybeDaily() {
  if (cfg.dailyReportHour < 0 || cfg.symbols.some((s) => !lastPrices[s])) return;
  const today = localDay();
  if (!state.dailyStart || state.dailyStart.day !== today) {
    // yangi kun boshlandi: kun boshidagi balansni eslab qolamiz
    state.dailyStart = { day: today, equity: await equity() };
    save();
  }
  const hour = new Date(Date.now() + cfg.tzOffset * 3600e3).getUTCHours();
  if (hour < cfg.dailyReportHour || state.lastDailyDay === today) return;
  log(await makeDaily());
  state.lastDailyDay = today;
  save();
}

async function maybeReport() {
  if (cfg.symbols.some((s) => !lastPrices[s])) return;
  const eq = await equity();
  if (!state.allTime) state.allTime = snapshot(eq);
  if (!state.week) { state.week = snapshot(eq); save(); return; }
  const local = new Date(Date.now() + cfg.tzOffset * 3600e3);
  const today = local.toISOString().slice(0, 10);
  if (local.getUTCDay() !== cfg.reportDay || local.getUTCHours() < cfg.reportHour || state.lastReportDay === today) return;
  if (Date.now() - state.week.start < 24 * 3600e3) { state.lastReportDay = today; return; } // juda qisqa davr
  const r = await makeReport();
  log(r.text);
  state.weekHistory.push({ start: state.week.start, ret: r.ret, bench: r.bench });
  state.weekHistory = state.weekHistory.slice(-52);
  state.week = snapshot(eq);
  state.lastReportDay = today;
  save();
}

async function statusText() {
  const eq = await equity();
  const lines = [
    `📊 Rejim: ${cfg.mode === 'paper' ? 'SINOV (xayoliy pul)' : 'HAQIQIY'} | Birja: ${ex.id} | AI: ${ai.label}`,
    `Umumiy balans: ${eq.toFixed(2)} USDT${state.paused ? " | ⏸ to'xtatilgan" : ''}${state.dailyHalt ? ' | 🛑 kunlik limit' : ''}`,
  ];
  if (state.intel) lines.push(`Bozor xavfi (${state.intel.source}): ${state.intel.marketRisk}`);
  for (const s of cfg.symbols) {
    const m = state.models[s];
    const p = state.positions[s];
    const it = intelFor(s);
    lines.push(
      `\n${s}: ${m ? (m.strategy ? byName[m.strategy].title : 'kutmoqda (bozor noqulay)') : "hali o'rganilmagan"}` +
        (m?.regime ? `\n  Holat: ${m.regime}` : '') +
        (lastCandles[s] ? `\n  Katta trend: ${mtfLib.describe(mtfLib.prepare(lastCandles[s]), lastCandles[s].length - 1)}${m?.params?.mtf && m.params.mtf !== 'off' ? ` (filtr: ${m.params.mtf})` : ''}` : '') +
        `\n  Yangiliklar: ${ACTION_UZ[it.action]}` +
        ((state.flags[s] || []).length ? `\n  Belgilar: ${state.flags[s].map((f) => f.type).join(', ')}` : '') +
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

function newsText() {
  const it = state.intel;
  if (!it) return "Hali yangiliklar tahlili qilinmagan.";
  const lines = [`📰 ${it.source}, ${new Date(it.at).toISOString().slice(0, 16)} UTC`, `Bozor xavfi: ${it.marketRisk}`];
  if (it.fearGreed) lines.push(`Qo'rquv/ochko'zlik: ${it.fearGreed.value} (${it.fearGreed.label})`);
  if (it.summary) lines.push(it.summary);
  for (const s of cfg.symbols) if (it.views?.[s]) lines.push(`• ${s}: ${ACTION_UZ[it.views[s].action]} — ${it.views[s].reason}`);
  return lines.join('\n');
}

function startTelegram() {
telegram.start(cfg, {
  status: statusText,
  report: async () => (await makeReport()).text,
  daily: makeDaily,
  news: newsText,
  pause: () => { state.paused = true; save(); },
  resume: () => { state.paused = false; save(); },
  relearn: () => { for (const s of cfg.symbols) { state.relearnSym[s] = true; delete state.lastCandle[s]; } state.intel = null; save(); },
  sellAll: async () => {
    const syms = Object.keys(state.positions);
    for (const s of syms) {
      const price = lastPrices[s] || (await ex.fetchTicker(s)).last;
      await closePosition(s, price, "qo'lda");
    }
    return syms.length;
  },
});
}

function startHealthServer() {
  if (!cfg.port) return;
  http
    .createServer(async (req, res) => {
      try {
        const eq = await equity();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, mode: cfg.mode, equity: Number(eq.toFixed(2)), positions: Object.keys(state.positions), paused: state.paused }));
      } catch (e) {
        res.writeHead(500);
        res.end('xato');
      }
    })
    .listen(cfg.port, () => console.log(`Holat sahifasi: http://0.0.0.0:${cfg.port}`));
}

async function shutdown(sig) {
  console.log(`${sig} qabul qilindi, holat saqlanmoqda...`);
  await store.flush();
  process.exit(0);
}

(async () => {
  state = { ...DEFAULT_STATE, ...((await store.load()) || {}) };
  if (cfg.mode === 'paper' && !(cfg.paperStart > 0 && cfg.paperStart <= 10_000_000)) {
    console.error(`PAPER_START_USDT noto'g'ri: ${cfg.paperStart}. 1000 ishlatiladi.`);
    telegram.send && setTimeout(() => telegram.send(`⚠️ PAPER_START_USDT noto'g'ri (${cfg.paperStart}). Render'da uni masalan 20 qilib qo'ying.`), 5000);
    cfg.paperStart = 1000;
  }
  startTelegram(); // birja tanlash xabarlari ham Telegramga borishi uchun avval
  ex = await pickWorkingExchange(cfg, log);
  broker = new Broker(ex, cfg, state);
  candleCache = new CandleCache(ex, cfg.timeframe, cfg.history);
  save();
  startHealthServer();
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  console.log(`Holat ombori: ${store.name}`);
  log(
    `🤖 Bot ishga tushdi. Rejim: ${cfg.mode === 'paper' ? 'SINOV (xayoliy pul)' : 'HAQIQIY PUL'}. Juftliklar: ${cfg.symbols.join(', ')}\n` +
      `AI: ${ai.enabled ? `yoqilgan — ${ai.label}` : "o'chiq — kalit so'z tahlili ishlatiladi"}`
  );
  for (;;) {
    try {
      await tick();
    } catch (e) {
      console.error('tick xatosi:', e.message);
    }
    await new Promise((r) => setTimeout(r, cfg.checkSeconds * 1000));
  }
})();
