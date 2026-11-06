# 🐧 Xotiralar muzeyi

Telefon va kompyuterda ochiladigan kichik 3D saytcha-o'yin. Iliq yoritilgan xonada
pingvinni yurgizasiz: devorlarda rasmlaringiz, atrofda atirgullar, shamlar va sharlar.

## Rasmlarni qo'yish va ulashish (eng oson yo'l)
1. Saytni oching, **Kirish** ni bosing.
2. 📷 tugmasi bilan telefoningizdan rasmlarni tanlang (8 tagacha).
3. **💾 Saqlash** ni bosing — rasmlar internetga yuklanadi va sizga alohida havola beriladi
   (`...netlify.app/?g=...`).
4. Shu havolani yuboring — uni ochgan har kim sizning rasmlaringizni ko'radi.

> Bu ishlashi uchun sayt Netlify'ga **GitHub orqali** ulangan bo'lishi kerak
> (Netlify Drop orqali joylansa, rasmlarni saqlash ishlamaydi).

## Tuzilishi
- `public/` — saytning o'zi (`config.js` da matnlar va musiqa)
- `netlify/functions/api.mjs` — rasmlarni Netlify Blobs'da saqlaydigan kichik server qismi

## Boshqaruv
- Telefon: chap pastdagi joystik; bir barmoq bilan surish — kamerani burish, ikki barmoq — yaqinlashtirish.
- Kompyuter: `W A S D` / strelkalar, sichqoncha bilan surish, g'ildirak bilan zoom.
