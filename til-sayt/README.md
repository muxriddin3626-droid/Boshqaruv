# Til Ustoz — rus va nemis tili ovozli o'qituvchisi

Rus yoki nemis tilini **ovozli suhbat** orqali o'rgatadigan veb-sayt (goprep.gg
uslubida). Telefonda ham, kompyuterda ham ishlaydi:

- til tanlanadi va 10 daqiqalik dars boshlanadi (yuqorida taymer va "Stop" tugmasi);
- ekran o'rtasidagi ustoz yuzchasi gapiradi va kayfiyatini ko'rsatadi:
  xotirjam, xursand, yulduz ko'zli, o'ylayotgan, hayron va olovli "jahldor"
  (bir xil xato takrorlansa — hazil tariqasida);
- ustoz gapini tugatgach, mikrofon o'zi yoqiladi — siz javob berasiz;
- xatolar darhol tuzatiladi va **o'zbek tilida** tushuntiriladi;
- pastdagi "O'zbekcha" tugmasi bilan o'zbek tilida ham savol berish mumkin;
- ustozning gapi ekranda matn bo'lib ham chiqadi (o'chirib qo'yish mumkin);
- mikrofon ishlamasa, klaviatura tugmasi orqali yozib yuborish mumkin.

O'qituvchining qoidalari `src/prompt.js` faylida turadi.

## Tuzilishi

- `public/` — sayt sahifasi (`index.html`, `style.css`, `face.js` — yuzcha,
  `app.js` — ovoz, taymer va suhbat)
- `src/server.js` — sahifani ko'rsatadi va `/api/chat` orqali Claude bilan
  bog'lanadi. API kalit faqat serverda turadi, brauzerga chiqmaydi.

Ovozni tanish va ovoz chiqarib o'qish brauzerning o'zida ishlaydi (Web Speech
API), qo'shimcha xizmat kerak emas. Eng yaxshi natija — Chrome (Android va
kompyuter). Ko'p qurilmalarda o'zbekcha ovoz yo'q, shunda o'zbekcha gaplarni
turkcha ovoz o'qiydi.

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

Brauzerda http://localhost:3000 ni oching (mikrofon `localhost` yoki `https` manzilda ishlaydi).

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
