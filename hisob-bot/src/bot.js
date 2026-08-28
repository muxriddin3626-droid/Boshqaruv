require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
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

// Nomdan keyin son, so'ng ixtiyoriy birlik (har qanday so'z - ta, dona, kg,
// yoki hatto "t" kabi qisqargan/xato yozilgan shakl ham qabul qilinadi).
const ENTRY_RE = /^(.+?)\s+(\d+)\s*([a-zA-Z']*)\.?$/;

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

const MENU_LABELS = {
  ROYXAT: "📋 Ro'yxat",
  BUGUN: '📅 Bugun',
  OY: '📆 Oy',
  YOPISH: '🔒 Yopish',
  BEKOR: '↩️ Bekor',
};

const mainMenu = Markup.keyboard([
  [MENU_LABELS.ROYXAT, MENU_LABELS.BUGUN],
  [MENU_LABELS.OY, MENU_LABELS.YOPISH],
  [MENU_LABELS.BEKOR],
]).resize();

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
      "Pastdagi tugmalar orqali tezkor hisobotlarni ko'rasiz - yuqoriga aylanib",
      "buyruq yozib yurish shart emas.",
      '',
      "Boshqa buyruqlar:",
      '/qoshish Megamir Finish [narx] — mahsulotni ro\'yxatga qo\'shish (chiqim yozmasdan)',
      '/narx Megamir Finish 45000 — mahsulotga narx belgilash',
      '/tarix Megamir Finish — oxirgi yozuvlar',
      '/ochir Megamir Finish — mahsulotni butunlay o‘chirish',
      '/tozalash — barcha mahsulot va tarixni butunlay o\'chirib, 0 dan boshlash',
    ].join('\n'),
    mainMenu
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

async function handleRoyxat(ctx) {
  const rows = await db.periodSummary(ctx.chat.id);
  await sendLong(ctx, renderSummary("Joriy hisob (oxirgi yopilgandan beri)", rows));
}

async function handleYopish(ctx) {
  const rows = await db.closePeriod(ctx.chat.id);
  const report = renderSummary('Hisob yopildi. Yakuniy natija', rows);
  await sendLong(ctx, `${report}\n\nHisob 0 dan qayta boshlandi.`);
}

async function handleBugun(ctx) {
  const rows = await db.todaySummary(ctx.chat.id);
  await sendLong(ctx, renderSummary('Bugungi hisobot', rows));
}

async function handleOy(ctx) {
  const rows = await db.monthSummary(ctx.chat.id);
  await sendLong(ctx, renderSummary('Shu oylik hisobot', rows));
}

async function handleBekor(ctx) {
  const last = await db.deleteLastTransaction(ctx.chat.id);
  if (!last) return ctx.reply('Bekor qilinadigan yozuv topilmadi.');
  ctx.reply(`Oxirgi yozuv bekor qilindi: ${fmt(last.qty)} ta.`);
}

bot.command('royxat', handleRoyxat);
bot.command('yopish', handleYopish);
bot.command('bugun', handleBugun);
bot.command('oy', handleOy);
bot.command('bekor', handleBekor);

bot.command('tarix', async (ctx) => {
  const name = ctx.message.text.replace(/^\/tarix(@\w+)?\s*/i, '').trim();
  if (!name) return ctx.reply('Foydalanish: /tarix Megamir Finish');
  const rows = await db.history(ctx.chat.id, name, 10);
  if (rows.length === 0) return ctx.reply(`"${name}" bo'yicha yozuv topilmadi.`);
  const lines = rows.map((r) => `• ${r.created_at} — ${fmt(r.qty)} ta`);
  sendLong(ctx, `"${name}" tarixi (oxirgi ${rows.length} ta):\n\n${lines.join('\n')}`);
});

bot.command('ochir', async (ctx) => {
  const name = ctx.message.text.replace(/^\/ochir(@\w+)?\s*/i, '').trim();
  if (!name) return ctx.reply("Foydalanish: /ochir Megamir Finish");
  const ok = await db.deleteProduct(ctx.chat.id, name);
  ctx.reply(ok ? `"${name}" o'chirildi.` : `"${name}" topilmadi.`);
});

bot.command('tozalash', async (ctx) => {
  const confirm = ctx.message.text.replace(/^\/tozalash(@\w+)?\s*/i, '').trim();
  if (confirm.toUpperCase() !== 'TASDIQLAYMAN') {
    return ctx.reply(
      "DIQQAT: bu barcha mahsulotlar, miqdorlar va tarixni BUTUNLAY o'chiradi. Qaytarib bo'lmaydi!\n\n" +
        "Rostdan ham hammasini o'chirib, 0 dan boshlamoqchi bo'lsangiz, aynan shuni yozing:\n/tozalash TASDIQLAYMAN"
    );
  }
  await db.wipeAll(ctx.chat.id);
  ctx.reply("Hammasi o'chirildi. Hisob butunlay 0 dan boshlandi.");
});

const MENU_HANDLERS = {
  [MENU_LABELS.ROYXAT]: handleRoyxat,
  [MENU_LABELS.BUGUN]: handleBugun,
  [MENU_LABELS.OY]: handleOy,
  [MENU_LABELS.YOPISH]: handleYopish,
  [MENU_LABELS.BEKOR]: handleBekor,
};

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;

  const menuHandler = MENU_HANDLERS[text];
  if (menuHandler) {
    return menuHandler(ctx);
  }

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
    reply += `\n\nTushunilmadi (bular saqlanmadi):\n${unrecognized.map((l) => `• ${l}`).join('\n')}`;
    reply +=
      "\n\nSabab: har bir qator nomdan keyin miqdor (son) bilan tugashi kerak, masalan \"... 100 ta\". Shu qatorlarni to'g'rilab, qaytadan yuboring.";
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
