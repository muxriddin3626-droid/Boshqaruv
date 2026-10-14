# Til Ustoz — rus va nemis tili ovozli o'qituvchisi

Rus yoki nemis tilini **ovozli suhbat** orqali o'rgatadigan veb-sayt (goprep.gg
uslubida). Telefonda ham, kompyuterda ham ishlaydi:

- til tanlanadi: rus tilida ustoz **Anna**, nemis tilida ustoz **Hans**;
- dars oldidan tanlanadi: ustoz rejimi (**Mehribon** yoki **Qattiqqo'l** — hazil aralash
  koyiydi, lekin so'kinmaydi), mavzu (tanishuv, do'kon, restoran, sayohat, ish
  suhbati yoki erkin suhbat) va daraja ("Bilmayman" desangiz, ustoz o'zi aniqlaydi);
- 10 daqiqalik dars boshlanadi (yuqorida taymer va "Stop" tugmasi);
- ekran o'rtasidagi ustoz yuzchasi gapiradi va kayfiyatini ko'rsatadi:
  xotirjam, xursand, yulduz ko'zli, o'ylayotgan, hayron va olovli "jahldor"
  (bir xil xato takrorlansa — hazil tariqasida);
- ustoz gapini tugatgach, mikrofon o'zi yoqiladi — siz javob berasiz;
- xatolar darhol tuzatiladi va **o'zbek tilida** tushuntiriladi;
- pastdagi "O'zbekcha" tugmasi bilan o'zbek tilida ham savol berish mumkin;
- ustozning gapi ekranda matn bo'lib ham chiqadi (o'chirib qo'yish mumkin);
- mikrofon ishlamasa, klaviatura tugmasi orqali yozib yuborish mumkin;
- dars oxirida **hisobot** chiqadi: taxminiy daraja, xatolar va ularning to'g'risi,
  yangi so'zlar tarjimasi bilan, keyingi dars uchun maslahat.

### O'yinlar va testlar

Til tanlangach menyu ochiladi: ovozli darsdan tashqari 4 ta o'yin bor.

- 📝 **Test** — grammatika, so'z ma'nosi va bo'sh joyni to'ldirish, har javobdan keyin o'zbekcha izoh;
- 🧩 **So'z juftlash** — so'zni o'zbekcha tarjimasiga ulash (so'z bosilganda ovozda o'qiladi);
- 🔤 **Gap tuzish** — aralash so'zlardan to'g'ri gap terish;
- 🎧 **Eshitib top** — ovozni eshitib, 4 ta o'xshash so'zdan to'g'risini tanlash.

Savollarni har safar Claude yangidan tuzadi — tanlangan mavzu va darajaga mos.
Oxirgi ovozli darsdagi xatolar va yangi so'zlar keyingi o'yinlarga qo'shiladi.
Ustoz yuzchasi javobga qarab xursand bo'ladi, hayron qoladi yoki (qattiqqo'l
rejimda) jahl qiladi; ball, yulduzlar va har o'yindagi eng yaxshi natija saqlanadi.

O'qituvchining qoidalari va o'yin topshiriqlari `src/prompt.js` faylida turadi.

## Tuzilishi

- `public/` — sayt sahifasi (`index.html`, `style.css`, `face.js` — yuzcha,
  `app.js` — menyu, ovoz, taymer va suhbat, `games.js` — o'yinlar)
- `src/server.js` — sahifani ko'rsatadi va `/api/chat` orqali Claude bilan
  bog'lanadi. API kalit faqat serverda turadi, brauzerga chiqmaydi.

Ovozni tanish brauzerning o'zida ishlaydi (Web Speech API). Eng yaxshi natija —
Chrome (Android va kompyuter).

## Tabiiy ovoz (Azure, ixtiyoriy)

Sukut bo'yicha ustoz telefonning o'z ovozida gapiradi — u robotga o'xshaydi, ko'p
qurilmalarda esa o'zbekcha ovoz yo'q. Odamnikiga o'xshash ovoz uchun Microsoft
Azure ulanadi: unda rus, nemis va **o'zbek** tilidagi tabiiy ovozlar bor
(Anna — Svetlana va Madina, Hans — Conrad va Sardor ovozlari).

1. https://portal.azure.com da ro'yxatdan o'ting va "Speech service" yarating
   (bepul "F0" tarifi oyiga 500 000 belgigacha yetadi).
2. "Keys and Endpoint" bo'limidan kalit va regionni (masalan `westeurope`) oling.
3. `.env` fayliga (yoki Render sozlamalariga) yozing:
   ```
   AZURE_SPEECH_KEY=...
   AZURE_SPEECH_REGION=westeurope
   ```

Kalit bo'lmasa yoki Azure javob bermasa, sayt avtomatik ravishda brauzer ovoziga
o'tadi.

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
2. `ANTHROPIC_API_KEY` (va xohlasangiz `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`) qiymatlarini kiriting.
3. Deploy tugagach, Render bergan manzil (masalan `https://til-sayt.onrender.com`)
   orqali sayt hamma uchun ochiladi.

Telefonda saytni ochib, brauzer menyusidan "Bosh ekranga qo'shish" ni tanlasangiz,
u oddiy ilovadek ochiladi.

Bir IP manzildan daqiqasiga 20 tadan ortiq xabar (va 90 tadan ortiq ovoz so'rovi) qabul qilinmaydi — bu API
xarajatini begona so'rovlardan himoya qiladi.
