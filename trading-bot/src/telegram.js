// Telegram orqali boshqaruv va hisobotlar (ixtiyoriy).
// Buyruqlar ikki xil ko'rinadi: pastdagi doimiy tugmali menyu va
// Telegram'ning "Menu" (/) ro'yxati.
const { Telegraf, Markup } = require('telegraf');

let bot = null;
let chatId = null;

function send(text) {
  if (bot && chatId) bot.telegram.sendMessage(chatId, String(text).slice(0, 4000), { link_preview_options: { is_disabled: true } }).catch((e) => console.error('telegram:', e.message));
}

const B = {
  status: '📊 Holat',
  daily: '🗓 Bugun',
  news: '📰 Yangiliklar',
  report: '📅 Haftalik hisobot',
  pause: '⏸ To\'xtatish',
  resume: '▶️ Davom ettirish',
  relearn: '🧠 Qayta o\'rganish',
  sellAll: '🔴 Hammasini sotish',
  help: '❓ Yordam',
};

const MENU = Markup.keyboard([
  [B.status, B.daily],
  [B.news, B.report],
  [B.pause, B.resume],
  [B.relearn, B.sellAll],
  [B.help],
]).resize();

const COMMANDS = [
  { command: 'holat', description: 'Balans, pozitsiyalar, strategiyalar' },
  { command: 'bugun', description: 'Bugungi savdolar, yutuq va zarar' },
  { command: 'yangiliklar', description: 'AI yangiliklar tahlili' },
  { command: 'hisobot', description: 'Shu haftalik hisobot' },
  { command: 'toxtat', description: 'Yangi savdolarni to\'xtatish' },
  { command: 'davom', description: 'Savdoni davom ettirish' },
  { command: 'orgat', description: 'Bozorni hozir qayta o\'rganish' },
  { command: 'hammasini_sot', description: 'Barcha pozitsiyalarni yopish' },
  { command: 'menyu', description: 'Tugmali menyuni ko\'rsatish' },
];

const HELP =
  'Menyu tugmalari:\n' +
  `${B.status} — balans, pozitsiyalar va tanlangan strategiyalar\n` +
  `${B.daily} — bugun nechta savdo, qancha yutdi/yutqazdi\n` +
  `${B.news} — AI yangiliklar va bozor xavfi tahlili\n` +
  `${B.report} — shu haftaning hisoboti ("sotib olib kutish" bilan solishtirish)\n` +
  `${B.pause} — yangi xaridlarni to'xtatish (stop-loss ishlashda davom etadi)\n` +
  `${B.resume} — savdoni qayta yoqish\n` +
  `${B.relearn} — bozorni hozir qaytadan o'rganish\n` +
  `${B.sellAll} — barcha ochiq pozitsiyalarni yopish (tasdiq so'raladi)\n\n` +
  'Avtomatik: har savdoda xabar, har kuni kechqurun kunlik va yakshanba haftalik hisobot.';

function start(cfg, h) {
  if (!cfg.telegramToken) return;
  bot = new Telegraf(cfg.telegramToken);
  chatId = cfg.telegramChatId;

  // Faqat egasi boshqara oladi
  bot.use((ctx, next) => {
    if (!ctx.chat) return;
    if (!chatId) {
      return ctx.reply(`Sizning chat ID: ${ctx.chat.id}\n.env faylidagi TELEGRAM_CHAT_ID ga yozing va botni qayta ishga tushiring.`);
    }
    if (String(ctx.chat.id) !== String(chatId)) return;
    return next();
  });

  // Xato bo'lsa bot jim qolmasin
  const safe = (fn) => async (ctx) => {
    try {
      await fn(ctx);
    } catch (e) {
      console.error('telegram buyruq xatosi:', e.message);
      await ctx.reply(`⚠️ Xato: ${String(e.message).slice(0, 200)}`).catch(() => {});
    }
  };
  const reply = (ctx, text) => ctx.reply(String(text).slice(0, 4000), { ...MENU, link_preview_options: { is_disabled: true } });

  const actions = {
    status: async (ctx) => reply(ctx, await h.status()),
    daily: async (ctx) => reply(ctx, await h.daily()),
    news: async (ctx) => reply(ctx, h.news()),
    report: async (ctx) => reply(ctx, await h.report()),
    pause: async (ctx) => { h.pause(); await reply(ctx, '⏸ Yangi savdolar to\'xtatildi (ochiq pozitsiyalarni stop-loss himoya qilishda davom etadi).'); },
    resume: async (ctx) => { h.resume(); await reply(ctx, '▶️ Savdo davom etmoqda.'); },
    relearn: async (ctx) => { h.relearn(); await reply(ctx, '🧠 Bir necha daqiqada bozor qayta o\'rganiladi.'); },
    sellAll: async (ctx) =>
      ctx.reply('Barcha ochiq pozitsiyalar hozirgi narxda sotiladi. Ishonchingiz komilmi?', Markup.inlineKeyboard([
        Markup.button.callback('✅ Ha, sotilsin', 'sellall_yes'),
        Markup.button.callback('❌ Yo\'q', 'sellall_no'),
      ])),
    help: async (ctx) => reply(ctx, HELP),
  };

  bot.start(safe((ctx) => reply(ctx, `Assalomu alaykum! Trading bot boshqaruv menyusi pastda 👇\n\n${HELP}`)));
  bot.command('menyu', safe((ctx) => reply(ctx, 'Menyu 👇')));
  bot.command('holat', safe(actions.status));
  bot.command('bugun', safe(actions.daily));
  bot.command('yangiliklar', safe(actions.news));
  bot.command('hisobot', safe(actions.report));
  bot.command('toxtat', safe(actions.pause));
  bot.command('davom', safe(actions.resume));
  bot.command('orgat', safe(actions.relearn));
  bot.command('hammasini_sot', safe(actions.sellAll));
  bot.command('yordam', safe(actions.help));
  for (const [key, label] of Object.entries(B)) bot.hears(label, safe(actions[key]));

  bot.action('sellall_yes', safe(async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('⏳ Sotilmoqda...');
    const n = await h.sellAll();
    await reply(ctx, n ? `🔴 ${n} ta pozitsiya yopildi.` : "Ochiq pozitsiya yo'q edi.");
  }));
  bot.action('sellall_no', safe(async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Bekor qilindi, pozitsiyalar joyida.');
  }));

  // Noma'lum xabarga menyuni qayta ko'rsatamiz
  bot.on('text', safe((ctx) => reply(ctx, 'Pastdagi menyudan tanlang 👇')));

  bot.telegram.setMyCommands(COMMANDS).catch((e) => console.error('menyu buyruqlari o\'rnatilmadi:', e.message));
  bot.launch().catch((e) => console.error('telegram ishga tushmadi:', e.message));
}

module.exports = { send, start, MENU, COMMANDS, BUTTONS: B, _bot: () => bot };
