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

// Telegram xabarlari 4096 belgidan uzun bo'lolmaydi - uzun matnni qatorlar
// bo'yicha bo'laklarga bo'lib, ketma-ket yuboradi.
const MAX_MESSAGE_LENGTH = 3500;

async function sendLong(ctx, text) {
  if (text.length <= MAX_MESSAGE_LENGTH) {
    return ctx.reply(text);
  }
  const lines = text.split('\n');
  let chunk = '';
  for (const line of lines) {
    const candidate = chunk ? `${chunk}\n${line}` : line;
    if (candidate.length > MAX_MESSAGE_LENGTH) {
      if (chunk) await ctx.reply(chunk);
      chunk = line;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) await ctx.reply(chunk);
}

const ENTRY_RE = /^(.+?)\s+(\d+)\s*(ta|dona|kg|litr|l)?\.?$/i;

function unitTotals(rows) {
  const totals = {};
  for (const r of rows) {
    totals[r.unit] = (totals[r.unit] || 0) + r.total_qty;
  }
  return totals;
}

function formatUnitTotals(rows) {
  return Object.entries(unitTotals(rows))
    .map(([unit, qty]) => `${fmt(qty)} ${unit}`)
    .join(', ');
}

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
  text += `\n\nUmumiy: ${formatUnitTotals(rows)}`;
  if (totalSum > 0) {
    text += `\nJami summa: ${fmt(totalSum)} so'm`;
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
      "Bir nechta mahsulotni birdan kiritish uchun har birini alohida qatorga",
      "yozib, bittalik xabar qilib yuborishingiz mumkin:",
      '  Megamir Finish 100 ta',
      '  Megamir Satin 50 ta',
      '  Alpina 30 ta',
      '',
      "Buyruqlar:",
      '/qoshish Megamir Finish [narx] — mahsulotni ro\'yxatga qo\'shish (chiqim yozmasdan)',
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

bot.command('qoshish', async (ctx) => {
  const text = ctx.message.text.replace(/^\/qoshish(@\w+)?\s*/i, '').trim();
  if (!text) {
    return ctx.reply(
      "Foydalanish: /qoshish Megamir Finish [narx]\nMasalan: /qoshish Megamir Finish 45000"
    );
  }
  const match = text.match(/^(.+?)(?:\s+(\d+))?$/);
  const name = match[1].trim();
  const priceStr = match[2];

  await db.getOrCreateProduct(ctx.chat.id, name);
  let reply = `"${name}" mahsulotlar ro'yxatiga qo'shildi.`;
  if (priceStr) {
    const price = parseInt(priceStr, 10);
    await db.setPrice(ctx.chat.id, name, price);
    reply += ` Narxi: ${fmt(price)} so'm.`;
  }
  ctx.reply(reply);
});

bot.command('narx', async (ctx) => {
  const text = ctx.message.text.replace(/^\/narx(@\w+)?\s*/i, '').trim();
  const match = text.match(/^(.+?)\s+(\d+)$/);
  if (!match) {
    return ctx.reply("Foydalanish: /narx Megamir Finish 45000");
  }
  const [, name, priceStr] = match;
  const price = parseInt(priceStr, 10);
  await db.setPrice(ctx.chat.id, name.trim(), price);
  ctx.reply(`"${name.trim()}" narxi ${fmt(price)} so'm qilib belgilandi.`);
});

bot.command('royxat', async (ctx) => {
  const rows = await db.periodSummary(ctx.chat.id);
  sendLong(ctx, renderSummary("Joriy hisob (oxirgi yopilgandan beri)", rows));
});

bot.command('yopish', async (ctx) => {
  const rows = await db.closePeriod(ctx.chat.id);
  const report = renderSummary('Hisob yopildi. Yakuniy natija', rows);
  sendLong(ctx, `${report}\n\nHisob 0 dan qayta boshlandi.`);
});

bot.command('bugun', async (ctx) => {
  const rows = await db.todaySummary(ctx.chat.id);
  sendLong(ctx, renderSummary('Bugungi hisobot', rows));
});

bot.command('oy', async (ctx) => {
  const rows = await db.monthSummary(ctx.chat.id);
  sendLong(ctx, renderSummary('Shu oylik hisobot', rows));
});

bot.command('tarix', async (ctx) => {
  const name = ctx.message.text.replace(/^\/tarix(@\w+)?\s*/i, '').trim();
  if (!name) return ctx.reply('Foydalanish: /tarix Megamir Finish');
  const rows = await db.history(ctx.chat.id, name, 10);
  if (rows.length === 0) return ctx.reply(`"${name}" bo'yicha yozuv topilmadi.`);
  const lines = rows.map((r) => `• ${r.created_at} — ${fmt(r.qty)} ta`);
  sendLong(ctx, `"${name}" tarixi (oxirgi ${rows.length} ta):\n\n${lines.join('\n')}`);
});

bot.command('bekor', async (ctx) => {
  const last = await db.deleteLastTransaction(ctx.chat.id);
  if (!last) return ctx.reply("Bekor qilinadigan yozuv topilmadi.");
  ctx.reply(`Oxirgi yozuv bekor qilindi: ${fmt(last.qty)} ta.`);
});

bot.command('ochir', async (ctx) => {
  const name = ctx.message.text.replace(/^\/ochir(@\w+)?\s*/i, '').trim();
  if (!name) return ctx.reply("Foydalanish: /ochir Megamir Finish");
  const ok = await db.deleteProduct(ctx.chat.id, name);
  ctx.reply(ok ? `"${name}" o'chirildi.` : `"${name}" topilmadi.`);
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;

  const lines = text
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const beforeRows = await db.periodSummary(ctx.chat.id);
  const runningTotals = {};
  for (const r of beforeRows) {
    runningTotals[r.name.toLowerCase()] = r.total_qty;
  }

  const recorded = [];
  const unrecognized = [];

  for (const line of lines) {
    const match = line.match(ENTRY_RE);
    if (!match) {
      unrecognized.push(line);
      continue;
    }
    const name = match[1].trim();
    const qty = parseInt(match[2], 10);
    const unit = (match[3] || 'ta').toLowerCase();

    const product = await db.getOrCreateProduct(ctx.chat.id, name);
    if (product.unit !== unit) {
      await db.updateProductUnit(product.id, unit);
    }
    await db.addTransaction(ctx.chat.id, product.id, qty);

    const key = name.toLowerCase();
    const total = (runningTotals[key] || 0) + qty;
    runningTotals[key] = total;
    recorded.push({ name, qty, unit, total });
  }

  if (recorded.length === 0) {
    return ctx.reply(
      "Tushunmadim. Masalan shunday yozing: \"Megamir Finish 100 ta\".\n" +
        "Bir nechta mahsulotni birdan kiritish uchun har birini alohida qatorga yozib yuborishingiz mumkin. Buyruqlar ro'yxati uchun /start ni bosing."
    );
  }

  const rows = await db.periodSummary(ctx.chat.id);
  const priceByName = {};
  for (const r of rows) {
    priceByName[r.name.toLowerCase()] = r.price;
  }
  const entryLines = recorded.map(({ name, qty, unit, total }) => {
    let line = `• ${name}: +${fmt(qty)} ${unit} (jami: ${fmt(total)} ${unit})`;
    const price = priceByName[name.toLowerCase()];
    if (price) {
      line += ` — ${fmt(total * price)} so'm`;
    }
    return line;
  });

  let reply = `Qayd etildi:\n${entryLines.join('\n')}`;
  reply += `\n\nUmumiy (barcha mahsulotlar): ${formatUnitTotals(rows)}`;
  if (unrecognized.length > 0) {
    reply += `\n\nTushunilmadi:\n${unrecognized.map((l) => `• ${l}`).join('\n')}`;
  }
  await sendLong(ctx, reply);
});

bot.catch((err, ctx) => {
  console.error(`Bot xatoligi (${ctx.updateType}):`, err);
  ctx.reply("Xatolik yuz berdi. Ma'lumotlaringiz saqlangan bo'lishi mumkin, /royxat orqali tekshiring.").catch(() => {});
});

const PORT = process.env.PORT || 3000;
const domain = process.env.WEBHOOK_DOMAIN || process.env.RENDER_EXTERNAL_URL;

(async () => {
  await db.ready;

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
