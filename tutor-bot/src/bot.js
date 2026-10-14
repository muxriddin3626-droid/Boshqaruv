require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT, LANGUAGES } = require('./prompt');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN topilmadi. .env faylida BOT_TOKEN ni belgilang.');
  process.exit(1);
}

const bot = new Telegraf(token);
// ANTHROPIC_API_KEY muhit o'zgaruvchisidan avtomatik o'qiladi.
const client = new Anthropic();

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.CLAUDE_EFFORT || 'medium';

// Har bir chat uchun tanlangan til va suhbat tarixi (xotirada saqlanadi).
// Tarix juda uzun bo'lib ketmasligi uchun oxirgi MAX_HISTORY ta xabar qoladi.
const MAX_HISTORY = 40;
const chats = new Map();

function getChat(chatId) {
  if (!chats.has(chatId)) chats.set(chatId, { lang: null, history: [] });
  return chats.get(chatId);
}

function trimHistory(history) {
  while (history.length > MAX_HISTORY) {
    // Tarix doim foydalanuvchi xabari bilan boshlanishi uchun juft-juft o'chiramiz.
    history.splice(0, 2);
  }
}

const languageKeyboard = Markup.inlineKeyboard([
  Object.entries(LANGUAGES).map(([code, l]) => Markup.button.callback(l.label, `lang:${code}`)),
]);

const MAX_MESSAGE_LENGTH = 3500;

function splitMessage(text) {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text];
  const chunks = [];
  let chunk = '';
  for (const line of text.split('\n')) {
    const candidate = chunk ? `${chunk}\n${line}` : line;
    if (candidate.length > MAX_MESSAGE_LENGTH) {
      if (chunk) chunks.push(chunk);
      chunk = line;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

async function sendLong(ctx, text) {
  for (const chunk of splitMessage(text)) {
    await ctx.reply(chunk);
  }
}

async function askTutor(chat) {
  const lang = LANGUAGES[chat.lang];
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: EFFORT },
    // Xavfsizlik filtri so'rovni rad etsa, server boshqa modelda qayta urinadi.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `Foydalanuvchi tanlagan til: ${lang.name}. Suhbatni shu tilda olib bor.` },
    ],
    messages: chat.history,
  });

  if (response.stop_reason === 'refusal') {
    return "Kechirasiz, bu savolga javob bera olmayman. Keling, boshqa mavzuda gaplashamiz! 🙂";
  }

  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

bot.start((ctx) => {
  chats.set(ctx.chat.id, { lang: null, history: [] });
  return ctx.reply(
    "Salom! 👋 Men rus va nemis tili o'qituvchingizman.\n" +
      "Siz bilan jonli suhbat orqali til o'rganamiz, xatolaringizni esa o'zbek tilida tushuntirib boraman.\n\n" +
      "Qaysi tilni o'rganmoqchisiz?",
    languageKeyboard
  );
});

bot.command('til', (ctx) => ctx.reply('Qaysi tilni tanlaysiz?', languageKeyboard));

bot.command('yangi', (ctx) => {
  const chat = getChat(ctx.chat.id);
  chat.history = [];
  return ctx.reply('Suhbat yangidan boshlandi. Biror narsa yozing! ✍️');
});

bot.help((ctx) =>
  ctx.reply(
    "Buyruqlar:\n" +
      "/start — boshlash\n" +
      "/til — tilni almashtirish (rus / nemis)\n" +
      "/yangi — suhbatni yangidan boshlash\n\n" +
      "Shunchaki tanlangan tilda yozing — men javob beraman va xatolaringizni tuzataman."
  )
);

bot.action(/^lang:(ru|de)$/, async (ctx) => {
  const code = ctx.match[1];
  const chat = getChat(ctx.chat.id);
  chat.lang = code;
  chat.history = [{ role: 'user', content: "Salom! Men boshlovchiman, keling suhbatni boshlaymiz." }];
  await ctx.answerCbQuery();
  await ctx.reply(`${LANGUAGES[code].label} tanlandi! ✅`);
  await ctx.sendChatAction('typing');
  try {
    const answer = await askTutor(chat);
    chat.history.push({ role: 'assistant', content: answer });
    await sendLong(ctx, answer);
  } catch (err) {
    console.error('Claude xatoligi:', err);
    chat.history = [];
    await ctx.reply("Hozir javob bera olmadim, birozdan keyin yana urinib ko'ring.");
  }
});

bot.on('text', async (ctx) => {
  const chat = getChat(ctx.chat.id);
  if (!chat.lang) {
    return ctx.reply('Avval tilni tanlang:', languageKeyboard);
  }

  chat.history.push({ role: 'user', content: ctx.message.text });
  await ctx.sendChatAction('typing');

  try {
    const answer = await askTutor(chat);
    chat.history.push({ role: 'assistant', content: answer });
    trimHistory(chat.history);
    await sendLong(ctx, answer);
  } catch (err) {
    // Javob kelmasa, foydalanuvchi xabarini tarixdan olib tashlaymiz,
    // aks holda ketma-ket ikki foydalanuvchi xabari qolib ketadi.
    chat.history.pop();
    if (err instanceof Anthropic.RateLimitError) {
      await ctx.reply("Hozir so'rovlar ko'p, bir daqiqadan keyin yana yozing.");
    } else if (err instanceof Anthropic.AuthenticationError) {
      console.error('ANTHROPIC_API_KEY noto\'g\'ri.');
      await ctx.reply('Bot sozlamalarida xatolik bor (API kalit).');
    } else {
      console.error('Claude xatoligi:', err);
      await ctx.reply("Hozir javob bera olmadim, birozdan keyin yana urinib ko'ring.");
    }
  }
});

bot.catch((err, ctx) => {
  console.error(`Bot xatoligi (${ctx.updateType}):`, err);
  ctx.reply("Xatolik yuz berdi, yana urinib ko'ring.").catch(() => {});
});

const PORT = process.env.PORT || 3000;
const domain = process.env.WEBHOOK_DOMAIN || process.env.RENDER_EXTERNAL_URL;

(async () => {
  if (domain) {
    await bot.launch({ webhook: { domain, port: PORT } });
    console.log(`Bot webhook rejimida ishga tushdi: ${domain}`);
  } else {
    await bot.launch();
    console.log('Bot polling rejimida ishga tushdi.');
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
