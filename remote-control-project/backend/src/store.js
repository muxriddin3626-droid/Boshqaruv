/**
 * Saqlash qatlami (storage layer)
 * --------------------------------
 * Ikki xil amalga oshirish (implementation):
 *   - PgStore     : DATABASE_URL o'rnatilgan bo'lsa (Postgres) - doimiy saqlash
 *   - MemoryStore : aks holda (xotirada) - faqat dev/namuna uchun; server
 *                   qayta ishga tushsa ma'lumot o'chadi
 *
 * createStore() muhit o'zgaruvchisiga qarab mosini tanlaydi. Server kodi
 * (server.js) faqat shu umumiy interfeys bilan ishlaydi - qaysi backend
 * ishlatilayotgani uni qiziqtirmaydi.
 *
 * MUHIM: faol ulanishlar (WebSocket), pairing kodlar va faol sessiyalarning
 * marshrutlash holati server.js ichida xotirada qoladi - ular runtime holati
 * bo'lib, saqlanishi shart emas. Bu yerda faqat DOIMIY ma'lumot saqlanadi:
 * foydalanuvchilar, qurilmalar va sessiyalar tarixi (audit-log).
 */

// ----------------------------- Memory backend -----------------------------
class MemoryStore {
  constructor() {
    this.users = new Map();     // id -> { id, email, passwordHash }
    this.devices = new Map();   // id -> { id, userId, name, role, platform }
    this.sessions = new Map();  // id -> { id, agentDeviceId, controllerDeviceId, approved, startedAt, endedAt }
  }

  async init() { /* xotira uchun hech narsa kerak emas */ }

  async createUser(u) { this.users.set(u.id, { ...u }); return u; }
  async findUserByEmail(email) {
    return [...this.users.values()].find(u => u.email === email) || null;
  }
  async findUserById(id) { return this.users.get(id) || null; }

  async createDevice(d) { this.devices.set(d.id, { ...d }); return d; }
  async getDevice(id) { return this.devices.get(id) || null; }
  async listDevicesByUser(userId) {
    return [...this.devices.values()].filter(d => d.userId === userId);
  }

  async addSession(s) { this.sessions.set(s.id, { ...s }); return s; }
  async setSessionApproved(id, approved) {
    const s = this.sessions.get(id); if (s) s.approved = approved;
  }
  async endSession(id, endedAt) {
    const s = this.sessions.get(id); if (s) s.endedAt = endedAt;
  }
  async listSessionsForDeviceIds(deviceIds) {
    const set = new Set(deviceIds);
    return [...this.sessions.values()]
      .filter(s => set.has(s.agentDeviceId) || set.has(s.controllerDeviceId))
      .sort((a, b) => b.startedAt - a.startedAt);
  }
}

// ------------------------------- Pg backend --------------------------------
class PgStore {
  constructor(connectionString) {
    const { Pool } = require('pg');
    // Ko'pchilik boshqariladigan Postgres (Render, Heroku, Supabase) TLS talab qiladi.
    const ssl = /sslmode=disable/.test(connectionString || '')
      ? false
      : { rejectUnauthorized: false };
    this.pool = new Pool({ connectionString, ssl });
  }

  async init() {
    const fs = require('fs');
    const path = require('path');
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await this.pool.query(schema);
  }

  async createUser(u) {
    await this.pool.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
      [u.id, u.email, u.passwordHash]
    );
    return u;
  }
  async findUserByEmail(email) {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ? this._rowToUser(rows[0]) : null;
  }
  async findUserById(id) {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? this._rowToUser(rows[0]) : null;
  }

  async createDevice(d) {
    await this.pool.query(
      'INSERT INTO devices (id, user_id, name, role, platform) VALUES ($1, $2, $3, $4, $5)',
      [d.id, d.userId, d.name, d.role, d.platform]
    );
    return d;
  }
  async getDevice(id) {
    const { rows } = await this.pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    return rows[0] ? this._rowToDevice(rows[0]) : null;
  }
  async listDevicesByUser(userId) {
    const { rows } = await this.pool.query('SELECT * FROM devices WHERE user_id = $1', [userId]);
    return rows.map(r => this._rowToDevice(r));
  }

  async addSession(s) {
    await this.pool.query(
      `INSERT INTO sessions (id, agent_device_id, controller_device_id, approved, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [s.id, s.agentDeviceId, s.controllerDeviceId, s.approved, s.startedAt, s.endedAt || null]
    );
    return s;
  }
  async setSessionApproved(id, approved) {
    await this.pool.query('UPDATE sessions SET approved = $2 WHERE id = $1', [id, approved]);
  }
  async endSession(id, endedAt) {
    await this.pool.query('UPDATE sessions SET ended_at = $2 WHERE id = $1', [id, endedAt]);
  }
  async listSessionsForDeviceIds(deviceIds) {
    if (deviceIds.length === 0) return [];
    const { rows } = await this.pool.query(
      `SELECT * FROM sessions
       WHERE agent_device_id = ANY($1) OR controller_device_id = ANY($1)
       ORDER BY started_at DESC`,
      [deviceIds]
    );
    return rows.map(r => this._rowToSession(r));
  }

  _rowToUser(r) { return { id: r.id, email: r.email, passwordHash: r.password_hash }; }
  _rowToDevice(r) {
    return { id: r.id, userId: r.user_id, name: r.name, role: r.role, platform: r.platform };
  }
  _rowToSession(r) {
    return {
      id: r.id,
      agentDeviceId: r.agent_device_id,
      controllerDeviceId: r.controller_device_id,
      approved: r.approved,
      startedAt: Number(r.started_at),
      endedAt: r.ended_at != null ? Number(r.ended_at) : null
    };
  }
}

// ------------------------------- Factory -----------------------------------
function createStore() {
  const url = process.env.DATABASE_URL;
  if (url) {
    console.log('[store] Postgres ishlatilmoqda (DATABASE_URL topildi)');
    return new PgStore(url);
  }
  console.log('[store] Xotira (in-memory) ishlatilmoqda - faqat dev uchun, ' +
    'server qayta ishga tushsa ma\'lumot o\'chadi. Doimiy saqlash uchun DATABASE_URL o\'rnating.');
  return new MemoryStore();
}

module.exports = { createStore, MemoryStore, PgStore };
