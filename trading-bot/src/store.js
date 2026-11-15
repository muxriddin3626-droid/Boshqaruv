// Bot holatini (pozitsiyalar, modellar, tarix) saqlash.
// - Standart: lokal JSON fayl (VPS/Docker uchun; xavfsiz "atomic" yozish).
// - TURSO_DATABASE_URL berilsa: Turso bulutli bazasi (Render kabi diski
//   o'chib ketadigan platformalar uchun — qayta ishga tushganda holat yo'qolmaydi).
const fs = require('fs');
const path = require('path');

function fileStore(file) {
  return {
    name: `fayl (${file})`,
    async load() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return null;
      }
    },
    async save(json) {
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, json);
      fs.renameSync(tmp, file);
    },
  };
}

function tursoStore(url, authToken) {
  const { createClient } = require('@libsql/client');
  const db = createClient({ url, authToken });
  let ready = null;
  const init = () => (ready ||= db.execute('CREATE TABLE IF NOT EXISTS bot_state (id TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER)'));
  return {
    name: 'Turso bazasi',
    async load() {
      await init();
      const r = await db.execute({ sql: 'SELECT json FROM bot_state WHERE id = ?', args: ['main'] });
      return r.rows.length ? JSON.parse(r.rows[0].json) : null;
    },
    async save(json) {
      await init();
      await db.execute({
        sql: 'INSERT INTO bot_state (id, json, updated) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated = excluded.updated',
        args: ['main', json, Date.now()],
      });
    },
  };
}

// Tez-tez chaqiriladigan save() ni birlashtiradi: oxirgi holat 2 soniyada bir yoziladi
function createStore(cfg) {
  const backend = cfg.tursoUrl ? tursoStore(cfg.tursoUrl, cfg.tursoToken) : fileStore(cfg.stateFile);
  let pending = null;
  let timer = null;
  let writing = Promise.resolve();
  const flush = () => {
    timer = null;
    const json = pending;
    pending = null;
    writing = writing.then(() => backend.save(json)).catch((e) => console.error('holatni saqlab bo\'lmadi:', e.message));
    return writing;
  };
  return {
    name: backend.name,
    load: () => backend.load(),
    save(state) {
      pending = JSON.stringify(state, null, 1);
      if (!timer) timer = setTimeout(flush, cfg.saveDelayMs ?? 2000);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        await flush();
      }
      await writing;
    },
  };
}

module.exports = { createStore };
