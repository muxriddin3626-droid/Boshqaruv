const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/adminAuth');

const router = express.Router();

// Bitta admin hisobi muhit o'zgaruvchilaridan olinadi (ko'p foydalanuvchili
// tizim kerak bo'lsa, keyinchalik users jadvaliga o'tkazish mumkin).
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (username !== expectedUser || password !== expectedPass) {
    return res.status(401).json({ error: 'Login yoki parol xato' });
  }

  const token = jwt.sign({ role: 'admin', username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

module.exports = router;
