require('dotenv').config();
const { Telegraf } = require('telegraf');
const db = require('./db');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN topilmadi. .env faylida BOT_TOKEN ni belgilang.');
  process.exit(1);
}

const bot = new Telegraf(token);

function fmt(n) {
  return Number(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

const ENTRY_RE = /^(.+?)\s+(\d+)\s*(ta|dona|kg|litr|l)?\.?$/i;

function renderSummary(title, rows) {
  if (rows.length === 0) {
    return `${title}\n\nHozircha mahsulotlar yo'q.`;
  }
  let totalSum = 0;
  const lines = rows.map((r) => {
    const sum = r.total_qty * r.price;
    totalSum += sum;
    const sumPart = r.price ? ` — ${fmt(sum)} so'm` : '';
    return `• ${r.name}: ${fmt(r.total_qty)} ${r.unit}${sumPart}`;
  });
  let text = `${title}\n\n${lines.join('\n')}`;
  if (totalSum > 0) {
    text += `\n\nJami summa: ${fmt(totalSum)} so'm`;
  }
  return text;
}

bot.start((ctx) => {
  ctx.reply(
    [
      "Assalomu alaykum! Men chiqim hisob-kitob botiman.",
      '',
      "Mahsulot chiqimini yozib yuborish uchun shunchaki shu ko'rinishda yozing:",
      '  Megamir Finish 100 ta',
      '  Megamir Satin 50',
      '',
      "Buyruqlar:",
      '/narx Megamir Finish 45000 — mahsulotga narx belgilash',
      "/royxat — joriy hisob (oxirgi yopilgandan beri)",
      '/bugun — bugungi kunlik hisobot',
      '/oy — shu oylik hisobot',
      '/tarix Megamir Finish — oxirgi yozuvlar',
      '/bekor — oxirgi yozuvni bekor qilish',
      '/ochir Megamir Finish — mahsulotni butunlay o‘chirish',
      "/yopish — joriy hisobni yakunlab, hisobni 0 dan qayta boshlash",
    ].join('\n')
  );
});

bot.command('narx', (ctx) => {
  const text = ctx.message.text.replace(/^\/narx(@\w+)?\s*/i, '').trim();
  const match = text.match(/^(.+?)\s+(\d+)$/);
  if (!match) {
    return ctx.reply("Foydalanish: /narx Megamir Finish 45000");
  }
  const [, name, priceStr] = match;
  const price = parseInt(priceStr, 10);
  db.setPrice(ctx.chat.id, name.trim(), price);
  ctx.reply(`"${name.trim()}" narxi ${fmt(price)} so'm qilib belgilandi.`);
});

bot.command('royxat', (ctx) => {
  const rows = db.periodSummary(ctx.chat.id);
  ctx.reply(renderSummary("Joriy hisob (oxirgi yopilgandan beri)", rows));
});

bot.command('yopish', (ctx) => {
  const rows = db.closePeriod(ctx.chat.id);
  const report = renderSummary('Hisob yopildi. Yakuniy natija', rows);
  ctx.reply(`${report}\n\nHisob 0 dan qayta boshlandi.`);
});

bot.command('bugun', (ctx) => {
  const rows = db.todaySummary(ctx.chat.id);
  ctx.reply(renderSummary('Bugungi hisobot', rows));
});

bot.command('oy', (ctx) => {
  const rows = db.monthSummary(ctx.chat.id);
  ctx.reply(renderSummary('Shu oylik hisobot', rows));
});

bot.command('tarix', (ctx) => {
  const name = ctx.message.text.replace(/^\/tarix(@\w+)?\s*/i, '').trim();
  if (!name) return ctx.reply('Foydalanish: /tarix Megamir Finish');
  const rows = db.history(ctx.chat.id, name, 10);
  if (rows.length === 0) return ctx.reply(`"${name}" bo'yicha yozuv topilmadi.`);
  const lines = rows.map((r) => `• ${r.created_at} — ${fmt(r.qty)} ta`);
  ctx.reply(`"${name}" tarixi (oxirgi ${rows.length} ta):\n\n${lines.join('\n')}`);
});

bot.command('bekor', (ctx) => {
  const last = db.deleteLastTransaction(ctx.chat.id);
  if (!last) return ctx.reply("Bekor qilinadigan yozuv topilmadi.");
  ctx.reply(`Oxirgi yozuv bekor qilindi: ${fmt(last.qty)} ta.`);
});

bot.command('ochir', (ctx) => {
  const name = ctx.message.text.replace(/^\/ochir(@\w+)?\s*/i, '').trim();
  if (!name) return ctx.reply("Foydalanish: /ochir Megamir Finish");
  const ok = db.deleteProduct(ctx.chat.id, name);
  ctx.reply(ok ? `"${name}" o'chirildi.` : `"${name}" topilmadi.`);
});

bot.on('text', (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;

  const match = text.match(ENTRY_RE);
  if (!match) {
    return ctx.reply(
      "Tushunmadim. Masalan shunday yozing: \"Megamir Finish 100 ta\". Buyruqlar ro'yxati uchun /start ni bosing."
    );
  }

  const name = match[1].trim();
  const qty = parseInt(match[2], 10);
  const unit = (match[3] || 'ta').toLowerCase();

  const product = db.getOrCreateProduct(ctx.chat.id, name);
  if (product.unit !== unit) {
    db.db.prepare('UPDATE products SET unit = ? WHERE id = ?').run(unit, product.id);
  }
  db.addTransaction(ctx.chat.id, product.id, qty);

  const rows = db.periodSummary(ctx.chat.id);
  const row = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
  const total = row ? row.total_qty : qty;

  let reply = `Qayd etildi: ${name} — ${fmt(qty)} ${unit}\nJami: ${fmt(total)} ${unit}`;
  if (row && row.price) {
    reply += `\nJami summa: ${fmt(row.total_qty * row.price)} so'm`;
  }
  ctx.reply(reply);
});

bot.launch();
console.log('Bot ishga tushdi.');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
