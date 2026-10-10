# AI Ustoz'ni Render'ga joylash (telefondan, kompyutersiz)

Natijada AI Ustoz `https://ai-ustoz.onrender.com` kabi manzilda 24 soat ishlaydi.
Faqat **2 ta sayt** kerak: **OpenAI** (AI) va **Render** (server, baza, sayt).
Hammasi telefon brauzeridan (Chrome yoki Safari) qilinadi, terminal kerak emas.

**Kerak bo'ladi:**
- GitHub akkaunt (sizda bor);
- xalqaro to'lovga ochiq bank karta (Visa yoki Mastercard);
- taxminan 30 daqiqa.

**Oylik xarajat (taxminan, saytlarda o'zgarishi mumkin):**

| Nima | Narxi |
|---|---|
| Render server (Starter) + 1 GB disk | ~7,25 $/oy |
| Render baza (Postgres, basic-256mb) | ~6 $/oy |
| Render Redis | bepul |
| OpenAI | ishlatganingizcha (suhbat, ovoz); darsliklarni o'qitish deyarli bepul (skaner sahifalarni server o'zi o'qiydi) |

---

## 1-qadam. OpenAI kaliti

1. **platform.openai.com** ni oching va **Sign up** orqali ro'yxatdan o'ting.
2. Chap menyudan **Settings → Billing** ga kiring va **Add payment method** orqali kartani qo'shing.
3. **Add to credit balance** bilan hisobni to'ldiring, masalan 10 $.
4. **API keys → Create new secret key** ni bosing, nomini `ai-ustoz` qiling va **Create** ni bosing.
5. Chiqqan `sk-...` kalitni **nusxalab saqlang**. U faqat bir marta ko'rsatiladi.

> Kalitni hech kimga bermang, chatlarga ham yozmang.

## 2-qadam. Render: bitta tugma

1. **render.com** ni oching va **Get Started → GitHub** bilan kiring.
2. GitHub ruxsat so'rasa, `Boshqaruv` repozitoriyasiga ruxsat bering.
3. **New + → Blueprint** ni tanlang.
4. Ro'yxatdan **Boshqaruv** ni tanlang va **Connect** ni bosing.
5. **Branch** maydonida `claude/ai-ustoz-tutor-platform-xsuzfk` ni tanlang.
6. **Blueprint Name:** `ai-ustoz`.
7. Render 3 ta narsani ko'rsatadi:
   - `ai-ustoz` (server va sayt);
   - `ai-ustoz-kv` (Redis);
   - `ai-ustoz-db` (baza).
8. Faqat **2 ta maydon** to'ldiriladi:

   | Maydon | Nima yoziladi |
   |---|---|
   | `OPENAI_API_KEY` | 1-qadamdagi `sk-...` kalit |
   | `ADMIN_PHONES` | Telefon raqamingiz, aynan shunday: `+998901234567` |

9. **Apply** ni bosing. Karta so'rasa, qo'shing.
10. **10–15 daqiqa** kuting. `ai-ustoz` xizmatining **Logs** bo'limida quyidagi qator chiqsa, tayyor:
    ```
    Uvicorn running on http://0.0.0.0:10000
    ```

## 3-qadam. Sayt va darsliklar

1. `ai-ustoz` xizmati sahifasining tepasidagi manzilni oching, masalan `https://ai-ustoz.onrender.com`.
2. Ro'yxatdan o'ting. Telefon raqam **`ADMIN_PHONES` dagi bilan bir xil** bo'lsin.
3. **"Darsliklar"** bo'limini oching (bo'limlar qatorini o'ngga suring).
4. **"Hammasini bilim bazasiga qo'shish"** ni bosing. Hammasi 1–2 soatda tayyor bo'ladi (skaner kitoblarni server bepul, lekin sekinroq o'qiydi); sahifani yopsangiz ham davom etadi.

Tamom! Sayt manzilini o'quvchilarga yuboring.

---

## Arzonroq AI: Google Gemini (ixtiyoriy, tavsiya etiladi)

Suhbat, testlar va vazifalar Gemini'da bir necha barobar arzon ishlaydi (ovozli suhbat OpenAI'da qoladi).

1. **aistudio.google.com** ni oching, Google akkaunt bilan kiring.
2. **Get API key → Create API key** ni bosing va kalitni nusxalang.
3. Render → `ai-ustoz` → **Environment** → **Add Environment Variable**:
   `GEMINI_API_KEY` = shu kalit. **Save** ni bosing (sayt o'zi yangilanadi).

Gemini ishlamay qolsa, o'sha savol avtomatik OpenAI'da bajariladi.

## Xarajat chegarasi

Har bir o'quvchiga **oyiga 4 $** AI byudjeti bor (server xarajati bunga kirmaydi). Tugasa, oy oxirigacha
suhbat, ovozli suhbat va rasm to'xtaydi; testlar va o'yinlar ishlayveradi. Administrator cheklanmaydi.
O'zgartirish: Environment'da `AI_BUDGET_PER_USER_PER_MONTH_USD` (masalan `3`). Kunlik chegaralar:
`CHAT_MESSAGES_PER_USER_PER_DAY` (50), `VOICE_SESSIONS_PER_USER_PER_DAY` (3).

## Yangilanishlar

GitHub'dagi shu tarmoqqa yangi o'zgarish kelsa, Render saytni **o'zi yangilaydi**.
Baza va yuklangan fayllar saqlanib qoladi.

## Muammo bo'lsa

| Belgi | Yechim |
|---|---|
| "Darsliklar" ko'rinmaydi | `ADMIN_PHONES` dagi raqam ro'yxatdan o'tgan raqam bilan bir xil emas (`+998` bilan, bo'shliqsiz). Render → `ai-ustoz` → **Environment** da tuzating, keyin ilovadan chiqib qayta kiring. |
| "OpenAI kaliti noto'g'ri" | Environment'da `OPENAI_API_KEY` ni tekshiring, keyin "Qayta urinish" ni bosing. |
| "OpenAI hisobida mablag' tugagan" | platform.openai.com → Billing'da hisobni to'ldiring, keyin "Qayta urinish" ni bosing. |
| "Server qayta ishga tushdi" | "Qayta urinish" ni bosing. |

Qotib qolsangiz, ekrandagi xabarning skrinshotini AI yordamchiga yuboring.
