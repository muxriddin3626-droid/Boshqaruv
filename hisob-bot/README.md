# Hisob-kitob boti

Sotilgan/chiqarilgan mahsulotlarni (masalan, Megamir Finish, Megamir Satin) hisoblab
boradigan oddiy Telegram bot. Ma'lumotlar SQLite'ga mos `@libsql/client` orqali
saqlanadi — lokal faylga (test uchun) yoki Turso'ning bepul bulutli bazasiga
(doimiy saqlash uchun) ulanish mumkin.

## Lokal ishga tushirish (test uchun)

```bash
cd hisob-bot
npm install
cp .env.example .env
```

`.env` faylida `BOT_TOKEN` ni @BotFather dan olingan tokenga almashtiring, so'ng:

```bash
npm start
```

Bu holatda ma'lumotlar `./hisob.db` fayliga saqlanadi (`WEBHOOK_DOMAIN`/
`RENDER_EXTERNAL_URL` bo'lmasa, bot oddiy polling rejimida ishlaydi).

## Bepul, doimiy ishlaydigan qilib joylashtirish (Turso + Render)

Bitta kompyuterda doim ochiq turmasdan, botni 7/24 ishlashi uchun quyidagicha
qilamiz: ma'lumotlar Turso'da (bepul, doimiy), bot esa Render'da (bepul,
webhook rejimida) ishlaydi.

### 1. Turso'da bepul baza yaratish

1. https://turso.tech saytida ro'yxatdan o'ting (GitHub orqali kirish mumkin).
2. Turso CLI o'rnatib, kirish:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```
3. Baza yaratish va ma'lumotlarni olish:
   ```bash
   turso db create hisob-bot
   turso db show hisob-bot --url
   turso db tokens create hisob-bot
   ```
   Birinchi buyruq `TURSO_DATABASE_URL` (`libsql://...` ko'rinishida), ikkinchisi
   `TURSO_AUTH_TOKEN` qiymatini beradi.

### 2. Render'da deploy qilish

1. Ushbu repo GitHub'da bo'lishi kerak (allaqachon shunday).
2. https://render.com da ro'yxatdan o'ting, "New +" → "Blueprint" ni tanlang va
   shu repo'ni ulang (repo ildizidagi `hisob-bot/render.yaml` topiladi).
3. Render so'raganda quyidagi environment variable'larni kiriting:
   - `BOT_TOKEN` — @BotFather'dan olingan token
   - `TURSO_DATABASE_URL` — yuqoridagi 1-qadamdan
   - `TURSO_AUTH_TOKEN` — yuqoridagi 1-qadamdan
4. Deploy tugagach, Render xizmatga avtomatik ravishda `RENDER_EXTERNAL_URL`
   beradi — bot buni ko'rib, avtomatik webhook rejimiga o'tadi, qo'shimcha
   sozlash shart emas.

Shu bilan bot doimiy ishlaydi va ma'lumotlar Turso'da xavfsiz saqlanadi —
Render xizmati qayta ishga tushsa ham (masalan uzoq turgandan keyin
"uyg'onganda") hisobingiz yo'qolmaydi.

## Foydalanish

Botga shunchaki quyidagicha xabar yuboring:

```
Megamir Finish 100 ta
Megamir Satin 50
```

Bot avtomatik ravishda mahsulotni yaratadi (agar mavjud bo'lmasa) va chiqim sifatida
qayd etadi, so'ng shu mahsulot bo'yicha jami sonini qaytaradi.

Bir nechta mahsulotni (masalan, avval chiqargan mahsulotlaringizni) birdan kiritish
uchun har birini alohida qatorga yozib, hammasini bitta xabar qilib yuborishingiz
mumkin:

```
Megamir Finish 100 ta
Megamir Satin 100 ta
Alpina 30 ta
```

Bot har bir qatorni alohida hisoblab, oxirida barcha mahsulotlar bo'yicha umumiy
yig'indini ko'rsatadi. Qatorlardan biri tushunarsiz bo'lsa, faqat o'sha qator
"Tushunilmadi" deb ko'rsatiladi, qolganlari baribir qayd etiladi.

### Buyruqlar

- `/qoshish Megamir Finish [narx]` — mahsulotni ro'yxatga qo'shish, chiqim
  yozmasdan (masalan, mahsulotlar ro'yxatini oldindan tayyorlab qo'yish uchun)
- `/narx Megamir Finish 45000` — mahsulotga narx belgilash (ixtiyoriy, summani hisoblash uchun)
- `/royxat` — joriy hisob (oxirgi `/yopish` dan beri to'plangan miqdorlar)
- `/bugun` — bugungi kunlik hisobot
- `/oy` — shu oylik hisobot
- `/tarix Megamir Finish` — mahsulot bo'yicha oxirgi 10 ta yozuv
- `/bekor` — oxirgi qayd etilgan yozuvni bekor qilish
- `/ochir Megamir Finish` — mahsulotni butunlay o'chirish
- `/yopish` — joriy hisobni yakunlab, yakuniy hisobotni chiqaradi va keyingi
  hisobni 0 dan qayta boshlaydi (eski yozuvlar `/tarix` uchun saqlanib qoladi)

Har bir Telegram chat/guruh o'zining alohida hisobiga ega — turli odamlar yoki
guruhlar bir-birining ma'lumotlariga aralashmaydi.
