// Har kuni belgilangan vaqtda video tayyorlaydi. AUTO_POST holatiga qarab
// yo to'g'ridan-to'g'ri Instagramga joylaydi, yo admin tasdig'ini so'raydi.
const cron = require('node-cron');
const fs = require('fs');
const { bot, generateAndPresent, ADMIN_IDS } = require('./bot');
const { createPost } = require('./pipeline');
const { publishReel } = require('./instagramPublisher');
const { isAutoPostEnabled } = require('./configStore');
const { recordPost } = require('./postLog');
const { refreshStats } = require('./analytics');

async function notifyAdmins(text) {
  for (const chatId of ADMIN_IDS) {
    try {
      await bot.telegram.sendMessage(chatId, text);
    } catch (err) {
      console.error(`Adminga (${chatId}) xabar yuborib bo'lmadi:`, err.message);
    }
  }
}

async function runDailyJob() {
  if (ADMIN_IDS.length === 0) {
    console.warn('ADMIN_CHAT_IDS sozlanmagan - kunlik vazifa o\'tkazib yuborildi.');
    return;
  }

  if (process.env.IG_ACCESS_TOKEN && process.env.IG_BUSINESS_ACCOUNT_ID) {
    try {
      await refreshStats();
    } catch (err) {
      console.error("O'tgan postlar statistikasini yangilashda xato:", err.message);
    }
  }

  if (!isAutoPostEnabled()) {
    console.log('Kunlik vazifa: video tayyorlab, tasdiqlash uchun yuborilmoqda...');
    try {
      await generateAndPresent(ADMIN_IDS, { silentErrors: false });
    } catch (err) {
      console.error('Kunlik video generatsiya xatosi:', err);
    }
    return;
  }

  console.log('Kunlik vazifa: video tayyorlab, AVTOMATIK Instagramga joylanmoqda...');
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    await notifyAdmins('❌ Kunlik avtomatik joylash amalga oshmadi: PUBLIC_BASE_URL sozlanmagan.');
    return;
  }

  let post;
  try {
    post = await createPost();
  } catch (err) {
    console.error('Kunlik video generatsiya xatosi:', err);
    await notifyAdmins(`❌ Kunlik video tayyorlashda xato:\n${err.message}`);
    return;
  }

  try {
    const videoUrl = `${base.replace(/\/$/, '')}/media/${post.fileName}`;
    const result = await publishReel({ videoUrl, caption: post.caption });
    recordPost({
      mediaId: result.mediaId,
      quoteIndex: post.quoteIndex,
      mood: post.mood,
      quoteText: post.quoteText,
      permalink: result.permalink,
    });
    await notifyAdmins(`✅ Kunlik video avtomatik joylandi!${result.permalink ? `\n${result.permalink}` : ''}`);
  } catch (err) {
    console.error('Kunlik Instagramga joylash xatosi:', err);
    await notifyAdmins(`❌ Video tayyor bo'ldi, lekin Instagramga joylashda xato:\n${err.message}`);
  } finally {
    fs.unlink(post.videoPath, () => {});
  }
}

function startScheduler() {
  const hour = Number(process.env.DAILY_POST_HOUR || 9);
  const minute = Number(process.env.DAILY_POST_MINUTE || 0);
  const expression = `${minute} ${hour} * * *`;

  cron.schedule(expression, runDailyJob, { timezone: 'Asia/Tashkent' });
  console.log(`Kunlik vazifa rejalashtirildi: har kuni ${hour}:${String(minute).padStart(2, '0')} (Toshkent).`);
}

module.exports = { startScheduler, runDailyJob };
