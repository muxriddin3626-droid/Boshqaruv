const path = require('path');
const { createClient } = require('@libsql/client');

const url =
  process.env.TURSO_DATABASE_URL || `file:${process.env.DB_PATH || path.join(__dirname, '..', 'hisob.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

const ready = (async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'ta',
      price INTEGER NOT NULL DEFAULT 0,
      UNIQUE(chat_id, name)
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      qty INTEGER NOT NULL,
      period INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS chat_meta (
      chat_id INTEGER PRIMARY KEY,
      current_period INTEGER NOT NULL DEFAULT 1
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS pending_actions (
      chat_id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      product_id INTEGER,
      product_name TEXT
    )
  `);
  // Eski (allaqachon yaratilgan) bazalarda "type" ustuni bo'lmasligi mumkin -
  // shuning uchun xatolikni e'tiborsiz qoldirib qo'shishga harakat qilamiz.
  try {
    await client.execute(`ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'chiqim'`);
  } catch (e) {
    // ustun allaqachon mavjud bo'lsa, shu yerga tushadi - muammo emas.
  }
})();

async function findProduct(chatId, name) {
  const res = await client.execute({
    sql: 'SELECT * FROM products WHERE chat_id = ? AND name = ? COLLATE NOCASE',
    args: [chatId, name],
  });
  return res.rows[0] || null;
}

async function getOrCreateProduct(chatId, name) {
  const existing = await findProduct(chatId, name);
  if (existing) return existing;
  await client.execute({
    sql: 'INSERT INTO products (chat_id, name) VALUES (?, ?)',
    args: [chatId, name],
  });
  return findProduct(chatId, name);
}

async function setPrice(chatId, name, price) {
  const product = await getOrCreateProduct(chatId, name);
  await client.execute({ sql: 'UPDATE products SET price = ? WHERE id = ?', args: [price, product.id] });
  return findProduct(chatId, name);
}

async function updateProductUnit(productId, unit) {
  await client.execute({ sql: 'UPDATE products SET unit = ? WHERE id = ?', args: [unit, productId] });
}

async function ensureChat(chatId) {
  await client.execute({ sql: 'INSERT OR IGNORE INTO chat_meta (chat_id) VALUES (?)', args: [chatId] });
}

async function getCurrentPeriod(chatId) {
  await ensureChat(chatId);
  const res = await client.execute({
    sql: 'SELECT current_period FROM chat_meta WHERE chat_id = ?',
    args: [chatId],
  });
  return res.rows[0].current_period;
}

async function addTransaction(chatId, productId, qty, type = 'chiqim') {
  const period = await getCurrentPeriod(chatId);
  return client.execute({
    sql: 'INSERT INTO transactions (chat_id, product_id, qty, period, type) VALUES (?, ?, ?, ?, ?)',
    args: [chatId, productId, qty, period, type],
  });
}

async function deleteLastTransaction(chatId) {
  const res = await client.execute({
    sql: 'SELECT * FROM transactions WHERE chat_id = ? ORDER BY id DESC LIMIT 1',
    args: [chatId],
  });
  const last = res.rows[0];
  if (!last) return null;
  await client.execute({ sql: 'DELETE FROM transactions WHERE id = ?', args: [last.id] });
  return last;
}

async function listProducts(chatId) {
  const res = await client.execute({
    sql: 'SELECT * FROM products WHERE chat_id = ? ORDER BY name',
    args: [chatId],
  });
  return res.rows;
}

async function deleteProduct(chatId, name) {
  const product = await findProduct(chatId, name);
  if (!product) return false;
  await client.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [product.id] });
  return true;
}

// "O'chirish"/"Narx" tugmasi orqali mahsulot tanlangandan keyin, keyingi
// javobda nima kutilayotganini bazada saqlaydi - shu bilan server qayta
// ishga tushib qolsa ham (masalan bepul tarifda spin-down/up bo'lganda)
// bu holat yo'qolib ketmaydi.
async function setPendingAction(chatId, type, productId, productName) {
  await client.execute({
    sql: 'INSERT OR REPLACE INTO pending_actions (chat_id, type, product_id, product_name) VALUES (?, ?, ?, ?)',
    args: [chatId, type, productId, productName],
  });
}

async function getPendingAction(chatId) {
  const res = await client.execute({
    sql: 'SELECT * FROM pending_actions WHERE chat_id = ?',
    args: [chatId],
  });
  return res.rows[0] || null;
}

async function clearPendingAction(chatId) {
  await client.execute({ sql: 'DELETE FROM pending_actions WHERE chat_id = ?', args: [chatId] });
}

// Shu chat uchun barcha mahsulot, tarix va hisobni butunlay o'chiradi (qaytarib bo'lmaydi).
async function wipeAll(chatId) {
  await client.execute({ sql: 'DELETE FROM transactions WHERE chat_id = ?', args: [chatId] });
  await client.execute({ sql: 'DELETE FROM products WHERE chat_id = ?', args: [chatId] });
  await client.execute({ sql: 'DELETE FROM chat_meta WHERE chat_id = ?', args: [chatId] });
  await client.execute({ sql: 'DELETE FROM pending_actions WHERE chat_id = ?', args: [chatId] });
}

// Faqat "chiqim" turidagi yozuvlarni hisoblaydi (kirim/ombor to'ldirish
// alohida - bu funksiyalarga ta'sir qilmaydi).
async function summaryForPeriod(chatId, sinceSql) {
  const res = await client.execute({
    sql: `SELECT p.name AS name, p.unit AS unit, p.price AS price,
                 COALESCE(SUM(t.qty), 0) AS total_qty
          FROM products p
          LEFT JOIN transactions t
            ON t.product_id = p.id AND t.chat_id = p.chat_id AND t.type = 'chiqim' ${sinceSql}
          WHERE p.chat_id = ?
          GROUP BY p.id
          ORDER BY p.name`,
    args: [chatId],
  });
  return res.rows;
}

async function todaySummary(chatId) {
  return summaryForPeriod(chatId, "AND date(t.created_at) = date('now')");
}

async function yesterdaySummary(chatId) {
  return summaryForPeriod(chatId, "AND date(t.created_at) = date('now', '-1 day')");
}

async function monthSummary(chatId) {
  return summaryForPeriod(chatId, "AND strftime('%Y-%m', t.created_at) = strftime('%Y-%m', 'now')");
}

async function allTimeSummary(chatId) {
  return summaryForPeriod(chatId, '');
}

// Hisob "yopilgandan" beri (joriy davr) to'plangan chiqim miqdorlari.
async function periodSummary(chatId) {
  const period = await getCurrentPeriod(chatId);
  const res = await client.execute({
    sql: `SELECT p.name AS name, p.unit AS unit, p.price AS price,
                 COALESCE(SUM(t.qty), 0) AS total_qty
          FROM products p
          LEFT JOIN transactions t
            ON t.product_id = p.id AND t.chat_id = p.chat_id AND t.period = ? AND t.type = 'chiqim'
          WHERE p.chat_id = ?
          GROUP BY p.id
          ORDER BY p.name`,
    args: [period, chatId],
  });
  return res.rows;
}

// Ombordagi qoldiq: barcha vaqtdagi kirim minus barcha vaqtdagi chiqim.
// Bu "/yopish" bilan reset bo'lmaydi - qoldiq har doim haqiqiy fizik holatni
// ko'rsatadi.
async function stockSummary(chatId) {
  const res = await client.execute({
    sql: `SELECT p.name AS name, p.unit AS unit, p.price AS price,
                 COALESCE(SUM(CASE WHEN t.type = 'kirim' THEN t.qty ELSE 0 END), 0) AS total_in,
                 COALESCE(SUM(CASE WHEN t.type = 'chiqim' THEN t.qty ELSE 0 END), 0) AS total_out
          FROM products p
          LEFT JOIN transactions t ON t.product_id = p.id AND t.chat_id = p.chat_id
          WHERE p.chat_id = ?
          GROUP BY p.id
          ORDER BY p.name`,
    args: [chatId],
  });
  return res.rows.map((r) => ({ ...r, qoldiq: r.total_in - r.total_out }));
}

// Kamida bitta mahsulot ro'yxatga qo'shilgan barcha chatlar - kunlik
// avtomatik hisobotni kimlarga yuborish kerakligini aniqlash uchun.
async function listActiveChats() {
  const res = await client.execute('SELECT DISTINCT chat_id FROM products');
  return res.rows.map((r) => r.chat_id);
}

// Joriy davrni yakunlaydi: hozirgi hisobni qaytaradi va keyingi yozuvlar 0 dan
// boshlanishi uchun yangi davrga o'tadi (eski yozuvlar tarixda saqlanib qoladi).
async function closePeriod(chatId) {
  const summary = await periodSummary(chatId);
  await ensureChat(chatId);
  await client.execute({
    sql: 'UPDATE chat_meta SET current_period = current_period + 1 WHERE chat_id = ?',
    args: [chatId],
  });
  return summary;
}

async function history(chatId, name, limit = 10) {
  const product = await findProduct(chatId, name);
  if (!product) return [];
  const res = await client.execute({
    sql: 'SELECT * FROM transactions WHERE product_id = ? ORDER BY id DESC LIMIT ?',
    args: [product.id, limit],
  });
  return res.rows;
}

module.exports = {
  ready,
  findProduct,
  getOrCreateProduct,
  setPrice,
  updateProductUnit,
  addTransaction,
  deleteLastTransaction,
  listProducts,
  deleteProduct,
  todaySummary,
  yesterdaySummary,
  monthSummary,
  allTimeSummary,
  periodSummary,
  stockSummary,
  listActiveChats,
  closePeriod,
  history,
  wipeAll,
  setPendingAction,
  getPendingAction,
  clearPendingAction,
};
