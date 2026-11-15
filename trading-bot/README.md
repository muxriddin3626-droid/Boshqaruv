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

5. **O'z xatolaridan o'rganish.** Bir sozlama ketma-ket 3 marta zarar qilsa,
   u 3 kunga chetlatiladi va bozor darhol qayta o'rganiladi.

## Sun'iy intellekt va yangiliklar

- Har soatda kripto yangiliklar (CoinTelegraph, CoinDesk, Decrypt) va
  "Qo'rquv va ochko'zlik" indeksi yig'iladi.
- `ANTHROPIC_API_KEY` bo'lsa, **Claude** ularni, bozor holatini va
  manipulyatsiya belgilarini birga tahlil qiladi, kerak bo'lsa internetdan
  o'zi qo'shimcha yangilik qidiradi va har tanga uchun qaror beradi:
  ruxsat / summani kamaytirish / xaridni bloklash / pozitsiyadan chiqish.
- **AI faqat xavfni kamaytira oladi** — u o'zi xarid ochmaydi va summani
  oshirmaydi. Bu ataylab shunday: AI yangilikni yaxshi tushunadi, lekin narxni
  bashorat qila olmaydi.
- Kalit bo'lmasa, oddiy kalit so'z tahlili ishlaydi (hack, lawsuit, delist...).
- AI xarajati: Opus 5.5 bilan har soatda bitta so'rov — taxminan kuniga
  $1–3. Arzonroq qilish uchun `AI_MODEL=claude-haiku-5-5` yoki
  `AI_EVERY_MINUTES=240`.

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
| `/toxtat` / `/davom` | yangi savdolarni to'xtatish / davom ettirish |
| `/orgat` | bozorni hozir qayta o'rganish |
| `/hammasini_sot` | barcha pozitsiyalarni yopish |

## Muhim ogohlantirish

Hech bir bot foydani kafolatlamaydi. Tarixda yaxshi ishlagan strategiya
kelajakda zarar keltirishi mumkin. Bot faqat spot (long) savdo qiladi —
leverage/futures yo'q. Forex (MT4/MT5) qo'llab-quvvatlanmaydi.
