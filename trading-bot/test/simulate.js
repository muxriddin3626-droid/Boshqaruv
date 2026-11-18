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

// 3) Manipulyatsiya detektori
const { candleFlags, orderBookFlags } = require('../src/manipulation');
{
  const c = makeMarket(200, 3, ['range']).map((k) => ({ ...k, volume: 100 }));
  const i = c.length - 1;
  let lo = Infinity;
  for (let j = i - 24; j < i; j++) lo = Math.min(lo, c[j].low);
  c[i] = { ...c[i], open: lo * 1.01, low: lo * 0.95, close: lo * 1.012, high: lo * 1.02, volume: 500 };
  assert(candleFlags(c, i).some((f) => f.type === 'stop_hunt_down'), 'stop-ov aniqlanmadi');
  const p = c.map((k) => ({ ...k }));
  for (let j = i - 2; j <= i; j++) { const b = p[j - 1].close; p[j] = { ...p[j], open: b, close: b * 1.06, high: b * 1.07, low: b * 0.99, volume: 900 }; }
  assert(candleFlags(p, i).some((f) => f.type === 'pump'), 'pamp aniqlanmadi');
  const book = { bids: [[99.9, 1], [99.8, 1.2], [99.5, 60]], asks: [[100.1, 1], [100.2, 1.1], [100.4, 0.9]] };
  const ob = orderBookFlags(book, 100).map((f) => f.type);
  assert(ob.includes('spoof_bid') && ob.includes('bid_wall'), 'spoofing aniqlanmadi');
  console.log('✓ manipulyatsiya: stop-ov, pamp, spoofing devor aniqlandi');
}

// 4) Yangiliklar (kalit so'zlar) va AI javobini qayta ishlash
const news = require('../src/news');
{
  const rss = '<rss><item><title><![CDATA[Solana exchange hacked, $40M stolen]]></title><pubDate>' + new Date().toUTCString() + '</pubDate></item><item><title>Bitcoin ETF inflows hit record high</title><pubDate>' + new Date().toUTCString() + '</pubDate></item></rss>';
  const items = news.parseRss(rss);
  assert.strictEqual(items.length, 2);
  const v = news.keywordView(['SOL/USDT', 'BTC/USDT', 'ETH/USDT'], items);
  assert.strictEqual(v['SOL/USDT'].action, 'reduce');
  assert.strictEqual(v['BTC/USDT'].action, 'allow');
  assert(v['BTC/USDT'].sentiment > 0);
  const v2 = news.keywordView(['ETH/USDT'], [{ title: "U.S. judge says Ethereum has 'no terms of use,' clears MIT brothers of $25 million fraud" }, { title: 'Ethereum lawsuit dismissed by court' }]);
  assert.strictEqual(v2['ETH/USDT'].action, 'allow', 'oqlov yangiligi noto\'g\'ri bloklandi');
  console.log('✓ yangiliklar: RSS o\'qildi, salbiy yangilik aniqlandi');
}
(async () => {
  const { AiAnalyst } = require('../src/ai');
  const a = new AiAnalyst({ aiEnabled: false });
  assert.strictEqual(await a.analyze({ symbols: [] }), null);
  a.enabled = true;
  a.provider = 'anthropic';
  a.model = 'claude-opus-5-5';
  a.cfg = { aiEffort: 'medium', aiWebSearch: true };
  const calls = [];
  a.client = { beta: { messages: { create: async (req) => {
    calls.push(req);
    if (calls.length === 1) return { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'x' } }] };
    return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'report_market_view', input: {
      market_risk: 'high', summary_uz: 'Bozor xavotirda.',
      symbols: [{ symbol: 'SOL/USDT', sentiment: -3, action: 'block', reason_uz: 'Birja buzildi' }, { symbol: 'NOPE/USDT', sentiment: 1, action: 'allow', reason_uz: '' }],
    } }] };
  } } } };
  const r = await a.analyze({ symbols: ['SOL/USDT'], headlines: [], fearGreed: null, market: {} });
  assert.strictEqual(calls.length, 2, 'pause_turn davom ettirilmadi');
  assert.strictEqual(calls[0].model, 'claude-opus-5-5');
  assert(calls[0].tools.some((t) => t.type === 'web_search_20260209'));
  assert.strictEqual(r.views['SOL/USDT'].action, 'block');
  assert.strictEqual(r.views['SOL/USDT'].sentiment, -1);
  assert(!r.views['NOPE/USDT']);
  console.log('✓ AI (Claude): web qidiruv davomi, javob tekshiruvi');

  // OpenAI provayderi
  const { pickProvider } = require('../src/ai');
  const saved = { o: process.env.OPENAI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
  process.env.OPENAI_API_KEY = 'test'; delete process.env.ANTHROPIC_API_KEY;
  assert.strictEqual(pickProvider({ aiProvider: 'auto' }), 'openai');
  const o = new AiAnalyst({ aiProvider: 'auto', aiWebSearch: true });
  assert.strictEqual(o.provider, 'openai');
  assert.strictEqual(o.model, 'gpt-5.4-mini');
  let oreq = null;
  o.client = { responses: { create: async (req) => { oreq = req; return { output_text: JSON.stringify({ market_risk: 'low', summary_uz: 'Tinch.', symbols: [{ symbol: 'BTC/USDT', sentiment: 0.4, action: 'reduce', reason_uz: 'Aralash' }] }) }; } } };
  const or = await o.analyze({ symbols: ['BTC/USDT'], headlines: [], fearGreed: null, market: {} });
  assert.strictEqual(oreq.text.format.type, 'json_schema');
  assert.strictEqual(oreq.text.format.strict, true);
  assert.deepStrictEqual(oreq.tools, [{ type: 'web_search' }]);
  assert.strictEqual(or.views['BTC/USDT'].action, 'reduce');
  o.client = { responses: { create: async () => { const e = new Error('bad key'); e.status = 401; throw e; } } };
  assert.strictEqual(await o.analyze({ symbols: ['BTC/USDT'] }), null);
  if (saved.o === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.o;
  if (saved.a !== undefined) process.env.ANTHROPIC_API_KEY = saved.a;
  console.log('✓ AI (OpenAI): JSON sxema, web qidiruv, xatoda xavfsiz');
})().then(extraTests).then(runBot);

async function extraTests() {
  // Shamlar keshi: birjaga keraksiz so'rov yubormaydi
  {
    const { CandleCache } = require('../src/exchange');
    const H = 3600e3;
    let now = Math.floor(Date.now() / H) * H + 10 * 60e3; // soat boshidan 10 daqiqa o'tgan
    const base = makeMarket(2000, 9, ['range']).map((k, i) => ({ ...k, time: now - (2000 - i) * H - 10 * 60e3 }));
    let calls = 0;
    const fake = { parseTimeframe: () => 3600, async fetchOHLCV(sym, tf, since, limit) {
      calls++;
      const rows = base.filter((k) => k.time >= (since || 0) && k.time < now).slice(0, Math.min(limit || 1000, 300));
      return rows.map((k) => [k.time, k.open, k.high, k.low, k.close, k.volume]);
    } };
    const cc = new CandleCache(fake, '1h', 1500);
    const first = await cc.get('X', now);
    const fullCalls = calls;
    assert(first.length >= 1400 && fullCalls >= 5, `birinchi yuklash: ${first.length} sham, ${fullCalls} so'rov`);
    for (let m = 1; m <= 40; m++) await cc.get('X', now + m * 60e3); // 40 daqiqa, yangi sham yo'q
    assert.strictEqual(calls, fullCalls, 'yangi sham yo\'q paytda so\'rov yubordi');
    const lastBefore = first[first.length - 1].time;
    base.push({ ...base[base.length - 1], time: lastBefore + H }); // yangi sham yopildi
    now = lastBefore + 2 * H + 60e3;
    const after = await cc.get('X', now);
    assert.strictEqual(calls, fullCalls + 1, 'yangi sham uchun bitta so\'rov bo\'lishi kerak');
    assert.strictEqual(after[after.length - 1].time, lastBefore + H);
    assert(after.length <= 1500);
    console.log(`✓ shamlar keshi: birinchi marta ${fullCalls} so'rov, keyin soatiga 1 ta (avval daqiqasiga ${fullCalls})`);
  }

  // Telegram menyusi: tugmalar, buyruqlar ro'yxati, faqat egasi, sotishdan oldin tasdiq
  {
    const { Telegraf, Telegram } = require('telegraf');
    const calls = [];
    const origCall = Telegram.prototype.callApi;
    const origLaunch = Telegraf.prototype.launch;
    Telegram.prototype.callApi = async function (method, payload) { calls.push({ method, payload }); return method === 'getMe' ? { id: 1, is_bot: true, username: 'test_bot' } : true; };
    Telegraf.prototype.launch = async function () {};
    const tg = require('../src/telegram');
    let sold = 0, paused = false;
    tg.start({ telegramToken: '1:x', telegramChatId: '42' }, {
      status: async () => 'HOLAT_OK', daily: async () => 'BUGUN_OK', news: () => 'NEWS_OK', report: async () => 'REPORT_OK',
      pause: () => { paused = true; }, resume: () => { paused = false; }, relearn: () => {}, sellAll: async () => { sold++; return 2; },
    });
    const bot = tg._bot();
    bot.botInfo = { id: 1, is_bot: true, username: 'test_bot' };
    let uid = 1;
    const msg = (text, chat = 42) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, text, ...(text.startsWith('/') ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] } : {}), chat: { id: chat, type: 'private' }, from: { id: chat, is_bot: false, first_name: 'a' } } });
    const lastText = () => calls.filter((c) => c.method === 'sendMessage').slice(-1)[0]?.payload;
    await new Promise((r) => setTimeout(r, 10));
    assert(calls.some((c) => c.method === 'setMyCommands' && c.payload.commands.length >= 8), 'menyu buyruqlari o\'rnatilmadi');
    await msg('/start');
    assert(lastText().text.startsWith('Assalomu alaykum'), '/start javobi noto\'g\'ri');
    assert(lastText().reply_markup.keyboard.flat().map((b) => b.text || b).includes('📊 Holat'), 'tugmali menyu yo\'q');
    await msg('📊 Holat'); assert.strictEqual(lastText().text, 'HOLAT_OK');
    await msg('🗓 Bugun'); assert.strictEqual(lastText().text, 'BUGUN_OK');
    await msg('📰 Yangiliklar'); assert.strictEqual(lastText().text, 'NEWS_OK');
    await msg('/hisobot'); assert.strictEqual(lastText().text, 'REPORT_OK');
    await msg("⏸ To'xtatish"); assert(paused);
    await msg('▶️ Davom ettirish'); assert(!paused);
    await msg('🔴 Hammasini sotish');
    assert.strictEqual(sold, 0, 'tasdiqsiz sotib yubordi');
    assert(lastText().reply_markup.inline_keyboard, 'tasdiq tugmalari yo\'q');
    await bot.handleUpdate({ update_id: uid++, callback_query: { id: 'c1', data: 'sellall_yes', chat_instance: 'x', from: { id: 42, is_bot: false, first_name: 'a' }, message: { message_id: 5, date: 0, chat: { id: 42, type: 'private' }, text: 'q' } } });
    assert.strictEqual(sold, 1);
    const before = calls.length;
    await msg('📊 Holat', 999); // begona odam
    assert.strictEqual(calls.length, before, 'begona odamga javob berdi');
    Telegram.prototype.callApi = origCall;
    Telegraf.prototype.launch = origLaunch;
    console.log('✓ Telegram menyusi: tugmalar, / ro\'yxati, tasdiq, faqat egasi');
  }

  // Birja bloklansa sinov rejimida boshqasiga o'tish
  {
    const ccxtReal = require('ccxt');
    const { pickWorkingExchange } = require('../src/exchange');
    const make = (id, ok) => class { constructor() { this.id = id; } setSandboxMode() {}
      async loadMarkets() { if (!ok) throw new Error('451 Unavailable For Legal Reasons'); this.markets = { 'BTC/USDT': {} }; }
      async fetchTicker() { return { last: 1 }; } };
    const saved = { binance: ccxtReal.binance, bybit: ccxtReal.bybit, okx: ccxtReal.okx };
    ccxtReal.binance = make('binance', false); ccxtReal.bybit = make('bybit', false); ccxtReal.okx = make('okx', true);
    const msgs = [];
    const exPaper = await pickWorkingExchange({ exchange: 'binance', mode: 'paper', symbols: ['BTC/USDT'] }, (m) => msgs.push(m));
    assert.strictEqual(exPaper.id, 'okx');
    assert(msgs[0].includes('okx'));
    const exLive = await pickWorkingExchange({ exchange: 'binance', mode: 'live', symbols: ['BTC/USDT'] }, () => {});
    assert.strictEqual(exLive.id, 'binance', "haqiqiy rejimda birja almashtirilmasligi kerak");
    Object.assign(ccxtReal, saved);
    console.log('✓ birja bloklansa (sinov rejimi) boshqasiga o\'tadi, haqiqiy rejimda o\'tmaydi');
  }

  // Haftalik hisobot
  const { buildReport } = require('../src/report');
  const day = 86400e3;
  const r = buildReport({
    symbols: ['BTC/USDT', 'ETH/USDT'],
    period: { start: Date.now() - 7 * day, equity: 1000, prices: { 'BTC/USDT': 100, 'ETH/USDT': 10 } },
    equityNow: 1050, pricesNow: { 'BTC/USDT': 102, 'ETH/USDT': 10.4 },
    trades: [{ symbol: 'BTC/USDT', pnl: 60, strategy: 'ema-rsi', reason: 'signal' }, { symbol: 'ETH/USDT', pnl: -10, reason: 'stop-loss' }],
    blocked: { yangiliklar: 2 },
    history: [{ ret: 0, bench: 0.1 }, { ret: 0, bench: 0.1 }, { ret: 0, bench: 0.1 }],
    allTime: { start: Date.now() - 30 * day, equity: 1000, prices: { 'BTC/USDT': 90, 'ETH/USDT': 9 } },
  });
  assert(Math.abs(r.ret - 0.05) < 1e-9 && Math.abs(r.bench - 0.03) < 1e-9);
  assert(r.text.includes('yaxshiroq') && r.text.includes('yangiliklar — 2') && !r.text.includes('4 hafta'));
  console.log('✓ haftalik hisobot');
  const { buildDaily } = require('../src/report');
  const d = buildDaily({
    equityNow: 990, dayStart: 1000, startEquity: 1000, mode: 'paper',
    trades: [{ symbol: 'BTC/USDT', pnl: 5, reason: 'strategiya signali' }, { symbol: 'SOL/USDT', pnl: -15, reason: 'stop-loss' }],
    positions: { 'ETH/USDT': { qty: 2, entryPrice: 10, cost: 20 } }, prices: { 'ETH/USDT': 11 },
  });
  assert(d.includes('Bugun savdolar: 2') && d.includes('Yutgan: 1 ta, +5.00') && d.includes('Yutqazgan: 1 ta, -15.00') && d.includes('-10.00 USDT') && d.includes('+2.00 USDT'));
  console.log('✓ kunlik hisobot');

  // Holat ombori: fayl va Turso (libsql lokal fayl rejimida)
  const { createStore } = require('../src/store');
  for (const extra of [{}, { tursoUrl: 'file:' + path.join(os.tmpdir(), `tb-turso-${process.pid}.db`) }]) {
    const f = path.join(os.tmpdir(), `tb-store-${process.pid}.json`);
    const st = createStore({ stateFile: f, saveDelayMs: 10, ...extra });
    st.save({ a: 1 });
    st.save({ a: 2 });
    await st.flush();
    const back = await createStore({ stateFile: f, ...extra }).load();
    assert.deepStrictEqual(back, { a: 2 });
    console.log(`✓ holat ombori: ${st.name}`);
    try { fs.unlinkSync(f); } catch {}
    if (extra.tursoUrl) try { fs.unlinkSync(extra.tursoUrl.slice(5)); } catch {}
  }

  // Katta vaqt oralig'i filtri kelajakka qaramaydi
  const mtf = require('../src/mtf');
  const c = makeMarket(800, 5, ['up', 'down']);
  const full = mtf.prepare(c);
  for (const i of [300, 333, 500, 799]) {
    const part = mtf.prepare(c.slice(0, i + 1));
    assert.strictEqual(part.h4[i], full.h4[i]);
    assert.strictEqual(part.d1[i], full.d1[i]);
  }
  console.log('✓ katta vaqt oralig\'i filtri (kelajakka qaramaydi)');
}

function runBot() {
// 5) Botning to'liq sikli soxta birja bilan (paper rejim)
const market = makeMarket(1600, 7, ['range']);
let cursor = 1200; // har chaqiruvda bir sham oldinga suriladi
class FakeEx {
  constructor() { this.id = 'fake'; }
  async loadMarkets() { this.markets = { 'FAKE/USDT': {} }; return this.markets; }
  setSandboxMode() {}
  parseTimeframe() { return 3600; }
  async fetchOrderBook() { const p = market[cursor - 1].close; return { bids: [[p * 0.999, 1]], asks: [[p * 1.001, 1]] }; }
  async fetchTicker() { return { last: market[cursor - 1].close }; }
  async fetchOHLCV() {
    cursor = Math.min(cursor + 1, market.length);
    // vaqtni hozirgi kunga moslab qaytaramiz, oxirgi sham "yopilgan" bo'lishi uchun
    const shift = Date.now() - 3600e3 * 2 - market[cursor - 1].time;
    return market.slice(0, cursor).map((k) => [k.time + shift, k.open, k.high, k.low, k.close, 1]);
  }
}
require('ccxt').fake = FakeEx; // soxta birjani ccxt ro'yxatiga qo'shamiz
const stateFile = path.join(os.tmpdir(), `tb-state-${process.pid}.json`);
Object.assign(process.env, { EXCHANGE: 'fake', MODE: 'paper', SYMBOLS: 'FAKE/USDT', CHECK_SECONDS: '0.001', STATE_FILE: stateFile, TELEGRAM_BOT_TOKEN: '', HISTORY: '1000', PAPER_START_USDT: '20', AI_ENABLED: 'false', AI_EVERY_MINUTES: '0' });
global.fetch = async (url) => ({ ok: true, text: async () => url.includes('alternative') ? JSON.stringify({ data: [{ value: '40', value_classification: 'Fear' }] }) : '<rss><item><title>Fake coin lawsuit filed</title><pubDate>' + new Date().toUTCString() + '</pubDate></item></rss>' });
const logs = [];
const origLog = console.log;
console.log = (...a) => logs.push(a.join(' '));
require('../src/bot');
setTimeout(() => {
  console.log = origLog;
  const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  fs.unlinkSync(stateFile);
  assert(st.models['FAKE/USDT'], "model o'rganilmadi");
  assert.strictEqual(st.intel.views['FAKE/USDT'].action, 'reduce', 'yangilik tahlili ishlamadi');
  assert(logs.some((l) => l.includes('kamaytirildi')), 'AI/yangilik summani kamaytirmadi');
  const buys = logs.filter((l) => l.includes('SOTIB OLINDI')).length;
  const sells = logs.filter((l) => l.includes('SOTILDI')).length;
  const pos = Object.values(st.positions).reduce((a, p) => a + p.qty * market[cursor - 1].close, 0);
  console.log(`✓ bot sikli: ${cursor - 1200} sham o'tdi, ${buys} xarid, ${sells} sotuv, balans ${(st.paperCash + pos).toFixed(2)} USDT (boshida 20)`);
  assert(st.paperCash >= 0, 'balans manfiy');
  assert(buys > 0, 'bot hech savdo qilmadi');
  console.log('\nBarcha sinovlar o\'tdi.');
  process.exit(0);
}, 8000);
}
