# Maxfiy Ekran (Samsung / Android)

Telefon ekrani ustiga qoraytiruvchi, mayda chiziqli **maxfiylik filtri** qo'yadigan ilova.
Siz ekranga to'g'ridan qaraganingizda hammasini ko'rasiz, yondan yoki uzoqdan
qaragan odam uchun esa ekran qorong'i va matn o'qilmaydigan bo'lib qoladi.

## Imkoniyatlar
- Bir tugma bilan yoqish/o'chirish (ilova ichida, bildirishnomada va tezkor panelda)
- Kuchini sozlash (0–80%)
- 4 xil naqsh: gorizontal chiziqlar, katakcha, chetlari qorong'i, oddiy qoraytirish
- Filtr barcha ilovalar ustida ishlaydi, bosishlarga xalaqit bermaydi

## APK'ni olish
1. GitHub'da **Actions → Maxfiy Ekran APK** bo'limiga kiring.
2. Oxirgi muvaffaqiyatli ishga tushirishni oching, pastdagi **maxfiy-ekran-apk** faylini yuklab oling.
3. Zip ichidagi `app-release.apk` ni telefonga o'rnating
   (Samsung "Noma'lum manbalardan o'rnatish"ga ruxsat so'raydi).

## Ishlatish
1. Ilovani oching → **Ruxsat berish** → "Maxfiy Ekran"ga "Boshqa ilovalar ustida ko'rsatish"ni yoqing.
2. **Maxfiylik filtri**ni yoqing, kuchini o'zingizga moslang.
3. Qulaylik uchun: yuqoridan pastga suring → ✏️ → "Maxfiy ekran" tugmasini panelga qo'shing.

## Muhim: cheklov haqida
Ekranning qaysi burchakdan ko'rinishi — bu **apparat** (displey) xususiyati. Hech bir
ilova yon tomondan ko'rinishni 100% o'chira olmaydi. Bu ilova yorug'likni pasaytirish va
jalyuzi-simon naqsh orqali yon/uzoqdan o'qishni ancha qiyinlashtiradi (AMOLED ekranlar
qiya burchakda baribir xiralashadi, filtr buni kuchaytiradi).

To'liq himoya uchun:
- **Privacy (antishpion) himoya oynasi/plyonkasi** — eng ishonchli va arzon yo'l;
- Galaxy S26 Ultra kabi modellardagi **Privacy Display** apparat funksiyasi
  (Sozlamalar → Displey).

Eng yaxshi natija: plyonka yo'q bo'lsa, ushbu filtr + Samsung'ning **Qo'shimcha xira**
(Extra dim) + **Qora rejim** birga.

## Texnik
- Java, faqat Android SDK (qo'shimcha kutubxonasiz), minSdk 26, targetSdk 35
- Lokal yig'ish: Android SDK o'rnatilgan kompyuterda `cd maxfiy-ekran && ./gradlew assembleRelease`
