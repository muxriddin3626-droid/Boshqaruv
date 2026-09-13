const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

function generatePin() {
  let pin;
  const exists = db.prepare('SELECT 1 FROM employees WHERE pin_code = ?');
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (exists.get(pin));
  return pin;
}

// ---------- Admin: xodimlar ro'yxati ----------
router.get('/', adminAuth, (req, res) => {
  const employees = db.prepare('SELECT id, name, role, phone, pin_code, active, created_at FROM employees ORDER BY created_at DESC').all();
  res.json({ employees });
});

// ---------- Admin: yangi xodim/haydovchi qo'shish ----------
router.post('/', adminAuth, (req, res) => {
  const { name, role, phone } = req.body;
  if (!name || !['ishchi', 'haydovchi'].includes(role)) {
    return res.status(400).json({ error: 'name va role ("ishchi" yoki "haydovchi") kerak' });
  }
  const id = crypto.randomUUID();
  const pin = generatePin();
  db.prepare(
    'INSERT INTO employees (id, name, role, phone, pin_code, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
  ).run(id, name, role, phone || null, pin, Date.now());

  res.json({ id, name, role, phone: phone || null, pin_code: pin, active: 1 });
});

// ---------- Admin: xodimni faol/nofaol qilish ----------
router.patch('/:id', adminAuth, (req, res) => {
  const { active } = req.body;
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Xodim topilmadi' });

  if (typeof active === 'boolean') {
    db.prepare('UPDATE employees SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
  }
  res.json({ ok: true });
});

// ---------- Ochiq: PIN kod orqali o'zini tanitish (check-in/driver sahifalari uchun) ----------
router.post('/identify', (req, res) => {
  const { pin } = req.body;
  const employee = db.prepare('SELECT id, name, role, active FROM employees WHERE pin_code = ?').get(pin);
  if (!employee || !employee.active) {
    return res.status(404).json({ error: 'PIN kod topilmadi yoki xodim faol emas' });
  }
  res.json({ employee });
});

module.exports = router;
