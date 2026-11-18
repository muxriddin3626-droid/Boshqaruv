# Trading bot (o'zi o'rganadigan, to'liq avtomatik)

Kripto birjalarda (Binance, Bybit, OKX, KuCoin va ccxt qo'llaydigan boshqa
100+ birja) avtomatik savdo qiladigan bot. Har bir juftlik uchun bozorni o'zi
o'rganadi va hozirgi holatga mos strategiyani tanlaydi.

## Qanday ishlaydi

1. **O'rganish.** Har bir juftlik uchun oxirgi ~1500 ta shamni oladi va 4 ta
   strategiyaning ~170 xil sozlamasini tarixda sinaydi:
   - **EMA + RSI** — trend (o'sish) bozori uchun;
   - **Grid / oraliq** — yon (flet) bozor uchun;
   - **DCA / tushishda sotib olish** — keskin tushishlardan keyingi qaytish uchun;
   - **Likvidlik ovi** — yirik o'yinchilar stop-losslarni "yig'ib" olgandan keyingi qaytish.
2. **Tekshirish (walk-forward).** Ma'lumotning 60% ida o'rganadi, keyin bot
   ko'rmagan **ikki alohida davrda** tekshiradi. Faqat ikkala davrda ham foyda
   bergan strategiya tanlanadi (tasodifiy omad emas, barqarorlik). **Hech biri ishonchli bo'lmasa, bot savdo qilmaydi
   va kutadi** (masalan, bozor qulayotganda).
3. **Savdo.** Har yangi sham yopilganda signalni tekshiradi, sotib oladi /
   sotadi. Bozor o'zgargani uchun har 24 soatda qayta o'rganadi.
4. **Xavfni boshqarish.** Har savdoda ATR asosida stop-loss; bir savdoda
   balansning ko'pi bilan 1% i xavf ostida; bir juftlikka ko'pi bilan 30%;
   kunlik 5% zarardan keyin o'sha kun savdo to'xtaydi.

5. **Katta trend filtri (multi-timeframe).** 1 soatlik shamlardan 4 soatlik
   va kunlik shamlar yasaladi. Har bir strategiya filtrsiz, "4 soatlik trend
   o'sishda bo'lsin" va "4 soatlik + kunlik ikkalasi o'sishda bo'lsin"
   variantlarida sinaladi — filtr faqat tarixda yordam bergan joyda yoqiladi.
6. **O'z xatolaridan o'rganish.** Bir sozlama ketma-ket 3 marta zarar qilsa,
   u 3 kunga chetlatiladi va bozor darhol qayta o'rganiladi.

## Sun'iy intellekt va yangiliklar

- Har soatda kripto yangiliklar (CoinTelegraph, CoinDesk, Decrypt) va
  "Qo'rquv va ochko'zlik" indeksi yig'iladi.
- `OPENAI_API_KEY` (OpenAI) yoki `ANTHROPIC_API_KEY` (Claude) bo'lsa, AI ularni, bozor holatini va
  manipulyatsiya belgilarini birga tahlil qiladi, kerak bo'lsa internetdan
  o'zi qo'shimcha yangilik qidiradi va har tanga uchun qaror beradi:
  ruxsat / summani kamaytirish / xaridni bloklash / pozitsiyadan chiqish.
- **AI faqat xavfni kamaytira oladi** — u o'zi xarid ochmaydi va summani
  oshirmaydi. Bu ataylab shunday: AI yangilikni yaxshi tushunadi, lekin narxni
  bashorat qila olmaydi.
- Kalit bo'lmasa, oddiy kalit so'z tahlili ishlaydi (hack, lawsuit, delist...).
- AI xarajati: har soatda bitta so'rov. OpenAI `gpt-5.4-mini` bilan arzon,
  Claude Opus 5.5 bilan taxminan kuniga $1–3. Model `AI_MODEL` bilan
  o'zgartiriladi, chastota — `AI_EVERY_MINUTES` bilan.

## Kichik hisob (masalan 20 USDT)

Birjada eng kichik buyurtma ~5 USDT. Kichik hisobda xavf bo'yicha hisoblangan
summa bundan kam chiqadi, shuning uchun bot uni `MIN_ORDER_USDT` (6) ga
ko'taradi — lekin faqat stop urilganda yo'qotish balansning 3% idan
oshmasa. 20 USDT bilan bir vaqtda ko'pi bilan 3 ta pozitsiya ochiladi.

## Manipulyatsiyani aniqlash ("bank/kit" o'yinlari)

Har yangi shamda tekshiriladi va Telegramga 🐋 belgisi bilan yuboriladi:

| Belgi | Ma'nosi | Bot nima qiladi |
|---|---|---|
| Pastga stop-ov | Narx stop-losslarni yig'ish uchun pastga sanchilib qaytgan | Likvidlik ovi strategiyasi uchun signal |
| Yuqoriga stop-ov | Soxta o'sish (bull trap) | Ogohlantiradi, pozitsiyadan chiqish signali |
| Pamp / damp | Qisqa vaqtda keskin harakat + g'ayritabiiy hajm | Xaridni bloklaydi |
| Soxta hajm | Ulkan hajm, narx qimirlamaydi (wash trading) | Ogohlantiradi |
| Spoofing devor | Kitobda bitta shubhali katta buyurtma | Ogohlantiradi, AI'ga uzatadi |
| Kitob nomutanosibligi | Bir tomon kuchli ustun | Ogohlantiradi, AI'ga uzatadi |

Bular ehtimoliy belgilar, 100% isbot emas.

## O'rnatish

```bash
cd trading-bot
npm install
cp .env.example .env
npm test            # internetsiz sinov (sun'iy bozorda)
npm run backtest    # haqiqiy tarixiy ma'lumotda: bot nimani tanlaydi
npm start           # botni ishga tushirish (standart: SINOV rejimi)
```

## Ishga tushirish tartibi (tavsiya)

1. **`MODE=paper`** (standart) — API kalitsiz ham ishlaydi, xayoliy 1000 USDT
   bilan savdo qiladi. Kamida 2–4 hafta shunday kuzating.
2. **Testnet** — Binance testnet (https://testnet.binance.vision) kalitlari
   bilan `SANDBOX=true`, `MODE=live`.
3. **Haqiqiy pul** — faqat yo'qotishga tayyor kichik summa bilan,
   `MODE=live`, `SANDBOX=false`.

API kalit yaratganda **faqat "Spot trading" ruxsatini** bering,
**pul yechish (withdraw) ruxsatini hech qachon yoqmang** va IP cheklovini qo'ying.

## Telegram

`.env` ga `TELEGRAM_BOT_TOKEN` yozing, botga `/start` yuboring — u sizning
chat ID ni aytadi, uni `TELEGRAM_CHAT_ID` ga yozib qayta ishga tushiring.

| Buyruq | Vazifasi |
|---|---|
| `/holat` | balans, pozitsiyalar, tanlangan strategiyalar |
| `/yangiliklar` | oxirgi AI/yangiliklar tahlili |
| `/bugun` | bugungi savdolar, yutuq va zarar |
| `/hisobot` | shu haftaning hisobotini hozir ko'rish |
| `/toxtat` / `/davom` | yangi savdolarni to'xtatish / davom ettirish |
| `/orgat` | bozorni hozir qayta o'rganish |
| `/hammasini_sot` | barcha pozitsiyalarni yopish |

## Haftalik hisobot

Har yakshanba 20:00 da (Toshkent vaqti) Telegramga keladi:

- balans hafta boshida va oxirida;
- **"sotib olib kutish" bilan solishtirish** — bot haqiqatan foydalimi;
- savdolar soni, yutuq foizi, o'rtacha yutuq va zarar, eng yaxshi va eng yomon savdo;
- himoya (yangilik, manipulyatsiya, katta trend) tufayli o'tkazib yuborilgan xaridlar;
- boshidan beri natija;
- bot 4 hafta ketma-ket kutishdan yomon bo'lsa — ogohlantirish.

## Serverga joylashtirish (7/24)

### 1-variant: VPS + Docker (tavsiya etiladi)

Eng ishonchli yo'l. Arzon VPS (Hetzner, Contabo, DigitalOcean — oyiga ~$4–6)
yoki bepul Oracle Cloud "Always Free". **Server AQShda bo'lmasin** — Binance
AQSh IP manzillarini bloklaydi (Yevropa yoki Osiyo tanlang).

```bash
# serverda (Ubuntu)
curl -fsSL https://get.docker.com | sh
git clone https://github.com/muxriddin3626-droid/Boshqaruv.git
cd Boshqaruv/trading-bot
cp .env.example .env && nano .env       # kalitlarni yozing
docker compose up -d --build            # ishga tushirish
docker compose logs -f                  # loglarni ko'rish
```

Yangilash: `git pull && docker compose up -d --build`. Holat `data/`
papkasida saqlanadi va yangilashda yo'qolmaydi. Server qayta yoqilsa bot
o'zi ishga tushadi.

### 2-variant: Render (bepul)

1. Turso'da bepul baza yarating (hisob-bot README'sidagi kabi) — holat shu
   yerda saqlanadi, chunki Render'ning bepul diski har qayta ishga tushganda
   tozalanadi.
2. Render → New → Blueprint → shu repozitoriyni tanlang (`trading-bot/render.yaml`).
3. Kalitlarni kiriting (`API_KEY`, `TELEGRAM_BOT_TOKEN`, `TURSO_DATABASE_URL` ...).
4. Bepul xizmat 15 daqiqa so'rov bo'lmasa "uxlab qoladi". Uni uyg'oq ushlash
   uchun https://uptimerobot.com da bepul monitor qo'shing: har 5 daqiqada
   Render bergan manzilni tekshirsin.

Bepul variant sinov rejimi uchun yaxshi. Haqiqiy pul bilan VPS ishonchliroq.

## Muhim ogohlantirish

Hech bir bot foydani kafolatlamaydi. Tarixda yaxshi ishlagan strategiya
kelajakda zarar keltirishi mumkin. Bot faqat spot (long) savdo qiladi —
leverage/futures yo'q. Forex (MT4/MT5) qo'llab-quvvatlanmaydi.
