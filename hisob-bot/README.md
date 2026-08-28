# Hisob-kitob boti

Sotilgan/chiqarilgan mahsulotlarni (masalan, Megamir Finish, Megamir Satin) hisoblab
boradigan oddiy Telegram bot. Ma'lumotlar SQLite faylida saqlanadi.

## O'rnatish

```bash
cd hisob-bot
npm install
cp .env.example .env
```

`.env` faylida `BOT_TOKEN` ni @BotFather dan olingan tokenga almashtiring.

## Ishga tushirish

```bash
npm start
```

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
