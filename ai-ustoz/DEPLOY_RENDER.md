# AI Ustoz'ni Render'ga joylash (telefondan, kompyutersiz)

Natijada AI Ustoz `https://ai-ustoz.onrender.com` kabi manzilda 24 soat ishlaydi.
Hammasi telefon brauzeridan (Chrome yoki Safari) qilinadi, terminal kerak emas.

**Kerak bo'ladi:**
- GitHub akkaunt (sizda bor);
- xalqaro to'lovga ochiq bank karta (Visa yoki Mastercard);
- 30–40 daqiqa vaqt.

**Oylik xarajat (taxminan):**

| Nima | Narxi |
|---|---|
| Render server (Starter) + 1 GB disk | ~7,25 $/oy |
| Render Redis | bepul |
| Neon baza | bepul |
| OpenAI | ishlatganingizcha; 12 ta darslikni bir marta o'qitish ≈ 6 $ |

Narxlar saytlarda o'zgarishi mumkin.

---

## 1-qadam. OpenAI kaliti (AI Ustozning "miyasi")

1. **platform.openai.com** ni oching va **Sign up** orqali ro'yxatdan o'ting.
2. Chap menyudan **Settings → Billing** ga kiring va **Add payment method** orqali kartani qo'shing.
3. **Add to credit balance** bilan hisobni to'ldiring, masalan 10 $.
4. **API keys → Create new secret key** ni bosing, nomini `ai-ustoz` qiling va **Create** ni bosing.
5. Chiqqan `sk-...` kalitni **nusxalab, xavfsiz joyga saqlang** (masalan, telefondagi eslatmaga). U faqat bir marta ko'rsatiladi.

> Kalitni hech kimga bermang, chatlarga ham yozmang: kalitni bilgan odam sizning hisobingizdan pul sarflay oladi.

## 2-qadam. Neon baza (bepul)

1. **neon.tech** ni oching va **Sign up → Continue with GitHub** ni bosing.
2. **Create project** ni bosing:
   - **Project name:** `ai-ustoz`;
   - **Region:** `AWS Europe Central 1 (Frankfurt)` (server bilan bir joyda bo'lgani uchun tezroq ishlaydi).
3. Loyiha ochilgach, **Connect** tugmasini bosing.
4. `postgresql://...neon.tech/neondb?sslmode=require...` ko'rinishidagi **ulanish satrini nusxalang** va saqlang.

## 3-qadam. Render: bitta tugma bilan ishga tushirish

1. **render.com** ni oching va **Get Started → GitHub** bilan kiring.
2. GitHub ruxsat so'rasa, `Boshqaruv` repozitoriyasiga ruxsat bering.
3. **New + → Blueprint** ni tanlang.
4. Repozitoriyalar ro'yxatidan **Boshqaruv** ni tanlang va **Connect** ni bosing.
5. **Branch** maydonida `claude/ai-ustoz-tutor-platform-xsuzfk` ni tanlang. Agar keyinchalik bu o'zgarishlar `main` ga birlashtirilgan bo'lsa, `main` ni tanlang.
6. **Blueprint Name:** `ai-ustoz`.
7. Render 2 ta xizmatni ko'rsatadi:
   - `ai-ustoz` — sayt va AI server (Starter);
   - `ai-ustoz-kv` — Redis (Free).
8. Quyidagi 3 ta maydonni to'ldiring:

   | Maydon | Nima yoziladi |
   |---|---|
   | `DATABASE_URL` | 2-qadamdagi Neon ulanish satri |
   | `OPENAI_API_KEY` | 1-qadamdagi `sk-...` kalit |
   | `ADMIN_PHONES` | Sizning telefon raqamingiz, aynan shu ko'rinishda: `+998901234567`. Bir nechta admin bo'lsa, vergul bilan yozing. |

9. **Apply** ni bosing. Render karta so'rasa, qo'shing (Starter pullik).
10. Birinchi qurish **5–15 daqiqa** davom etadi. `ai-ustoz` xizmatining **Logs** bo'limida oxirida quyidagi qatorlar chiqsa, tayyor:
   ```
   schema.sql bajarildi
   Uvicorn running on http://0.0.0.0:10000
   ```

## 4-qadam. Saytni ochish va darsliklarni qo'shish

1. Render'da `ai-ustoz` xizmati sahifasining tepasidagi manzilni oching, masalan `https://ai-ustoz.onrender.com`.
2. Ro'yxatdan o'ting. Telefon raqamni **3-qadamdagi `ADMIN_PHONES` bilan bir xil** qilib kiriting.
3. Yuqoridagi bo'limlar orasidan **"Darsliklar"** ni oching. U faqat adminlarga ko'rinadi.
4. "Ilova ichida 12 ta darslik tayyor turibdi" qutisidagi **"Hammasini bilim bazasiga qo'shish"** ni bosing.
5. Darsliklar bittadan qayta ishlanadi, hammasi uchun taxminan 30–60 daqiqa ketadi. Sahifani yopsangiz ham davom etadi. Har bir kitob yonida "✓ Tayyor" chiqadi.

Tamom! Saytning manzilini o'quvchilarga yuboring. Telefonda **"Bosh ekranga qo'shish"** (Add to Home screen) qilinsa, oddiy ilovadek ochiladi.

---

## Yangilanishlar

GitHub'dagi shu tarmoqqa yangi o'zgarish kelsa, Render saytni **o'zi qayta quradi** (5–10 daqiqa).
Baza va yuklangan fayllar saqlanib qoladi.

Yangi darslik qo'shish uchun ikki yo'l bor:
- **Ilovada:** "Darsliklar" → PDF tanlash → "Yuklash".
- **GitHub orqali:** faylni `ai-ustoz/data/textbooks/<fan>/` papkasiga yuklang. Render qayta qurgandan keyin "Darsliklar" bo'limida yangi kitobni qo'shish tugmasi chiqadi.

## Muammo bo'lsa

| Belgi | Sabab va yechim |
|---|---|
| "Darsliklar" bo'limi ko'rinmaydi | `ADMIN_PHONES` dagi raqam ro'yxatdan o'tgan raqam bilan aynan bir xil emas (`+998` bilan, bo'shliqsiz). Render → `ai-ustoz` → **Environment** da tuzating, keyin ilovadan chiqib qayta kiring. |
| Kitob yonida "OpenAI kaliti noto'g'ri" | `OPENAI_API_KEY` ni tekshiring (Environment), keyin "Qayta urinish" ni bosing. |
| "OpenAI hisobida mablag' tugagan" | platform.openai.com → Billing da hisobni to'ldiring, keyin "Qayta urinish" ni bosing. |
| Kitob yonida "Server qayta ishga tushdi" | Yangilanish paytida ish to'xtagan. "Qayta urinish" ni yoki qutidagi qo'shish tugmasini qayta bosing. |
| Logs'da `Bazaga ulanib bo'lmadi` | `DATABASE_URL` noto'g'ri nusxalangan bo'lishi mumkin. Neon'dan qayta nusxalang, boshi `postgresql://` bilan boshlanishi kerak. |
| Sayt birinchi ochilishda sekin | Bepul Neon bazasi uzoq ishlatilmasa "uxlaydi" va birinchi so'rovda 1–2 soniyada uyg'onadi. Bu normal. |
