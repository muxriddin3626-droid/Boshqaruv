# Til Ustoz — rus va nemis tili o'qituvchi sayti

Rus yoki nemis tilini jonli suhbat orqali o'rgatadigan veb-sayt. Telefonda ham,
kompyuterda ham ishlaydi. Javoblarni Claude (Anthropic) yozadi:

- suhbat tanlangan tilda (rus yoki nemis) olib boriladi;
- grammatik xatolar, so'zlarning ma'nosi va qoidalar **o'zbek tilida** tushuntiriladi;
- xatolar darhol, muloyimlik bilan tuzatiladi;
- har bir javob oxirida suhbatni davom ettirish uchun savol beriladi;
- boshlanishida oddiy so'zlar va qisqa gaplar ishlatiladi.

O'qituvchining qoidalari `src/prompt.js` faylida turadi.

## Tuzilishi

- `public/` — sayt sahifasi (`index.html`, `style.css`, `app.js`)
- `src/server.js` — sahifani ko'rsatadi va `/api/chat` orqali Claude bilan
  bog'lanadi. API kalit faqat serverda turadi, brauzerga chiqmaydi.

Suhbat tarixi foydalanuvchining brauzerida saqlanadi: sahifani yopib ochsa ham
suhbat davom etadi. "Yangi" tugmasi suhbatni boshidan boshlaydi, "Til" tugmasi
tilni almashtiradi.

## Lokal ishga tushirish

```bash
cd til-sayt
npm install
cp .env.example .env
```

`.env` faylida `ANTHROPIC_API_KEY` ni https://console.anthropic.com dan olingan
kalitga almashtiring, so'ng:

```bash
npm start
```

Brauzerda http://localhost:3000 ni oching.

## Internetga joylashtirish (Render)

1. https://render.com da "New +" → "Blueprint" ni tanlang va shu repo'ni ulang
   (`til-sayt/render.yaml` ishlatiladi).
2. `ANTHROPIC_API_KEY` qiymatini kiriting.
3. Deploy tugagach, Render bergan manzil (masalan `https://til-sayt.onrender.com`)
   orqali sayt hamma uchun ochiladi.

Telefonda saytni ochib, brauzer menyusidan "Bosh ekranga qo'shish" ni tanlasangiz,
u oddiy ilovadek ochiladi.

Bir IP manzildan daqiqasiga 20 tadan ortiq xabar qabul qilinmaydi — bu API
xarajatini begona so'rovlardan himoya qiladi.
