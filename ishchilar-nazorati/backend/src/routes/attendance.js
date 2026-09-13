const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

function findActiveEmployeeByPin(pin) {
  return db.prepare('SELECT id, name, role FROM employees WHERE pin_code = ? AND active = 1').get(pin);
}

function recordAttendance(type) {
  return (req, res) => {
    const { pin, lat, lng } = req.body;
    const employee = findActiveEmployeeByPin(pin);
    if (!employee) return res.status(404).json({ error: 'PIN kod topilmadi yoki xodim faol emas' });

    const id = crypto.randomUUID();
    const ts = Date.now();
    db.prepare('INSERT INTO attendance (id, employee_id, type, ts, lat, lng) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, employee.id, type, ts, lat ?? null, lng ?? null);

    res.json({ ok: true, employee: employee.name, type, ts });
  };
}

// ---------- Ochiq: PIN orqali keldi/ketdi belgilash ----------
router.post('/checkin', recordAttendance('in'));
router.post('/checkout', recordAttendance('out'));

// ---------- Admin: barcha xodimlarning joriy holati (oxirgi hodisa) ----------
router.get('/status', adminAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.name, e.role,
      (SELECT a.type FROM attendance a WHERE a.employee_id = e.id ORDER BY a.ts DESC LIMIT 1) AS last_type,
      (SELECT a.ts FROM attendance a WHERE a.employee_id = e.id ORDER BY a.ts DESC LIMIT 1) AS last_ts
    FROM employees e
    WHERE e.active = 1
    ORDER BY e.name ASC
  `).all();
  res.json({ status: rows });
});

// ---------- Admin: tarix (filtrlash: employeeId, from, to) ----------
router.get('/', adminAuth, (req, res) => {
  const { employeeId, from, to } = req.query;
  let query = `
    SELECT a.id, a.employee_id, e.name AS employee_name, a.type, a.ts, a.lat, a.lng
    FROM attendance a JOIN employees e ON e.id = a.employee_id
    WHERE 1=1
  `;
  const params = [];
  if (employeeId) { query += ' AND a.employee_id = ?'; params.push(employeeId); }
  if (from) { query += ' AND a.ts >= ?'; params.push(Number(from)); }
  if (to) { query += ' AND a.ts <= ?'; params.push(Number(to)); }
  query += ' ORDER BY a.ts DESC LIMIT 500';

  const rows = db.prepare(query).all(...params);
  res.json({ attendance: rows });
});

module.exports = router;
