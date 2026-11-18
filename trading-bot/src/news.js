// Yangiliklarni yig'ish (bepul, kalitsiz): kripto RSS lentalari va
// "Qo'rquv va ochko'zlik" indeksi. AI ulanmagan bo'lsa ham oddiy kalit
// so'zlar bo'yicha xavfli yangiliklarni aniqlaydi.
const FEEDS = [
  'https://cointelegraph.com/rss',
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://decrypt.co/feed',
];

const NEGATIVE = /\b(hack|hacked|exploit|stolen|drain|lawsuit|sues|sec charges|ban|banned|bankrupt|insolvent|delist|halt|crash|plunge|fraud|liquidat|depeg|outage|investigation)\w*/i;
// Salbiy so'z bor, lekin ma'nosi ijobiy: "clears of fraud", "lawsuit dismissed"
const EXCULPATORY = /\b(clear(s|ed)?|acquit\w*|dismiss\w*|drop(s|ped)?|recover(s|ed|y)?|settle(s|d|ment)?|wins?|won|overturn\w*|reject(s|ed)? (sec|lawsuit))\b/i;
const POSITIVE = /\b(approv|etf inflow|partnership|adopt|record high|all-time high|upgrade|listing|surge|rally)\w*/i;

const COIN_NAMES = {
  BTC: ['bitcoin', 'btc'], ETH: ['ethereum', 'ether', 'eth'], SOL: ['solana', 'sol'],
  BNB: ['bnb', 'binance coin'], XRP: ['xrp', 'ripple'], DOGE: ['dogecoin', 'doge'],
  ADA: ['cardano', 'ada'], TON: ['toncoin', 'ton'], AVAX: ['avalanche', 'avax'],
};

async function get(url, ms = 10000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'trading-bot/1.0' } });
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item[\s\S]*?<\/item>/g)) {
    const pick = (tag) => {
      const x = m[0].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return x ? x[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : '';
    };
    items.push({ title: pick('title'), date: Date.parse(pick('pubDate')) || Date.now(), summary: pick('description').slice(0, 300) });
  }
  return items;
}

async function fetchHeadlines(maxAgeHours = 24) {
  const out = [];
  for (const url of FEEDS) {
    try {
      out.push(...parseRss(await get(url)).map((x) => ({ ...x, source: new URL(url).hostname })));
    } catch (e) {
      console.error('yangilik manbasi ishlamadi:', url, e.message);
    }
  }
  const cutoff = Date.now() - maxAgeHours * 3600e3;
  const seen = new Set();
  return out
    .filter((x) => x.date >= cutoff && !seen.has(x.title.toLowerCase()) && seen.add(x.title.toLowerCase())).sort((a, b) => b.date - a.date).slice(0, 40);
}

async function fearGreed() {
  try {
    const j = JSON.parse(await get('https://api.alternative.me/fng/?limit=1'));
    const d = j.data[0];
    return { value: Number(d.value), label: d.value_classification };
  } catch {
    return null;
  }
}

// AI'siz zaxira tahlil: tanga nomi bor salbiy sarlavhalar => xarid bloklanadi
function keywordView(symbols, headlines) {
  const views = {};
  for (const sym of symbols) {
    const base = sym.split('/')[0];
    const names = COIN_NAMES[base] || [base.toLowerCase()];
    const rel = headlines.filter((h) => names.some((n) => new RegExp(`\\b${n}\\b`, 'i').test(h.title)));
    const neg = rel.filter((h) => NEGATIVE.test(h.title) && !EXCULPATORY.test(h.title));
    const pos = rel.filter((h) => POSITIVE.test(h.title));
    const sentiment = rel.length ? (pos.length - neg.length) / rel.length : 0;
    views[sym] = {
      sentiment,
      action: neg.length >= 2 ? 'block' : neg.length === 1 ? 'reduce' : 'allow',
      reason: neg.length ? `Salbiy yangilik: "${neg[0].title}"` : rel.length ? `${rel.length} ta yangilik, xavfli belgi yo'q` : "Bu tanga haqida yangi xabar yo'q",
    };
  }
  return views;
}

module.exports = { fetchHeadlines, fearGreed, keywordView, parseRss };
