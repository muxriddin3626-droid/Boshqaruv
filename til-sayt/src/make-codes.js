// Obuna kodlarini yaratish: npm run codes -- <soni> <kun> [tarif]
// Masalan: npm run codes -- 10 30 standard   (Standard tarif, 30 kunlik 10 ta kod)
// Tariflar: light, standard, pro (standart: standard)
require('dotenv').config();
const db = require('./db');

(async () => {
  const count = Math.min(Math.max(parseInt(process.argv[2], 10) || 1, 1), 1000);
  const days = Math.min(Math.max(parseInt(process.argv[3], 10) || 30, 1), 3650);
  const plan = ['light', 'standard', 'pro'].includes(process.argv[4]) ? process.argv[4] : 'standard';
  await db.ready;
  const codes = await db.createCodes(count, days, plan);
  console.log(`${plan} tarifi, ${days} kunlik ${codes.length} ta kod:\n`);
  console.log(codes.join('\n'));
  process.exit(0);
})().catch((err) => {
  console.error('Xatolik:', err);
  process.exit(1);
});
