const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Telegraf, Markup } = require('telegraf');
const { createPost } = require('./pipeline');
const { publishReel } = require('./instagramPublisher');
const { isAutoPostEnabled, setAutoPost } = require('./configStore');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN topilmadi. .env faylida BOT_TOKEN ni belgilang.');
  process.exit(1);
}

const ADMIN_IDS = String(process.env.ADMIN_CHAT_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const bot = new Telegraf(token);

// Hozircha jarayonda (Instagramga joylash/tashlab yuborishni kutayotgan)
// videolar shu yerda saqlanadi. Server qayta ishga tushsa tozalanadi -
// bu holatda admin shunchaki /video buyrug'ini qayta yuborishi kifoya.
const pendingPosts = new Map();

function isAdmin(ctx) {
  if (ADMIN_IDS.length === 0) return true; // sozlanmagan bo'lsa - hammaga ochiq (lokal test uchun)
  return ADMIN_IDS.includes(String(ctx.chat?.id));
}

function requireAdmin(handler) {
  return async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.reply("Kechirasiz, bu bot faqat admin uchun.");
    }
    return handler(ctx);
  };
}

function approvalKeyboard(id) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Instagramga joylash', `publish:${id}`)],
    [Markup.button.callback('🔄 Boshqa video', `regenerate:${id}`)],
    [Markup.button.callback('❌ Bekor qilish', `cancel:${id}`)],
  ]);
}

function cleanupPending(id) {
  const post = pendingPosts.get(id);
  if (post) {
    fs.unlink(post.videoPath, () => {});
    pendingPosts.delete(id);
  }
}

async function generateAndPresent(chatIds, { silentErrors = false } = {}) {
  const targets = Array.isArray(chatIds) ? chatIds : [chatIds];
  for (const chatId of targets) {
    await bot.telegram.sendMessage(chatId, "⏳ Video tayyorlanmoqda, biroz kuting...");
  }

  let post;
  try {
    post = await createPost();
  } catch (err) {
    console.error('Video generatsiya xatosi:', err);
    if (!silentErrors) {
      for (const chatId of targets) {
        await bot.telegram.sendMessage(chatId, `❌ Video tayyorlashda xato:\n${err.message}`);
      }
    }
    throw err;
  }

  const id = crypto.randomBytes(4).toString('hex');
  pendingPosts.set(id, post);

  for (const chatId of targets) {
    await bot.telegram.sendVideo(
      chatId,
      { source: fs.createReadStream(post.videoPath) },
      { caption: post.caption, ...approvalKeyboard(id) }
    );
  }
  return { id, post };
}

async function publishPending(id) {
  const post = pendingPosts.get(id);
  if (!post) throw new Error('Bu video allaqachon qayta ishlangan yoki muddati o\'tgan.');

  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    throw new Error('PUBLIC_BASE_URL .env da sozlanmagan - Instagram videoni ochiq internetdan yuklab ololmaydi.');
  }
  const videoUrl = `${base.replace(/\/$/, '')}/media/${post.fileName}`;
  const result = await publishReel({ videoUrl, caption: post.caption });
  cleanupPending(id);
  return result;
}

bot.command('start', (ctx) => {
  ctx.reply(
    "Salom! Men Instagram uchun AI motivatsion video tayyorlab beruvchi botman.\n\n" +
    "/video - hozir bitta video tayyorlash\n" +
    "/holat - joriy sozlamalarni ko'rish\n" +
    "/auto_yoq - kunlik avtomatik joylashni yoqish\n" +
    "/auto_ochir - kunlik avtomatik joylashni o'chirish"
  );
});

bot.command('video', requireAdmin(async (ctx) => {
  try {
    await generateAndPresent(ctx.chat.id);
  } catch {
    // xato allaqachon generateAndPresent ichida xabar qilindi
  }
}));

bot.command('holat', requireAdmin(async (ctx) => {
  const auto = isAutoPostEnabled();
  const hour = process.env.DAILY_POST_HOUR || '9';
  const minute = process.env.DAILY_POST_MINUTE || '0';
  await ctx.reply(
    `Avtomatik joylash: ${auto ? '✅ YOQILGAN' : '❌ O\'CHIRILGAN'}\n` +
    `Kunlik vaqt: ${hour}:${String(minute).padStart(2, '0')} (Toshkent)\n` +
    `PUBLIC_BASE_URL: ${process.env.PUBLIC_BASE_URL || '(sozlanmagan)'}\n` +
    `Kutilayotgan videolar: ${pendingPosts.size}`
  );
}));

bot.command('auto_yoq', requireAdmin(async (ctx) => {
  setAutoPost(true);
  await ctx.reply('✅ Kunlik avtomatik joylash yoqildi. Bot har kuni video tayyorlab, to\'g\'ridan-to\'g\'ri Instagramga joylaydi.');
}));

bot.command('auto_ochir', requireAdmin(async (ctx) => {
  setAutoPost(false);
  await ctx.reply('❌ Kunlik avtomatik joylash o\'chirildi. Bot video tayyorlab, tasdiqlashingizni kutadi.');
}));

bot.action(/^publish:(.+)$/, requireAdmin(async (ctx) => {
  const id = ctx.match[1];
  await ctx.answerCbQuery();
  await ctx.reply('📤 Instagramga joylanmoqda...');
  try {
    const result = await publishPending(id);
    await ctx.reply(`✅ Joylandi!${result.permalink ? `\n${result.permalink}` : ''}`);
  } catch (err) {
    console.error('Instagramga joylash xatosi:', err);
    await ctx.reply(`❌ Joylashda xato:\n${err.message}`);
  }
}));

bot.action(/^regenerate:(.+)$/, requireAdmin(async (ctx) => {
  const id = ctx.match[1];
  await ctx.answerCbQuery();
  cleanupPending(id);
  try {
    await generateAndPresent(ctx.chat.id);
  } catch {
    // xato allaqachon xabar qilindi
  }
}));

bot.action(/^cancel:(.+)$/, requireAdmin(async (ctx) => {
  const id = ctx.match[1];
  await ctx.answerCbQuery('Bekor qilindi');
  cleanupPending(id);
  await ctx.reply('❌ Bekor qilindi.');
}));

module.exports = { bot, generateAndPresent, publishPending, ADMIN_IDS };
