# Til o'qituvchi boti (rus va nemis tili)

Foydalanuvchiga rus yoki nemis tilini jonli suhbat orqali o'rgatadigan Telegram
bot. Javoblarni Claude (Anthropic) yozadi:

- suhbat foydalanuvchi tanlagan tilda (rus yoki nemis) olib boriladi;
- grammatik xatolar, so'zlarning ma'nosi va qoidalar **o'zbek tilida** tushuntiriladi;
- xatolar darhol, muloyimlik bilan tuzatiladi;
- har bir javob oxirida suhbatni davom ettirish uchun savol beriladi;
- boshlanishida oddiy so'zlar va qisqa gaplar ishlatiladi.

O'qituvchining qoidalari `src/prompt.js` faylida turadi.

## Lokal ishga tushirish

```bash
cd tutor-bot
npm install
cp .env.example .env
```

`.env` faylida quyidagilarni to'ldiring:

- `BOT_TOKEN` — @BotFather'dan olingan token
- `ANTHROPIC_API_KEY` — https://console.anthropic.com dan olingan kalit

So'ng:

```bash
npm start
```

## Render'da joylashtirish

1. https://render.com da "New +" → "Blueprint" ni tanlang va shu repo'ni ulang
   (`tutor-bot/render.yaml` ishlatiladi).
2. `BOT_TOKEN` va `ANTHROPIC_API_KEY` qiymatlarini kiriting.
3. Render `RENDER_EXTERNAL_URL` ni avtomatik beradi va bot webhook rejimiga o'tadi.

## Foydalanish

- `/start` — salomlashish va tilni tanlash (🇷🇺 Rus tili / 🇩🇪 Nemis tili)
- `/til` — tilni almashtirish (suhbat yangidan boshlanadi)
- `/yangi` — suhbatni yangidan boshlash
- `/help` — yordam

Tilni tanlagach, shunchaki o'sha tilda yozing. Bot javob beradi va xatolaringizni
o'zbek tilida tushuntiradi.

Suhbat tarixi xotirada saqlanadi (har bir chatda oxirgi 40 ta xabar). Bot qayta
ishga tushsa, tarix o'chadi, lekin bu o'qishga xalaqit bermaydi: `/start` bosib
davom etavering.
