const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'hisob.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'ta',
    price INTEGER NOT NULL DEFAULT 0,
    UNIQUE(chat_id, name)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function findProduct(chatId, name) {
  return db
    .prepare('SELECT * FROM products WHERE chat_id = ? AND name = ? COLLATE NOCASE')
    .get(chatId, name);
}

function getOrCreateProduct(chatId, name) {
  const existing = findProduct(chatId, name);
  if (existing) return existing;
  const info = db
    .prepare('INSERT INTO products (chat_id, name) VALUES (?, ?)')
    .run(chatId, name);
  return findProduct(chatId, name) || { id: info.lastInsertRowid, chat_id: chatId, name, unit: 'ta', price: 0 };
}

function setPrice(chatId, name, price) {
  const product = getOrCreateProduct(chatId, name);
  db.prepare('UPDATE products SET price = ? WHERE id = ?').run(price, product.id);
  return findProduct(chatId, name);
}

function addTransaction(chatId, productId, qty) {
  return db
    .prepare('INSERT INTO transactions (chat_id, product_id, qty) VALUES (?, ?, ?)')
    .run(chatId, productId, qty);
}

function deleteLastTransaction(chatId) {
  const last = db
    .prepare('SELECT * FROM transactions WHERE chat_id = ? ORDER BY id DESC LIMIT 1')
    .get(chatId);
  if (!last) return null;
  db.prepare('DELETE FROM transactions WHERE id = ?').run(last.id);
  return last;
}

function listProducts(chatId) {
  return db.prepare('SELECT * FROM products WHERE chat_id = ? ORDER BY name').all(chatId);
}

function deleteProduct(chatId, name) {
  const product = findProduct(chatId, name);
  if (!product) return false;
  db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
  return true;
}

function summaryForPeriod(chatId, sinceSql) {
  return db
    .prepare(
      `SELECT p.name AS name, p.unit AS unit, p.price AS price,
              COALESCE(SUM(t.qty), 0) AS total_qty
       FROM products p
       LEFT JOIN transactions t
         ON t.product_id = p.id AND t.chat_id = p.chat_id ${sinceSql}
       WHERE p.chat_id = ?
       GROUP BY p.id
       ORDER BY p.name`
    )
    .all(chatId);
}

function todaySummary(chatId) {
  return summaryForPeriod(chatId, "AND date(t.created_at) = date('now')");
}

function monthSummary(chatId) {
  return summaryForPeriod(chatId, "AND strftime('%Y-%m', t.created_at) = strftime('%Y-%m', 'now')");
}

function allTimeSummary(chatId) {
  return summaryForPeriod(chatId, '');
}

function history(chatId, name, limit = 10) {
  const product = findProduct(chatId, name);
  if (!product) return [];
  return db
    .prepare('SELECT * FROM transactions WHERE product_id = ? ORDER BY id DESC LIMIT ?')
    .all(product.id, limit);
}

module.exports = {
  db,
  findProduct,
  getOrCreateProduct,
  setPrice,
  addTransaction,
  deleteLastTransaction,
  listProducts,
  deleteProduct,
  todaySummary,
  monthSummary,
  allTimeSummary,
  history,
};
