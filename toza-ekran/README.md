# Toza Ekran — 18+ kontentni bloklovchi Android ilova

Telefonda 18+ matn, sayt yoki rasm/video chiqishi bilan ekranni yopadi va
Bosh ekranga qaytaradi. Brauzer, Telegram, Instagram, YouTube — barcha
ilovalarda ishlaydi.

## Qanday ishlaydi

| Qatlam | Nima qiladi |
|---|---|
| **Matn filtri** | Ekrandagi matnni o'qiydi: sayt manzili (pornhub, xvideos…), Telegram kanal nomi, qidiruv so'zi (porno, 🔞, секс…). O'zbek, rus, ingliz tillarida. |
| **AI rasm filtri** | Android 11+ da har 1,5 soniyada ekran rasmini telefonning **o'zida** MobileNetV2 modeli bilan tekshiradi (porn / hentai / sexy). Internetga hech narsa yuborilmaydi. |
| **Bloklash** | Orqaga + Bosh ekran, ustidan qora "18+ kontent bloklandi" oynasi. |
| **Ota-ona nazorati** | PIN-kod, Sozlamalarda ilova sahifasi ochilsa PIN so'rash, qurilma administratori (oddiy o'chirishdan himoya). |
| **Xavfsiz DNS** | `family.cloudflare-dns.com` ni Shaxsiy DNS ga qo'yish yo'riqnomasi — 18+ saytlar tarmoq darajasida ham yopiladi. |

Sezgirlik: **Past** (faqat 18+ saytlar va aniq porno), **O'rta** (tavsiya),
**Yuqori** (bolalar uchun — "sex", "18+", "bikini" kabi so'zlar ham).

## O'rnatish

1. GitHub → **Actions** → "Toza Ekran APK" → oxirgi muvaffaqiyatli ishga tushirish →
   **TozaEkran-apk** ni yuklab oling, zip ichidagi `TozaEkran.apk` ni telefonga o'rnating.
2. Ilovani oching → **Himoyani yoqish** → Maxsus imkoniyatlar → Toza Ekran → Yoqish.
   - Android 13+ da "Cheklangan sozlama" chiqsa: Ilova haqida → ⋮ →
     "Cheklangan sozlamalarga ruxsat berish", keyin qayta yoqing.
3. (Ota-ona uchun) PIN-kod o'rnating, "O'chirib yuborishdan himoya" va
   "Qurilma administratori" ni yoqing.

## Yig'ish (kompyuterda)

Android Studio bilan `toza-ekran` papkasini oching yoki:

```
cd toza-ekran
gradle assembleDebug
```

## Cheklovlar

- AI rasm filtri Android 11 (API 30) dan boshlab ishlaydi; eski telefonlarda faqat matn filtri.
- `FLAG_SECURE` ilovalar (masalan, bank) ekran rasmi qora chiqadi — ular tekshirilmaydi.
- AI 100% aniq emas: ba'zan o'tkazib yuborishi yoki suzish kiyimidagi rasmni bloklashi mumkin.
- Telefon sozlamalarini to'liq biladigan odam xavfsiz rejim orqali o'chira oladi —
  to'liq himoya uchun Google Family Link bilan birga ishlatish tavsiya etiladi.

## Model

`app/src/main/assets/nsfw.tflite` — [GantMan/nsfw_model](https://github.com/GantMan/nsfw_model)
(MIT litsenziyasi), MobileNetV2 140 224, 5 sinf: drawings, hentai, neutral, porn, sexy.
