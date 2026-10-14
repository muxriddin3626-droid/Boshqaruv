// Premium kodlarini yaratish: npm run codes -- <soni> <kun>
// Masalan: npm run codes -- 10 30   (30 kunlik 10 ta kod)
require('dotenv').config();
const db = require('./db');

(async () => {
  const count = Math.min(Math.max(parseInt(process.argv[2], 10) || 1, 1), 1000);
  const days = Math.min(Math.max(parseInt(process.argv[3], 10) || 30, 1), 3650);
  await db.ready;
  const codes = await db.createCodes(count, days);
  console.log(`${days} kunlik ${codes.length} ta Premium kod:\n`);
  console.log(codes.join('\n'));
  process.exit(0);
})().catch((err) => {
  console.error('Xatolik:', err);
  process.exit(1);
});
