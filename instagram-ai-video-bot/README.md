# Instagram AI Video Bot

Har kuni avtomatik ravishda motivatsion AI video tayyorlab, Instagram Reels'ga
joylaydigan Telegram boshqaruvli bot.

**Muhim ogohlantirish:** hech qanday bot yoki dastur "yangi yilgacha 1 million
obunachi" ni kafolatlay olmaydi — bu kontent sifati, davomiylik va Instagram
algoritmiga bog'liq. Bu loyiha sizga **doimiy, sifatli kontentni avtomatik
ishlab chiqarish va joylash** ishini olib tashlaydi, qolgani (nisha tanlash,
sarlavhalar, trendlarni kuzatish) sizning qo'lingizda.

## Qanday ishlaydi

1. Iqtiboslar ro'yxatidan (`src/quotes.js`) birini tanlaydi (oxirgi
   ishlatilganlarni takrorlamaslikka harakat qiladi).
2. [Pexels](https://www.pexels.com/api/) orqali mavzuga mos, litsenziyasiz fon
   video topib yuklaydi.
3. Matnni Microsoft Edge'ning bepul neyron ovozi orqali (o'zbekcha) audio
   qilib o'qiydi.
4. `ffmpeg` yordamida fon video + ovoz + chiroyli matn subtitrini
   birlashtirib, 1080x1920 (Reels formatidagi) video yig'adi.
5. Videoni Telegram orqali sizga (adminga) yuboradi - tasdiqlasangiz yoki
   avtomatik rejim yoqilgan bo'lsa, Instagram Graph API orqali Reels sifatida
   joylanadi.

## Kerakli narsalar

- Node.js 20+
- Telegram bot tokeni
- Pexels API kaliti (bepul)
- Instagram Business/Creator akkaunt + Meta Graph API access token
  (Instagramga avtomatik joylash uchun; bo'lmasa ham bot video tayyorlab
  bera oladi, joylashni qo'lda qilasiz)

## 1. Telegram bot yaratish

1. Telegram'da [@BotFather](https://t.me/BotFather) ga yozing, `/newbot`
   buyrug'ini yuboring, nom bering.
2. Sizga beriladigan tokenni `.env` faylida `BOT_TOKEN` ga yozing.
3. O'zingizning chat ID'ingizni bilish uchun [@userinfobot](https://t.me/userinfobot)
   ga `/start` yozing, chiqqan ID'ni `ADMIN_CHAT_IDS` ga yozing (bir nechta
   admin bo'lsa vergul bilan ajrating).

## 2. Pexels API kaliti

1. https://www.pexels.com/api/ sahifasida ro'yxatdan o'ting.
2. https://www.pexels.com/api/new/ dan bepul API kalit oling.
3. `.env` faylidagi `PEXELS_API_KEY` ga yozing.

## 3. Instagram Graph API sozlash (avtomatik joylash uchun)

Bu qism eng ko'p vaqt oladigan qism, chunki Instagram shaxsiy akkauntlarga
dastur orqali post joylashga ruxsat bermaydi - faqat **Business/Creator**
akkauntlarga, Facebook orqali.

1. **Instagram akkauntingizni Business yoki Creator turiga o'tkazing**:
   Instagram ilovasi → Sozlamalar → Akkaunt turi → Professional akkaunt.
2. Instagram akkauntingizni bitta **Facebook Sahifa (Page)** ga bog'lang
   (Sahifangiz bo'lmasa, Facebook'da yangi Sahifa yarating - bu bepul).
3. [Meta for Developers](https://developers.facebook.com/) da yangi **App**
   yarating ("Business" turi).
4. Ilovangizga **Instagram Graph API** mahsulotini qo'shing.
5. [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   orqali quyidagi ruxsatlar (permissions) bilan token oling:
   `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`,
   `pages_show_list`.
6. Bu token 1-2 soatlik bo'ladi - uni **uzoq muddatli (60 kunlik) tokenga**
   almashtiring:
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id=<APP_ID>
     &client_secret=<APP_SECRET>
     &fb_exchange_token=<QISQA_TOKEN>
   ```
7. Instagram Business akkauntingizning ID'sini toping:
   ```
   GET https://graph.facebook.com/v21.0/me/accounts?access_token=<TOKEN>
   ```
   qaytgan Sahifa ID'si bilan:
   ```
   GET https://graph.facebook.com/v21.0/<PAGE_ID>?fields=instagram_business_account&access_token=<TOKEN>
   ```
8. Olingan token va ID'ni `.env` fayliga yozing:
   ```
   IG_ACCESS_TOKEN=...
   IG_BUSINESS_ACCOUNT_ID=...
   ```

**Eslatma:** 60 kunlik token muddati tugaydi - uni vaqti-vaqti bilan
yangilab, Render'dagi environment variable'ni yangilab turishingiz kerak.
Doimiy avtomatlashtirish uchun keyinchalik token yangilashni ham
avtomatlashtirish mumkin.

Agar bu bosqich hozircha juda murakkab bo'lsa - muammo emas: `IG_ACCESS_TOKEN`
va `IG_BUSINESS_ACCOUNT_ID` ni bo'sh qoldiring, bot video tayyorlab Telegram
orqali sizga yuboraveradi, joylashni qo'lda (Instagram ilovasi orqali)
qilasiz.

## 4. `.env` faylini sozlash

```bash
cp .env.example .env
```

va barcha qiymatlarni to'ldiring.

## 5. Lokal ishga tushirish

```bash
npm install
npm start
```

Bot Telegram'da polling rejimida ishga tushadi. `/video` yozib sinab
ko'ring.

## 6. Render'ga joylash

1. Bu papkani (yoki butun repozitoriyni) GitHub'ga push qiling.
2. [Render](https://render.com) da "New Web Service" → repozitoriyni
   tanlang → Root Directory sifatida `instagram-ai-video-bot` ni ko'rsating.
3. `render.yaml` avtomatik aniqlanadi (Blueprint sifatida ham deploy
   qilishingiz mumkin).
4. Render Dashboard → Environment bo'limida barcha `.env.example` dagi
   qiymatlarni kiriting.
5. Deploy tugagach, bot avtomatik ravishda webhook rejimiga o'tadi va
   `PUBLIC_BASE_URL` ni o'zi (`RENDER_EXTERNAL_URL` orqali) aniqlaydi.

**Diqqat:** Render'ning bepul tarifi uzoq vaqt so'rov kelmasa "uxlab qoladi"
va bu kunlik avtomatik vazifani kechiktirishi mumkin. Buning oldini olish
uchun [UptimeRobot](https://uptimerobot.com) kabi bepul xizmat bilan
serveringizni har 10-15 daqiqada "uyg'otib" turishingiz tavsiya etiladi,
yoki Render'ning pullik tarifiga o'tish.

## Buyruqlar

- `/video` - hozir bitta video tayyorlab, tasdiqlash uchun yuboradi
- `/holat` - joriy sozlamalarni ko'rsatadi
- `/auto_yoq` - kunlik videoni **avtomatik** Instagramga joylashni yoqadi
- `/auto_ochir` - avtomatik joylashni o'chiradi (video tasdiq kutadi)

Video tasdiqlash xabari ostida uchta tugma chiqadi: **✅ Instagramga
joylash**, **🔄 Boshqa video**, **❌ Bekor qilish**.

## Kontentni o'zgartirish

- Iqtiboslarni `src/quotes.js` faylida qo'shing/o'zgartiring - har birida
  `mood` maydoni fon video qidirish uchun (inglizcha) kalit so'z.
- Ovoz (til/talaffuz)ni `.env` dagi `TTS_VOICE` orqali o'zgartirish mumkin
  (masalan `ru-RU-SvetlanaNeural`, `en-US-AriaNeural`).
- Caption va hashtaglarni `src/pipeline.js` dagi `buildCaption` funksiyasida
  tahrirlang.

## Cheklovlar

- Bu MVP - kontent sifatini oshirish (turli fon uslublari, fon musiqasi,
  animatsiyalar, bir nechta ovoz varianti) keyingi bosqichlarda qo'shilishi
  mumkin.
- Render bepul tarifida disk doimiy emas - "ishlatilgan iqtiboslar" tarixi
  server qayta ishga tushganda tozalanishi mumkin.
- Instagram Graph API cheklovlari (kuniga nechta post joylash mumkinligi)
  Meta tomonidan belgilanadi.
