// Birja bilan ishlash (ccxt orqali 100+ kripto birja qo'llab-quvvatlanadi).
// paper rejimida haqiqiy buyurtma yuborilmaydi — savdo xayoliy hisobda bajariladi.
const ccxt = require('ccxt');

function createExchange(cfg) {
  const Cls = ccxt[cfg.exchange];
  if (!Cls) throw new Error(`Noma'lum birja: ${cfg.exchange}`);
  const ex = new Cls({
    apiKey: cfg.apiKey,
    secret: cfg.apiSecret,
    password: cfg.apiPassword || undefined,
    enableRateLimit: true,
    // faqat spot bozorlari yuklanadi (futures so'rovlari kerak emas)
    options: { defaultType: 'spot', fetchMarkets: { types: ['spot'] } },
  });
  if (cfg.sandbox) ex.setSandboxMode(true);
  return ex;
}

// Sinov rejimida: tanlangan birja server joylashuvini bloklasa (451/403),
// narxlarni boshqa birjadan oladi. Haqiqiy rejimda almashtirilmaydi —
// u yerda API kalitlar aynan tanlangan birjaga tegishli.
const FALLBACKS = ['bybit', 'okx', 'kucoin', 'gateio', 'kraken'];

async function pickWorkingExchange(cfg, log = console.log) {
  const first = createExchange(cfg);
  if (cfg.mode !== 'paper') return first;
  const tried = [];
  for (const id of [cfg.exchange, ...FALLBACKS.filter((x) => x !== cfg.exchange)]) {
    const ex = id === cfg.exchange ? first : createExchange({ ...cfg, exchange: id, apiKey: '', apiSecret: '', apiPassword: '' });
    try {
      await ex.loadMarkets();
      const missing = cfg.symbols.filter((s) => !ex.markets[s]);
      if (missing.length) throw new Error(`juftliklar yo'q: ${missing.join(', ')}`);
      await ex.fetchTicker(cfg.symbols[0]);
      if (id !== cfg.exchange) log(`🔄 ${cfg.exchange} ishlamadi, narxlar ${id} birjasidan olinadi (sinov rejimi).`);
      return ex;
    } catch (e) {
      tried.push(`${id}: ${String(e.message).split('\n')[0].slice(0, 120)}`);
    }
  }
  log(`⚠️ Hech bir birjaga ulanib bo'lmadi:\n${tried.join('\n')}`);
  return first;
}

// Ish paytida zaxira birjani topish (joriy birjadan tashqari). Topilmasa null.
async function findAlternative(cfg, currentId) {
  const ids = [cfg.exchange, ...FALLBACKS].filter((id, i, a) => id !== currentId && a.indexOf(id) === i);
  for (const id of ids) {
    const ex = createExchange({ ...cfg, exchange: id, apiKey: '', apiSecret: '', apiPassword: '' });
    try {
      await ex.loadMarkets();
      if (cfg.symbols.some((s) => !ex.markets[s])) continue;
      await ex.fetchTicker(cfg.symbols[0]);
      return ex;
    } catch {}
  }
  return null;
}

// Birja "sog'ligi": bir tekshiruvda hech bir juftlik uchun ma'lumot olinmasa —
// muvaffaqiyatsiz. Uzluksiz `limitMs` davom etsa, almashtirish vaqti keldi.
class ExchangeHealth {
  constructor(limitMs = 30 * 60e3) {
    this.limitMs = limitMs;
    this.failSince = null;
    this.lastAttempt = 0;
  }
  record(anyOk, now = Date.now()) {
    if (anyOk) this.failSince = null;
    else this.failSince ||= now;
  }
  shouldSwitch(now = Date.now()) {
    return this.failSince != null && now - this.failSince >= this.limitMs && now - this.lastAttempt >= this.limitMs;
  }
  attempted(now = Date.now()) {
    this.lastAttempt = now;
  }
  reset() {
    this.failSince = null;
  }
}

async function fetchCandles(ex, symbol, timeframe, total) {
  const ms = ex.parseTimeframe(timeframe) * 1000;
  let since = Date.now() - total * ms;
  const all = [];
  while (all.length < total) {
    const batch = await ex.fetchOHLCV(symbol, timeframe, since, 1000);
    if (!batch.length) break;
    for (const [t, o, h, l, c, v] of batch) {
      if (!all.length || t > all[all.length - 1].time) all.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
    }
    since = batch[batch.length - 1][0] + ms;
    if (batch.length < 2 || since > Date.now()) break;
  }
  // oxirgi sham hali yopilmagan bo'lishi mumkin — uni olib tashlaymiz
  if (all.length && all[all.length - 1].time + ms > Date.now()) all.pop();
  return all;
}

// Shamlar keshi: tarix bir marta yuklanadi, keyin faqat yangi yopilgan
// shamlar qo'shiladi. Yangi sham yopilmagan bo'lsa birjaga umuman so'rov yo'q.
class CandleCache {
  constructor(ex, timeframe, total) {
    this.ex = ex;
    this.timeframe = timeframe;
    this.total = total;
    this.ms = ex.parseTimeframe(timeframe) * 1000;
    this.data = {};
  }

  async get(symbol, now = Date.now()) {
    const cur = this.data[symbol];
    if (!cur || cur.length < 300) {
      this.data[symbol] = await fetchCandles(this.ex, symbol, this.timeframe, this.total);
      return this.data[symbol];
    }
    const last = cur[cur.length - 1];
    if (now < last.time + 2 * this.ms) return cur; // keyingi sham hali yopilmagan
    const batch = await this.ex.fetchOHLCV(symbol, this.timeframe, last.time + this.ms, 100);
    let added = 0;
    for (const [t, o, h, l, c, v] of batch) {
      if (t > cur[cur.length - 1].time && t + this.ms <= now) {
        cur.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
        added++;
      }
    }
    if (cur.length > this.total) cur.splice(0, cur.length - this.total);
    // uzilish bo'lsa (masalan bot uzoq uxlagan), tarixni qaytadan yuklaymiz
    if (!added && now > last.time + 4 * this.ms) delete this.data[symbol];
    return cur;
  }
}

class Broker {
  constructor(ex, cfg, state) {
    this.ex = ex;
    this.cfg = cfg;
    this.state = state;
    if (cfg.mode === 'paper' && state.paperCash == null) state.paperCash = cfg.paperStart;
  }

  quote(symbol) {
    return symbol.split('/')[1];
  }

  async cash(symbol) {
    if (this.cfg.mode === 'paper') return this.state.paperCash;
    const bal = await this.ex.fetchBalance();
    return bal.free[this.quote(symbol)] || 0;
  }

  async buy(symbol, quoteAmount, price) {
    if (this.cfg.mode === 'paper') {
      const qty = (quoteAmount / price) * (1 - this.cfg.fee);
      this.state.paperCash -= quoteAmount;
      return { qty, price };
    }
    await this.ex.loadMarkets();
    const amount = Number(this.ex.amountToPrecision(symbol, quoteAmount / price));
    const o = await this.ex.createMarketBuyOrder(symbol, amount);
    const filled = o.filled || amount;
    const fee = o.fee && o.fee.currency === symbol.split('/')[0] ? o.fee.cost : 0;
    return { qty: filled - fee, price: o.average || price };
  }

  async sell(symbol, qty, price) {
    if (this.cfg.mode === 'paper') {
      const got = qty * price * (1 - this.cfg.fee);
      this.state.paperCash += got;
      return { price, got };
    }
    await this.ex.loadMarkets();
    const amount = Number(this.ex.amountToPrecision(symbol, qty));
    const o = await this.ex.createMarketSellOrder(symbol, amount);
    return { price: o.average || price, got: o.cost || amount * price };
  }
}

module.exports = { createExchange, pickWorkingExchange, findAlternative, ExchangeHealth, fetchCandles, CandleCache, Broker, FALLBACKS };
