require('dotenv').config({ quiet: true });

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

module.exports = {
  exchange: process.env.EXCHANGE || 'binance',
  apiKey: process.env.API_KEY || '',
  apiSecret: process.env.API_SECRET || '',
  apiPassword: process.env.API_PASSWORD || '', // OKX kabi birjalar uchun
  sandbox: process.env.SANDBOX === 'true',
  mode: process.env.MODE === 'live' ? 'live' : 'paper',
  symbols: (process.env.SYMBOLS || 'BTC/USDT,ETH/USDT,SOL/USDT').split(',').map((s) => s.trim()).filter(Boolean),
  timeframe: process.env.TIMEFRAME || '1h',
  history: num(process.env.HISTORY, 1500),
  relearnHours: num(process.env.RELEARN_HOURS, 24),
  fee: num(process.env.FEE_PCT, 0.1) / 100,
  riskPerTrade: num(process.env.RISK_PER_TRADE_PCT, 1) / 100,
  maxPosition: num(process.env.MAX_POSITION_PCT, 30) / 100,
  dailyLossLimit: num(process.env.DAILY_LOSS_LIMIT_PCT, 5) / 100,
  paperStart: num(process.env.PAPER_START_USDT, 1000),
  // Birjaning eng kichik buyurtmasi (Binance ~5 USDT). Kichik hisobda summa shunga ko'tariladi
  minOrder: num(process.env.MIN_ORDER_USDT, 6),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  stateFile: process.env.STATE_FILE || 'state.json',
  checkSeconds: num(process.env.CHECK_SECONDS, 60),

  // Sun'iy intellekt: OPENAI_API_KEY yoki ANTHROPIC_API_KEY bo'lsa avtomatik yoqiladi.
  aiEnabled: process.env.AI_ENABLED ? process.env.AI_ENABLED === 'true' : undefined,
  aiProvider: process.env.AI_PROVIDER || 'auto', // auto | openai | anthropic
  aiModel: process.env.AI_MODEL || '', // bo'sh: openai -> gpt-5.4-mini, anthropic -> claude-opus-5-5
  aiEffort: process.env.AI_EFFORT || 'medium',
  aiWebSearch: process.env.AI_WEB_SEARCH !== 'false',
  aiEveryMinutes: num(process.env.AI_EVERY_MINUTES, 60),
  newsEnabled: process.env.NEWS_ENABLED !== 'false',

  // Manipulyatsiya va o'z xatolaridan o'rganish
  orderBookCheck: process.env.ORDERBOOK_CHECK !== 'false',
  lossStreakRelearn: num(process.env.LOSS_STREAK_RELEARN, 3),
  excludeDays: num(process.env.EXCLUDE_DAYS, 3),

  // Haftalik hisobot (standart: yakshanba 20:00, Toshkent vaqti UTC+5)
  reportDay: num(process.env.REPORT_DAY, 0), // 0=yakshanba ... 6=shanba
  reportHour: num(process.env.REPORT_HOUR, 20),
  tzOffset: num(process.env.TZ_OFFSET_HOURS, 5),
  // Kunlik hisobot soati (mahalliy vaqt). -1 = o'chirish
  dailyReportHour: num(process.env.DAILY_REPORT_HOUR, 21),

  // Server
  tursoUrl: process.env.TURSO_DATABASE_URL || '',
  tursoToken: process.env.TURSO_AUTH_TOKEN || '',
  port: process.env.PORT ? Number(process.env.PORT) : null,
};
