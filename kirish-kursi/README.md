# Kirish kursi — Kimyo va Biologiya

Universitetga kirish uchun kimyo va biologiya fanlaridan tayyorlov sayti.
Mavzular bo'yicha darslar, DTM uslubidagi testlar va har bir urinishdan keyin
sun'iy intellekt (Claude API) yordamida shaxsiy tahlil beradi — talaba qaysi
mavzularni takrorlashi kerakligini aniq ko'rsatadi.

Next.js (App Router) + TypeScript bilan qurilgan, ma'lumotlar SQLite'ga mos
`@libsql/client` orqali saqlanadi (lokal faylga yoki Turso'ning bepul bulutli
bazasiga ulanish mumkin) — xuddi shu repodagi `hisob-bot` loyihasi kabi.

## Asosiy imkoniyatlar

- **Ro'yxatdan o'tish / kirish** — telefon raqam va parol bilan, sessiya
  cookie orqali (JWT).
- **To'lov oqimi** — ro'yxatdan o'tgan foydalanuvchi "kutilmoqda" holatida
  bo'ladi, admin to'lovni tasdiqlagach kursga to'liq kirish ochiladi.
  (Hozircha to'lov qo'lda tasdiqlanadi — Click/Payme kabi to'lov tizimini
  keyinchalik ulash mumkin.)
- **Kurs materiallari** — fanlar (Kimyo, Biologiya) va ularning mavzulari,
  har bir mavzuda dars matni.
- **Test tizimi** — har mavzu uchun ko'p variantli savollar, natija va
  ball avtomatik hisoblanadi.
- **AI tahlil** — test topshirilgach, xato javoblar Claude API'ga yuborilib,
  nima uchun xato ekani va qaysi mavzuni takrorlash kerakligi haqida
  o'zbek tilida shaxsiy tushuntirish olinadi. `ANTHROPIC_API_KEY`
  berilmagan bo'lsa, tizim oddiy (qoidaga asoslangan) tahlil bilan ishlaydi.
- **Admin panel** — yangi fan/mavzu/test savoli qo'shish, kutilayotgan
  to'lovlarni tasdiqlash. Birinchi ro'yxatdan o'tgan foydalanuvchi
  avtomatik ravishda admin bo'ladi.

## Lokal ishga tushirish

```bash
cd kirish-kursi
npm install
cp .env.example .env
```

`.env` faylida kamida `SESSION_SECRET` ni tasodifiy qator bilan
to'ldiring (masalan `openssl rand -hex 32`). `TURSO_*` va
`ANTHROPIC_API_KEY` bo'sh qoldirilsa, mos ravishda lokal SQLite fayli va
oddiy (AI'siz) tahlil ishlatiladi.

Namuna kontent (2 ta fan, 4 ta mavzu, 9 ta test savoli) qo'shish uchun:

```bash
npm run seed
```

Ishga tushirish:

```bash
npm run dev
```

`http://localhost:3000` da ochiladi. Birinchi ro'yxatdan o'tgan
foydalanuvchi avtomatik admin bo'ladi va to'lovsiz to'liq kirish huquqiga
ega bo'ladi.

## Production uchun (Turso + Render)

`hisob-bot`dagi kabi:

1. [Turso](https://turso.tech)'da bepul baza yarating:
   ```bash
   turso db create kirish-kursi
   turso db show kirish-kursi --url
   turso db tokens create kirish-kursi
   ```
2. [Render](https://render.com)'da "New +" → "Blueprint" orqali shu repo'ni
   ulang (`kirish-kursi/render.yaml` avtomatik topiladi).
3. Render so'raganda quyidagilarni kiriting: `TURSO_DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, `ANTHROPIC_API_KEY` (ixtiyoriy), `PAYMENT_CONTACT`
   (to'lov uchun murojaat qilinadigan Telegram/telefon). `SESSION_SECRET`
   avtomatik generatsiya qilinadi.
4. Deploy tugagach, bazani to'ldirish uchun `TURSO_DATABASE_URL` va
   `TURSO_AUTH_TOKEN`'ni lokalda `.env`ga qo'yib `npm run seed` ishga
   tushiring (bir martalik amal).

## Papka tuzilishi

```
src/
  lib/
    db.ts     — ma'lumotlar bazasi (libsql) va barcha query'lar
    auth.ts   — sessiya (JWT cookie), parol tekshirish
    ai.ts     — Claude API orqali test natijasini tahlil qilish
  app/
    (sahifalar)/    — landing, login, ro'yxat, dashboard, mavzu, test, natija, admin
    api/            — auth, test/submit, admin API route'lari
  middleware.ts — himoyalangan sahifalarni (dashboard/mavzu/test/natija/admin) qo'riqlaydi
scripts/seed.mjs — namuna kimyo/biologiya kontenti
```
