// Telegram orqali boshqaruv va hisobotlar (ixtiyoriy).
const { Telegraf } = require('telegraf');

let bot = null;
let chatId = null;

function send(text) {
  if (bot && chatId) bot.telegram.sendMessage(chatId, text).catch((e) => console.error('telegram:', e.message));
}

function start(cfg, h) {
  if (!cfg.telegramToken) return;
  bot = new Telegraf(cfg.telegramToken);
  chatId = cfg.telegramChatId;
  // Faqat egasi boshqara oladi
  bot.use((ctx, next) => {
    if (!chatId) {
      return ctx.reply(`Sizning chat ID: ${ctx.chat.id}\n.env faylidagi TELEGRAM_CHAT_ID ga yozing va botni qayta ishga tushiring.`);
    }
    if (String(ctx.chat.id) !== String(chatId)) return;
    return next();
  });
  bot.start((ctx) =>
    ctx.reply('Buyruqlar:\n/holat — balans va pozitsiyalar\n/toxtat — yangi savdolarni to\'xtatish\n/davom — davom ettirish\n/orgat — bozorni hozir qayta o\'rganish\n/hammasini_sot — barcha pozitsiyalarni yopish')
  );
  bot.command('holat', async (ctx) => ctx.reply(await h.status()));
  bot.command('toxtat', (ctx) => { h.pause(); ctx.reply('⏸ Yangi savdolar to\'xtatildi (ochiq pozitsiyalarni stop himoya qilishda davom etadi).'); });
  bot.command('davom', (ctx) => { h.resume(); ctx.reply('▶️ Savdo davom etmoqda.'); });
  bot.command('orgat', (ctx) => { h.relearn(); ctx.reply('🧠 Keyingi tekshiruvda bozor qayta o\'rganiladi.'); });
  bot.command('hammasini_sot', async (ctx) => { await h.sellAll(); ctx.reply('Barcha pozitsiyalar yopildi.'); });
  bot.launch().catch((e) => console.error('telegram ishga tushmadi:', e.message));
}

module.exports = { send, start };
