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

### Tez o'rganish uchun

- 🗺️ **Kurs xaritasi (A1 → B1)** — 12 bosqich (salomlashish, raqamlar, oila, kun
  tartibi, ovqat, do'kon, shahar, o'tgan zamon, ob-havo, sog'liq, ish, sayohat).
  Har bosqichning o'z grammatikasi bor (rus va nemis tili uchun alohida) va 4 qadami:
  ovozli dars, yangi so'zlar, talaffuz va imtihon. Imtihondan 75% bilan o'tilsa,
  keyingi bosqich ochiladi. Bosqichlar `public/course.js` faylida.
- 🧠 **Aqlli takrorlash** — darslar, o'yinlar va hikoyalardagi yangi so'zlar va
  xatolar so'z daftariga yig'iladi. Har so'z 1, 3, 7, 16, 35, 80 kundan keyin
  qaytadan so'raladi; bilmagan so'z boshidan boshlanadi.
- 📒 **Ustoz xotirasi** — dars oxiridagi hisobotdan xatolar va xulosa saqlanadi.
  Keyingi darsda ustoz o'quvchini eslaydi, o'tgan darsni eslatadi va oldingi
  xatolarni ataylab qayta mashq qildiradi. Daftarda so'zlar va xatolar ro'yxati bor.
- 🗣️ **Talaffuz** — ustoz iborani aytadi, o'quvchi takrorlaydi; sayt nima
  deganini tanib, to'g'ri aytilgan so'zlarni yashil, xatolarini qizil ko'rsatadi
  (80% dan yuqori — o'tdi, 3 urinish).
- 🔥 **Kunlik odat** — har mashq uchun XP, kunlik maqsad (20 / 50 / 100 XP),
  ketma-ket kunlar (streak) va haftalik ko'rinish. "⏰ Eslatma" tugmasi telefon
  taqvimiga har kungi eslatma (`.ics` fayl) qo'shadi — server kerak emas.
- 📖 **Hikoyalar** — darajaga mos qisqa hikoya: ustoz o'qib beradi, so'z
  bosilsa tarjimasi chiqadi va daftarga qo'shish mumkin, oxirida 3 ta savol.

Bu ma'lumotlarning hammasi foydalanuvchi brauzerida (localStorage) saqlanadi.

### Imtihonga tayyorgarlik va sertifikat

- 🎓 **Sinov imtihoni** — rasmiy imtihonlar formatida: rus tili uchun **ТРКИ A1**
  va **ТРКИ-1 (B1)**, nemis tili uchun **Goethe A1** va **Goethe B1**
  (`public/exams.js`). Bo'limlar: lug'at va grammatika (ТРКИ), o'qish, tinglash
  (matnni 2 marta eshitish mumkin), yozish va gapirish — har biri vaqt cheklovi
  bilan. Yozish va gapirishni Claude imtihon oluvchidek 0-100 ballga baholaydi,
  kuchli tomonlar, tavsiyalar va to'g'rilangan variantni beradi. Natijada har
  bo'lim balli, o'tish chegarasi (Goethe — jami 60%, ТРКИ — har bo'limdan 66%),
  "o'tish ehtimoli" va eng zaif bo'lim uchun mashq tavsiyasi chiqadi.
  To'liq sinov yoki faqat bitta bo'limni mashq qilish mumkin.
- 📜 **Til Ustoz sertifikati** — kursning A1, A2 yoki B1 darajasidagi barcha bosqich
  imtihonlari topshirilsa, ism-familiya yozilgan sertifikat (PNG) chiqadi: yuklab
  olish yoki telefondan ulashish mumkin. Sertifikatda "rasmiy til sertifikati emas"
  deb aniq yozilgan — u ТРКИ yoki Goethe-Zertifikat o'rnini bosmaydi.

- 🛂 **Patent imtihoni** (rus tili) — Rossiyada ishlash uchun patent olishda
  topshiriladigan imtihon formatida: rus tili (o'qish, grammatika, tinglash,
  blanka to'ldirish, gapirish), 📜 Rossiya tarixi va ⚖️ qonunchilik asoslari.
  Tinglash va gapirishdan alohida eng kam ball talab qilinadi. O'tish chegarasi
  taxminiy — qoidalar o'zgarib turadi, rasmiy manbadan tekshiring. Qonunchilik
  savollari faqat barqaror umumiy qoidalar haqida (aniq muddat va jarimalarsiz).
- **Mashq rejimi:** bitta bo'lim tanlansa, har savoldan keyin darhol to'g'ri javob
  va o'zbekcha izoh chiqadi. To'liq sinovda izohlar oxirida, natija bilan birga.
- Ovozli dars va o'yinlar uchun **"🛂 Migrant hayoti"** mavzusi: politsiya hujjat
  tekshiruvi, ish beruvchi, migratsiya xizmati, shifokor, kvartira, bank.

Rasmiy sertifikat faqat imtihon markazida topshirib olinadi: nemis tili —
Goethe-Institut (Toshkentda bor), shuningdek telc, ÖSD, TestDaF; rus tili — ТРКИ
(TORFL) test markazlari. Sana va narxlarni markazning rasmiy saytidan tekshiring.

### Kasbiy kurslar va rolli vaziyatlar

- 💼 **Kasbiy kurslar** — 8 ta kasb: quruvchi, haydovchi, oshpaz va ofitsiant,
  sotuvchi va kassir, kuryer va omborchi, hamshira va parvarishchi, zavod
  ishchisi, tozalash xizmati. Har kasbda 4 ta mavzu (masalan quruvchi: asboblar,
  xavfsizlik, brigadir bilan suhbat, ish haqi), har mavzuda 4 qadam: 🧩 so'zlar,
  📝 test, 🎙️ ustoz bilan dars va 🎭 rolli vaziyat (`public/scenarios.js`).
- 🎭 **Rolli vaziyatlar** — ustoz rol o'ynaydi (politsiyachi, ish beruvchi,
  kvartira egasi, shifokor, migratsiya xizmati xodimi, bank, ishga kirish suhbati,
  do'kon). O'quvchi 5 daqiqada maqsadga erishishi kerak; erishsa — vaziyat
  g'alaba bilan tugaydi. Ustoz xatoni darhol tuzatmaydi (haqiqiy hayotdagidek),
  faqat yordam so'ralsa o'zbekcha maslahat beradi; oxirida 0-100 baho va xatolar.

### Akkaunt, Premium va do'stlar

- 🔐 **Telegram orqali kirish** — parolsiz. Natijalar (so'zlar, streak, kurs,
  sertifikatlar, sozlamalar) bazaga sinxronlanadi va istalgan qurilmada ochiladi.
  Kirmasdan ham ishlatish mumkin — unda natijalar faqat shu brauzerda qoladi.
- ⭐ **Kunlik bepul limit va Premium** — bepul: kuniga 2 ta ovozli dars, 6 ta
  o'yin/hikoya, 10 ta imtihon bo'limi (sozlanadi). Takrorlash va daftar doim
  cheksiz. Premium — cheksiz. Premium **aktivatsiya kodlari** orqali beriladi:
  foydalanuvchi sizga to'laydi (Payme, Click yoki karta), siz unga kod berasiz.
- 👥 **Do'stlar va reyting** — har foydalanuvchining taklif havolasi bor; do'st
  shu havola orqali kirsa, ikkalasi do'st bo'ladi va 3 kun Premium oladi.
  Haftalik XP reytingi: do'stlar orasida va umumiy (dushanba kuni yangilanadi).
- 🏅 **Yutuq nishonlari** — 17 ta nishon (streak, so'zlar, talaffuz, kurs,
  imtihonlar, rolli vaziyatlar...) progress bilan.
- 📲 **Ilova sifatida o'rnatish va oflayn** — sayt telefonga ilova kabi
  o'rnatiladi; internetsiz ham ochiladi (takrorlash, daftar, natijalar ishlaydi).

### O'yinlar va testlar

Menyuda ovozli darsdan tashqari o'yinlar bor:

- 📝 **Test** — grammatika, so'z ma'nosi va bo'sh joyni to'ldirish, har javobdan keyin o'zbekcha izoh;
- 🧩 **So'z juftlash** — so'zni o'zbekcha tarjimasiga ulash (so'z bosilganda ovozda o'qiladi);
- 🔤 **Gap tuzish** — aralash so'zlardan to'g'ri gap terish;
- 🎧 **Eshitib top** — ovozni eshitib, 4 ta o'xshash so'zdan to'g'risini tanlash.

Savollarni har safar Claude yangidan tuzadi — tanlangan mavzu (yoki kurs bosqichi)
va darajaga mos. Xato qilingan so'zlar takrorlash daftariga tushadi.
Ustoz yuzchasi javobga qarab xursand bo'ladi, hayron qoladi yoki (qattiqqo'l
rejimda) jahl qiladi; ball, yulduzlar va har o'yindagi eng yaxshi natija saqlanadi.

O'qituvchining qoidalari va o'yin topshiriqlari `src/prompt.js` faylida turadi.

## Tuzilishi

- `public/` — sayt sahifasi (`index.html`, `style.css`, `face.js` — yuzcha,
  `app.js` — menyu, ovoz, taymer va suhbat, `games.js` — o'yinlar va talaffuz,
  `practice.js` — kurs, takrorlash, daftar, hikoya, kunlik maqsad, `learn.js` —
  brauzerda saqlanadigan o'rganish ma'lumotlari, `course.js` — kurs bosqichlari,
  `exams.js` va `exam.js` — sinov imtihonlari, `cert.js` — sertifikat)
- `public/` (davomi): `store.js` — saqlash va sinxronlash, `account-ui.js` —
  akkaunt va Premium, `social.js` — nishonlar va reyting, `roles.js` va
  `scenarios.js` — kasbiy kurslar va rolli vaziyatlar, `sw.js` va `pwa.js` — oflayn
  ishlash va o'rnatish
- `src/server.js` — sahifani ko'rsatadi va Claude bilan bog'lanadi. API kalit
  faqat serverda turadi, brauzerga chiqmaydi. `src/account.js`, `src/auth.js`,
  `src/db.js` — akkaunt, Telegram kirish, limitlar, Premium, do'stlar va baza.

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

## Akkaunt (Telegram orqali kirish) sozlash

1. Telegram'da @BotFather → `/newbot` — bot yarating (masalan `TilUstozBot`),
   tokenni oling.
2. @BotFather → `/setdomain` → botni tanlang → sayt manzilini kiriting
   (masalan `til-sayt.onrender.com`). Telegram tugmasi faqat shu domenda ishlaydi.
3. Muhit o'zgaruvchilari: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` va
   `SESSION_SECRET` (uzun tasodifiy satr).
4. Doimiy baza uchun Turso (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) — `hisob-bot`
   README'sidagi kabi. Usiz baza lokal faylda (`til-sayt.db`) bo'ladi va Render'ning
   bepul tarifida qayta ishga tushganda o'chib ketadi.

## Premium kodlari

Kod yaratish (30 kunlik 10 ta):

```bash
npm run codes -- 10 30
```

yoki sayt ishlab turganda (Render'da) `ADMIN_SECRET` bilan:

```bash
curl -X POST https://SIZNING-SAYT/api/admin/codes \
  -d '{"secret":"ADMIN_SECRET_QIYMATI","count":10,"days":30}'
```

Foydalanuvchi kodni "👤 Akkaunt → ⭐ Premium" bo'limida kiritadi. Narx va
bog'lanish uchun `PREMIUM_PRICE` va `PREMIUM_CONTACT` (masalan `@sizning_telegram`)
ni belgilang. Limitlarni `FREE_LESSONS`, `FREE_PRACTICE`, `FREE_EXAM_SECTIONS`
bilan o'zgartirish yoki `FREE_LIMITS=off` bilan butunlay o'chirish mumkin.

## Xarajat

Ovozli dars va yozish/gapirishni baholash asosiy modelda (`CLAUDE_MODEL`,
standart `claude-opus-5-5`), o'yin, hikoya, hisobot va imtihon topshiriqlari esa
tezroq va arzonroq modelda (`CLAUDE_FAST_MODEL`, standart `claude-sonnet-5-5`)
tuziladi.

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
