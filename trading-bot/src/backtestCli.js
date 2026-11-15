// Pulsiz sinov: `npm run backtest -- BTC/USDT` — bot shu juftlik uchun nimani
// tanlashini va tarixda qanday natija berishini ko'rsatadi.
const cfg = require('./config');
const { learn } = require('./learner');
const { createExchange, fetchCandles } = require('./exchange');

const pct = (x) => `${(x * 100).toFixed(2)}%`;

async function main() {
  const symbols = process.argv.slice(2).length ? process.argv.slice(2) : cfg.symbols;
  const ex = createExchange(cfg);
  for (const symbol of symbols) {
    const candles = await fetchCandles(ex, symbol, cfg.timeframe, cfg.history);
    const r = learn(candles, { fee: cfg.fee });
    console.log(`\n=== ${symbol} (${candles.length} ta ${cfg.timeframe} sham) ===`);
    console.log(`Sinalgan variantlar: ${r.tested}. Tekshiruv davrida "sotib olib kutish": ${pct(r.buyHold)}`);
    if (!r.ranking.length) console.log("Hech bir strategiya ko'rilmagan davrda foyda bermadi — bot bu juftlikda savdo qilmaydi.");
    for (const x of r.ranking) {
      console.log(
        `- ${x.title} ${JSON.stringify(x.params)}\n  o'rganish: ${pct(x.train.ret)} | tekshiruv: ${pct(x.test.ret)}, ` +
          `maks. tushish ${pct(x.test.maxDD)}, ${x.test.trades} savdo, yutuq ${pct(x.test.winRate)}`
      );
    }
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
