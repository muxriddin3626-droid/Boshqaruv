const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// ---------- Ochiq: haydovchi qurilmasi joylashuvni yuboradi (davriy) ----------
router.post('/update', (req, res) => {
  const { pin, lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat va lng son bo\'lishi kerak' });
  }
  const employee = db.prepare('SELECT id, role FROM employees WHERE pin_code = ? AND active = 1').get(pin);
  if (!employee) return res.status(404).json({ error: 'PIN kod topilmadi yoki xodim faol emas' });

  const ts = Date.now();

  db.prepare(`
    INSERT INTO locations (employee_id, lat, lng, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(employee_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, updated_at = excluded.updated_at
  `).run(employee.id, lat, lng, ts);

  db.prepare('INSERT INTO location_history (id, employee_id, lat, lng, ts) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), employee.id, lat, lng, ts);

  res.json({ ok: true });
});

// ---------- Admin: barcha haydovchilarning joriy joylashuvi (xarita uchun) ----------
router.get('/live', adminAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT e.id AS employee_id, e.name, e.role, l.lat, l.lng, l.updated_at
    FROM locations l JOIN employees e ON e.id = l.employee_id
    WHERE e.active = 1
    ORDER BY l.updated_at DESC
  `).all();
  res.json({ locations: rows });
});

// ---------- Admin: bitta xodimning joylashuv tarixi (yo'lini ko'rish uchun) ----------
router.get('/history', adminAuth, (req, res) => {
  const { employeeId, from, to } = req.query;
  if (!employeeId) return res.status(400).json({ error: 'employeeId kerak' });

  let query = 'SELECT id, lat, lng, ts FROM location_history WHERE employee_id = ?';
  const params = [employeeId];
  if (from) { query += ' AND ts >= ?'; params.push(Number(from)); }
  if (to) { query += ' AND ts <= ?'; params.push(Number(to)); }
  query += ' ORDER BY ts ASC LIMIT 2000';

  const points = db.prepare(query).all(...params);
  res.json({ points });
});

module.exports = router;
