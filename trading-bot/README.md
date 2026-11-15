# Trading bot (o'zi o'rganadigan, to'liq avtomatik)

Kripto birjalarda (Binance, Bybit, OKX, KuCoin va ccxt qo'llaydigan boshqa
100+ birja) avtomatik savdo qiladigan bot. Har bir juftlik uchun bozorni o'zi
o'rganadi va hozirgi holatga mos strategiyani tanlaydi.

## Qanday ishlaydi

1. **O'rganish.** Har bir juftlik uchun oxirgi ~1500 ta shamni oladi va 3 ta
   strategiyaning ~150 xil sozlamasini tarixda sinaydi:
   - **EMA + RSI** — trend (o'sish) bozori uchun;
   - **Grid / oraliq** — yon (flet) bozor uchun;
   - **DCA / tushishda sotib olish** — keskin tushishlardan keyingi qaytish uchun.
2. **Tekshirish (walk-forward).** Ma'lumotning 70% ida o'rganadi, qolgan 30%
   da — bot ko'rmagan davrda — tekshiradi. Faqat ikkalasida ham foyda bergan
   strategiya tanlanadi. **Hech biri ishonchli bo'lmasa, bot savdo qilmaydi
   va kutadi** (masalan, bozor qulayotganda).
3. **Savdo.** Har yangi sham yopilganda signalni tekshiradi, sotib oladi /
   sotadi. Bozor o'zgargani uchun har 24 soatda qayta o'rganadi.
4. **Xavfni boshqarish.** Har savdoda ATR asosida stop-loss; bir savdoda
   balansning ko'pi bilan 1% i xavf ostida; bir juftlikka ko'pi bilan 30%;
   kunlik 5% zarardan keyin o'sha kun savdo to'xtaydi.

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
| `/toxtat` / `/davom` | yangi savdolarni to'xtatish / davom ettirish |
| `/orgat` | bozorni hozir qayta o'rganish |
| `/hammasini_sot` | barcha pozitsiyalarni yopish |

## Muhim ogohlantirish

Hech bir bot foydani kafolatlamaydi. Tarixda yaxshi ishlagan strategiya
kelajakda zarar keltirishi mumkin. Bot faqat spot (long) savdo qiladi —
leverage/futures yo'q. Forex (MT4/MT5) qo'llab-quvvatlanmaydi.
