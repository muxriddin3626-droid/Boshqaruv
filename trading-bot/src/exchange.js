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

module.exports = { createExchange, fetchCandles, Broker };
