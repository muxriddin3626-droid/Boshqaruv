# Ovozli yordamchi (Android)

Telefonni o'zbekcha ovoz bilan boshqaradigan ilova: qo'ng'iroq qiladi, qo'ng'iroqni
ko'taradi / rad etadi, SMS yozadi, fonarni yoqadi, ilovalarni ochadi.

## O'rnatish

1. GitHub'da **Releases → "Ovozli yordamchi (oxirgi versiya)"** bo'limidan
   `ovoz-yordamchi.apk` faylini telefoningizga yuklab oling
   (yoki **Actions → Ovozli yordamchi APK → ovoz-yordamchi-apk** artefaktidan).
2. Faylni ochib o'rnating ("Noma'lum manbalardan o'rnatish"ga ruxsat bering).
3. Ilovani ochib, so'ralgan barcha ruxsatlarni bering (mikrofon, qo'ng'iroq, kontaktlar, SMS).
4. Telefonda **Google** ilovasi bo'lishi kerak — ovozni u taniydi.
   Google ilovasi sozlamalarida **O'zbek tili**ni ovoz bilan qidirish tillariga qo'shing.

## Buyruqlar

| Aytasiz | Nima bo'ladi |
|---|---|
| "Aliga qo'ng'iroq qil" / "Akamga tel qil" | Kontaktlardan topib qo'ng'iroq qiladi |
| "90 123 45 67 ga qo'ng'iroq qil" | Raqamga qo'ng'iroq qiladi |
| "Onamga sms yoz, uyga kechroq boraman" | Matnni o'qib beradi, "ha" desangiz yuboradi |
| "Akamga «qayerdasan» deb xabar yubor" | Xuddi shunday |
| "Aliga sms yoz" | "Nima deb yozay?" deb so'raydi |
| Telefon jiringlaganda: "Ko'tar" / "Ha" | Qo'ng'iroqni ko'taradi |
| Telefon jiringlaganda: "O'chir" / "Yo'q" / "Rad et" | Qo'ng'iroqni rad etadi |
| "Fonarni yoq" / "Fonarni o'chir" | Fonar |
| "Soat necha?" / "Bugun nechanchi?" | Vaqt / sana |
| "Telegramni och" | Ilovani ochadi |

## Qanday chaqiriladi

- **Ilovadagi mikrofon tugmasi** yoki bildirishnomadagi **"Gapirish"** tugmasi.
- **"Qo'ng'iroq kelganda ovoz bilan ko'tarish"** yoqilsa — telefon jiringlaganda
  ilova kim qo'ng'iroq qilayotganini aytadi va "Ko'taraymi?" deb so'raydi.
- **"Doimiy tinglash"** yoqilsa — qo'l tekkizmasdan **"Yordamchi, Aliga qo'ng'iroq qil"**
  deyish mumkin. Bu rejim batareyani ko'proq sarflaydi va ba'zi telefonlarda
  har tinglashda qisqa "dit" ovozi chiqadi.
- **"Asosiy yordamchi qilish"** — sozlamalarda shu ilovani tanlasangiz,
  "Uy" tugmasini bosib turganda ochiladi (hamma telefonlarda ham chiqmaydi).

## Cheklovlar

- Qo'ng'iroqni ovoz bilan rad etish Android 9 va undan yangi versiyalarda ishlaydi.
- Xiaomi/Huawei kabi telefonlarda ilovaga **"Avtoishga tushirish"** va
  **"Batareya cheklovisiz"** ruxsatini bering, aks holda fon xizmatini tizim o'chirib qo'yadi.
- Ovoz tanish internet orqali ishlaydi (Google xizmati).

## Yig'ish

```
cd ovoz-yordamchi
gradle testDebugUnitTest assembleDebug
```
