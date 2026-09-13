/**
 * Ishchilar nazorati backend
 * ---------------------------------
 * Vazifasi:
 *  1) Admin autentifikatsiyasi (JWT)
 *  2) Xodimlar (ishchi/haydovchi) ro'yxati, har biriga PIN kod bilan
 *  3) Keldi/ketdi (attendance) belgilash va tarixi
 *  4) Haydovchilarning joriy joylashuvini qabul qilish va xaritada ko'rsatish uchun berish
 *
 * ESLATMA: Ma'lumotlar SQLite fayl bazasida saqlanadi (backend/data.sqlite).
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const locationRoutes = require('./routes/location');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/employees', employeeRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/location', locationRoutes);

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Ishchilar nazorati backend ${PORT}-portda ishlamoqda`);
});

module.exports = app;
