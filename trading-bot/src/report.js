// Haftalik hisobot: bot natijasini oddiy "sotib olib kutish" bilan solishtiradi.
const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(2)}%`;
const usd = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)} USDT`;
const day = (t) => new Date(t).toISOString().slice(0, 10);

function basket(symbols, from, to) {
  const ch = symbols.filter((s) => from[s] && to[s]).map((s) => to[s] / from[s] - 1);
  return ch.length ? ch.reduce((a, b) => a + b, 0) / ch.length : null;
}

function buildReport({ symbols, period, equityNow, pricesNow, trades, blocked, history, allTime }) {
  const ret = equityNow / period.equity - 1;
  const first = symbols[0];
  const firstHold = period.prices[first] && pricesNow[first] ? pricesNow[first] / period.prices[first] - 1 : null;
  const bench = basket(symbols, period.prices, pricesNow);

  const L = [`📅 HAFTALIK HISOBOT (${day(period.start)} — ${day(Date.now())})`, ''];
  L.push(`💰 Balans: ${period.equity.toFixed(2)} → ${equityNow.toFixed(2)} USDT (${pct(ret)})`);
  if (firstHold != null) L.push(`📈 ${first} sotib olib kutish: ${pct(firstHold)}`);
  if (bench != null) L.push(`🧺 Hamma juftliklar teng sotib olib kutish: ${pct(bench)}`);
  if (bench != null) {
    const diff = ret - bench;
    L.push(diff >= 0 ? `✅ Bot kutishdan ${pct(diff)} yaxshiroq` : `⚠️ Bot kutishdan ${pct(-diff).slice(1)} yomonroq`);
  }

  L.push('', `🔁 Savdolar: ${trades.length}`);
  if (trades.length) {
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl <= 0);
    const total = trades.reduce((a, t) => a + t.pnl, 0);
    const avg = (a) => (a.length ? a.reduce((s, t) => s + t.pnl, 0) / a.length : 0);
    L.push(`Yutuq: ${wins.length} (${((wins.length / trades.length) * 100).toFixed(0)}%), zarar: ${losses.length}`);
    L.push(`Jami: ${usd(total)} | o'rtacha yutuq ${usd(avg(wins))}, o'rtacha zarar ${usd(avg(losses))}`);
    const best = trades.reduce((a, t) => (t.pnl > a.pnl ? t : a));
    const worst = trades.reduce((a, t) => (t.pnl < a.pnl ? t : a));
    L.push(`🏆 Eng yaxshi: ${best.symbol} ${usd(best.pnl)} (${best.strategy || '?'})`);
    L.push(`💀 Eng yomon: ${worst.symbol} ${usd(worst.pnl)} (${worst.reason})`);
    const by = {};
    for (const t of trades) by[t.symbol] = (by[t.symbol] || 0) + t.pnl;
    L.push('Juftliklar bo\'yicha: ' + Object.entries(by).map(([s, v]) => `${s} ${usd(v)}`).join(', '));
  }

  const b = Object.entries(blocked || {}).filter(([, v]) => v > 0);
  if (b.length) L.push('', `🛡 Himoya tufayli o'tkazib yuborilgan xaridlar: ${b.map(([k, v]) => `${k} — ${v}`).join(', ')}`);

  if (allTime) {
    const r = equityNow / allTime.equity - 1;
    const bb = basket(symbols, allTime.prices, pricesNow);
    L.push('', `📊 Boshidan beri (${day(allTime.start)}): bot ${pct(r)}${bb != null ? `, kutish ${pct(bb)}` : ''}`);
  }

  const recent = [...(history || []), { ret, bench }].slice(-4);
  if (recent.length >= 4 && recent.every((w) => w.bench != null && w.ret < w.bench)) {
    L.push('', "❗ Bot 4 hafta ketma-ket kutishdan yomon. Haqiqiy pulni ko'paytirmang — sozlamalarni ko'rib chiqish kerak.");
  }
  return { text: L.join('\n'), ret, bench };
}

module.exports = { buildReport };

// Kunlik qisqa hisobot: bugungi savdolar, yutuq/zarar, ochiq pozitsiyalar
function buildDaily({ equityNow, dayStart, startEquity, trades, positions, prices, mode }) {
  const L = [`🗓 KUNLIK HISOBOT${mode === 'paper' ? ' (sinov, xayoliy pul)' : ''}`, ''];
  const total = trades.reduce((a, t) => a + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  L.push(`🔁 Bugun savdolar: ${trades.length}`);
  if (trades.length) {
    L.push(`✅ Yutgan: ${wins.length} ta, ${usd(wins.reduce((a, t) => a + t.pnl, 0))}`);
    L.push(`❌ Yutqazgan: ${losses.length} ta, ${usd(losses.reduce((a, t) => a + t.pnl, 0))}`);
    L.push(`📌 Bugungi sof natija: ${usd(total)}`);
    for (const t of trades) L.push(`  • ${t.symbol}: ${usd(t.pnl)} (${t.reason})`);
  } else {
    L.push("Bugun yopilgan savdo yo'q (bot mos signal kutmoqda).");
  }

  const open = Object.entries(positions);
  if (open.length) {
    L.push('', `📂 Ochiq pozitsiyalar: ${open.length}`);
    for (const [s, p] of open) {
      const now = prices[s] || p.entryPrice;
      const val = p.qty * now - p.cost;
      L.push(`  • ${s}: ${p.cost.toFixed(2)} USDT, hozircha ${usd(val)} (${pct(now / p.entryPrice - 1)})`);
    }
  }

  L.push('', `💰 Balans: ${equityNow.toFixed(2)} USDT`);
  if (dayStart) L.push(`Bugun: ${pct(equityNow / dayStart - 1)}`);
  if (startEquity) L.push(`Boshidan beri: ${pct(equityNow / startEquity - 1)} (${usd(equityNow - startEquity)})`);
  return L.join('\n');
}

module.exports.buildDaily = buildDaily;
