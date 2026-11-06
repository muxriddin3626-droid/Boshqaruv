# 🐧 Xotiralar muzeyi

Telefon va kompyuterda ochiladigan kichik 3D saytcha-o'yin. Iliq yoritilgan xonada
pingvinni yurgizasiz: devorlarda rasmlaringiz, atrofda atirgullar, shamlar va sharlar.
Pingvin rasmga yaqinlashganda yozuv chiqadi va u xursand bo'lib sakraydi. Xona oxiridagi
qizil gilamga yetganda yakuniy xabar ochiladi.

## Qanday sozlanadi
1. Rasmlarni `photos/` papkaga qo'ying (`1.jpg`, `2.jpg`, …).
2. `config.js` faylida sarlavha, xabarlar va har bir rasm ostidagi yozuvni (`caption`) o'zgartiring.
   Oxirgi rasm xonaning ro'parasidagi devorga katta qilib osiladi.
3. Musiqa kerak bo'lsa, `music.mp3` ni shu papkaga qo'yib, `config.js` da `music: "music.mp3"` deb yozing.

Rasm topilmasa, uning o'rnida "Rasm N" degan bo'sh ramka chiqadi.
Saytdagi 📷 tugmasi rasmlarni faqat shu qurilmada vaqtincha almashtiradi (sinab ko'rish uchun).

## Boshqaruv
- Telefon: chap pastdagi joystik.
- Kompyuter: `W A S D` yoki strelkalar.

## Ishga tushirish
Brauzerda to'g'ridan-to'g'ri `index.html` ni ochib bo'lmaydi (rasmlar yuklanmaydi), oddiy server kerak:

```bash
cd muzey
python3 -m http.server 8000
# keyin brauzerda: http://localhost:8000
```

Internetga chiqarish uchun `muzey/` papkasini GitHub Pages, Netlify yoki Vercel'ga joylang.
Three.js `lib/` ichida, shuning uchun hech qanday CDN kerak emas.
