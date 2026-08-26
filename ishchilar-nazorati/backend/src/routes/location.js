const express = require('express');
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

  db.prepare(`
    INSERT INTO locations (employee_id, lat, lng, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(employee_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, updated_at = excluded.updated_at
  `).run(employee.id, lat, lng, Date.now());

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

module.exports = router;
