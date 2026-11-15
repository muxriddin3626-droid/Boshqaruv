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
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  stateFile: process.env.STATE_FILE || 'state.json',
  checkSeconds: num(process.env.CHECK_SECONDS, 60),
};
