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

### Buyruqlar

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
