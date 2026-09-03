require('dotenv').config();
const path = require('path');
const express = require('express');
const { bot } = require('./bot');
const { startScheduler } = require('./scheduler');

// Render'da RENDER_EXTERNAL_URL avtomatik beriladi - agar PUBLIC_BASE_URL
// qo'lda sozlanmagan bo'lsa, shundan foydalanamiz (Instagram video faylni
// shu manzil orqali topadi).
if (!process.env.PUBLIC_BASE_URL && process.env.RENDER_EXTERNAL_URL) {
  process.env.PUBLIC_BASE_URL = process.env.RENDER_EXTERNAL_URL;
}

const app = express();
app.get('/', (_req, res) => res.send('Instagram AI video bot ishlamoqda.'));
app.use('/media', express.static(path.join(__dirname, '..', 'media')));

const PORT = process.env.PORT || 3000;
const domain = process.env.WEBHOOK_DOMAIN || process.env.RENDER_EXTERNAL_URL;

(async () => {
  if (domain) {
    const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
    app.use(bot.webhookCallback(webhookPath));
    app.listen(PORT, async () => {
      await bot.telegram.setWebhook(`${domain.replace(/\/$/, '')}${webhookPath}`);
      console.log(`Server ${PORT} portda ishga tushdi. Bot webhook rejimida: ${domain}`);
    });
  } else {
    app.listen(PORT, () => console.log(`Server ${PORT} portda ishga tushdi (lokal).`));
    await bot.launch();
    console.log('Bot polling rejimida ishga tushdi.');
  }

  startScheduler();
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
