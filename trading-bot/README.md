# CandleBot — Yaponiya shamchalari asosidagi algoritmik savdo boti

Python'da yozilgan, modulli (OOP) savdo boti: **ccxt** orqali real-vaqt OHLCV → **TA-Lib** shamcha
patternlari → texnik indikatorlar → sentiment → ML ehtimollik → **qat'iy risk nazorati** → Testnet'da
avtomatik buyruqlar.

> ⚠️ **Ogohlantirish.** Bu loyiha ta'lim va tadqiqot uchun. Hech qanday strategiya foyda kafolatlamaydi.
> Avval backtest, keyin kamida 2–4 hafta **testnet**, shundan keyingina (ongli ravishda) kichik summa bilan live.

---

## 1. Papka/fayllar strukturasi

```
trading-bot/
├── main.py                        # CLI: backtest | train | check | run
├── config/config.yaml             # barcha sozlamalar (kalitlarsiz)
├── .env.example                   # API kalitlari shabloni
├── requirements.txt
├── candlebot/
│   ├── config.py                  # YAML + .env -> dataclass'lar, validatsiya
│   ├── data/ingestion.py          # 1. Data Ingestion (ccxt, CSV, sintetik)
│   ├── patterns/candlestick.py    # 2. Pattern Recognition (TA-Lib + fallback)
│   ├── analysis/technical.py      # 3. RSI, MACD, SMA/EMA, ATR, Bollinger, Support/Resistance
│   ├── sentiment/news.py          # 4. RSS yangiliklar + Keyword / FinBERT / ChatGPT sentiment
│   ├── ml/
│   │   ├── features.py            # 5. ML xususiyatlari va label'lar
│   │   ├── predictor.py           #    Scikit-Learn (HistGradientBoosting + TimeSeriesSplit)
│   │   ├── rl_env.py              #    Gymnasium RL muhiti (+ PPO o'qitish)
│   │   └── lstm_model.py          #    PyTorch LSTM (ixtiyoriy)
│   ├── strategy/signal_engine.py  # barcha ballarni yagona BUY/SELL/HOLD qaroriga birlashtirish
│   ├── risk/manager.py            # 6. Risk Management Engine
│   ├── execution/
│   │   ├── brokers.py             # 7. PaperBroker + CCXTBroker (testnet/live)
│   │   └── order_manager.py       #    pozitsiya, state tiklash, savdo jurnali
│   ├── core/trader.py             # real-vaqt orkestrator (asosiy sikl)
│   ├── backtest/backtester.py     # jonli bot bilan AYNAN bir xil mantiqda backtest
│   └── utils/logger.py
└── tests/test_core.py             # 18 ta unit test (pytest)
```

## 2. Arxitektura va ma'lumot oqimi

```
            ┌──────────────────┐
            │  Data Ingestion  │  ccxt.fetch_ohlcv (faqat YOPILGAN shamchalar)
            └────────┬─────────┘
                     ▼
   ┌─────────────────┴───────────────────┐
   ▼                                     ▼
┌──────────────────┐            ┌──────────────────┐        ┌──────────────────┐
│ Pattern Recogn.  │            │ Technical Anal.  │        │ Sentiment & News │
│ pattern_score    │            │ tech_score + S/R │        │ sentiment [-1,1] │
└────────┬─────────┘            └────────┬─────────┘        └────────┬─────────┘
         │           ┌──────────────────┐│                           │
         │           │  ML Predictor    ││ P(up) -> 2p-1             │
         │           └────────┬─────────┘│                           │
         ▼                    ▼          ▼                           ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │ Signal Engine:  score = Σ wᵢ·scoreᵢ / Σ wᵢ   + veto filtrlar       │
       └──────────────────────────────┬───────────────────────────────────┘
                                      ▼  BUY / SELL / HOLD
       ┌──────────────────────────────────────────────────────────────────┐
       │ Risk Engine: kill-switch, kunlik limit, cooldown, sizing, SL/TP,  │
       │              birja min amount / min notional / precision          │
       └──────────────────────────────┬───────────────────────────────────┘
                                      ▼  TradePlan (yoki rad etish sababi)
       ┌──────────────────────────────────────────────────────────────────┐
       │ Execution: OrderManager -> Broker (Paper | CCXT Testnet | Live)   │
       └──────────────────────────────────────────────────────────────────┘
```

**Asosiy tamoyil:** har bir modul o'z interfeysiga ega (`DataFeed`, `SentimentModel`, `Broker`),
shuning uchun paper → testnet → live o'tish faqat `config.yaml`dagi `mode` o'zgarishi bilan bo'ladi,
strategiya kodi o'zgarmaydi. Backtester ham xuddi shu `SignalEngine`, `RiskManager` va `OrderManager`ni
ishlatadi — "backtestda bir xil, jonli botda boshqa" xatosi bo'lmaydi.

---

## 3. Modullar bo'yicha tushuntirish

### 3.1 Data Ingestion — `candlebot/data/ingestion.py`

```python
ex = build_exchange("binance", testnet=True, api_key=..., api_secret=...)  # set_sandbox_mode(True)
feed = MarketDataFeed(ex, "BTC/USDT", "15m")
df = feed.fetch_ohlcv(500)       # index=UTC vaqt; open/high/low/close/volume
```

* `enableRateLimit=True` — birja so'rov limitlarini buzmaslik.
* Tarmoq xatolarida exponential backoff (1s, 2s, 4s … 30s).
* **Oxirgi, yopilmagan shamcha tashlanadi** — aks holda pattern shamcha yopilguncha paydo bo'lib-yo'qolib
  (repaint) yolg'on signal beradi.
* `fetch_history(days)` — ML/backtest uchun sahifalab yuklash. `CSVDataFeed`, `SyntheticDataFeed` — oflayn.

### 3.2 Pattern Recognition — `candlebot/patterns/candlestick.py`

15 ta pattern: Doji, Dragonfly/Gravestone Doji, Hammer, Inverted Hammer, Hanging Man, Shooting Star,
Engulfing, Harami, Piercing, Dark Cloud Cover, Morning/Evening Star, Three White Soldiers/Black Crows.

```python
out = PatternRecognizer().detect(df)          # cdl_* ustunlari (+100/-100/0) + pattern_score
PatternRecognizer.active_patterns(out.iloc[-1])  # ['engulfing(+)', 'hammer(+)']
```

Algoritm:
1. TA-Lib `CDL*` funksiyalari (yo'q bo'lsa — sof numpy fallback).
2. Har bir patternga **ishonchlilik vazni** (Morning Star 1.0, Engulfing 0.8, Hammer 0.6, Harami 0.4, Doji 0).
3. **Trend konteksti**: bullish reversal pastki trendda (narx < SMA20), bearish — yuqori trendda to'liq
   vaznga ega; noto'g'ri kontekstda vazn 0.5×.
4. `pattern_score = clip(Σ vazn × yo'nalish × kontekst / 1.5, -1, 1)`.

Doji vazni 0 — u yo'nalish emas, **noaniqlik** belgisi; ML modeli uni xususiyat sifatida baribir ko'radi.

### 3.3 Technical Analysis — `candlebot/analysis/technical.py`

RSI(14), MACD(12,26,9), SMA20/50, EMA200, ATR(14), Bollinger(20,2), hajm nisbati.
**Support/Resistance**: fraktal pivotlar (±5 shamcha lokal max/min) → 0.4% ichidagi darajalar klasterlanadi →
kamida 2 marta tegilgan darajalar "kuchli" hisoblanadi.

Ball qoidalari (o'rtachasi → `tech_score ∈ [-1,1]`):

| Holat | Ball |
|---|---|
| RSI < 30 / > 70 | +1 / −1 |
| MACD histogram 0 dan yuqoriga / pastga kesib o'tdi | +1 / −1 |
| SMA20 > SMA50 va narx > EMA200 | +1 (teskarisi −1) |
| Narx supportga 1 ATR dan yaqin / resistancega | +0.8 / −0.8 |

### 3.4 Sentiment & News — `candlebot/sentiment/news.py`

* `NewsFetcher` — RSS (CoinDesk, CoinTelegraph …), qo'shimcha kutubxonasiz.
* Modellar: `KeywordSentimentModel` (tez, default), `FinBERTSentimentModel` (`ProsusAI/finbert`,
  `P(pos) − P(neg)`), `OpenAISentimentModel` (ChatGPT, JSON javob, `temperature=0`).
* Faqat kalit so'zga mos yangiliklar (`bitcoin`, `btc` …), **time-decay** bilan (half-life 6 soat):
  `w = exp(−ln2 · yosh_soat / half_life)`.
* Natija keshlanadi (`refresh_minutes`), API xatosi botni to'xtatmaydi.

### 3.5 Machine Learning & RL — `candlebot/ml/`

* **Xususiyatlar** (16 ta, narxdan mustaqil): log-daromadlar, RSI, normallashgan MACD, SMA/EMA
  masofalari, ATR/narx, Bollinger pozitsiyasi, hajm nisbati, shamcha tanasi va soyalari, `pattern_score`.
* **Label**: `horizon` shamchadan keyin narx **komissiya + sirpanishdan ko'proq** o'sdimi (1/0).
* **Model**: `HistGradientBoostingClassifier`, **TimeSeriesSplit** CV (oddiy KFold kelajak ma'lumotini
  o'qitishga aralashtiradi — bu eng keng tarqalgan xato).
* **RL**: `CandleTradingEnv` (Gymnasium) — harakatlar {flat, long}, mukofot = log-daromad − komissiya.
  `train_ppo(env)` stable-baselines3 bilan.
* **LSTM** (PyTorch) — ixtiyoriy; GBM baseline'dan yaxshi bo'lmasa ishlatmang.

```bash
python main.py train --source exchange --days 180   # model -> models/candle_predictor.joblib
# config.yaml: ml.enabled: true
```

### 3.6 Signal Engine — `candlebot/strategy/signal_engine.py`

```
score = (0.30·pattern + 0.35·technical + 0.10·sentiment + 0.25·(2·P(up)−1)) / Σ(mavjud vaznlar)
score ≥ +0.30 → BUY   |   score ≤ −0.30 → SELL (pozitsiyadan chiqish)   |   aks holda HOLD
Veto: ML yoqilgan va P(up) < 0.55 → BUY yo'q;  sentiment < −0.5 → BUY yo'q
```

### 3.7 Risk Management Engine — `candlebot/risk/manager.py`

Hech qanday signal bu qoidalarni chetlab o'tolmaydi:

| Qoida | Formula / qiymat |
|---|---|
| Stop-Loss | `entry − 1.5 × ATR` |
| Take-Profit | `entry + 2.0 × (entry − SL)` (R:R = 1:2) |
| Position size | `(equity × 1%) / (SL masofasi + 2×fee + 2×slippage)` |
| Maks. pozitsiya | equity'ning 25% i va mavjud balans (komissiya bilan) |
| Birja limitlari | `amount_step` bo'yicha pastga yaxlitlash, `min_amount`, `min_cost` (min notional) |
| TP komissiyani qoplashi | aks holda savdo rad etiladi |
| Breakeven | 1R foydada SL → `entry × (1 + 2×fee)` |
| Max drawdown | cho'qqidan 15% → **kill-switch** (pozitsiya yopiladi, yangi savdo yo'q) |
| Kunlik limit | kun boshidan −5% → ertangi UTC kungacha savdo yo'q |
| Cooldown | chiqishdan keyin 2 shamcha kutish |

Misol: equity 10 000 USDT, BTC = 60 000, ATR = 400 →
SL masofasi = 1.5 × 400 = 600, komissiya+sirpanish = 60 000 × (2×0.001 + 2×0.0005) = 180 → birlik xavfi 780;
miqdor = 100 / 780 ≈ 0.12820 BTC ≈ 7 692 USDT → 25% chegarasi bilan 0.04166 BTC (2 500 USDT).
SL = 59 400, TP = 61 200. Haqiqiy xavf ≈ 0.04166 × 780 ≈ 32.5 USDT (0.33%) — hajm chegarasi xavfni yanada kamaytirdi.

### 3.8 Execution & Order Management — `candlebot/execution/`

* `PaperBroker` — komissiya va sirpanishli simulyatsiya.
* `CCXTBroker` — market buyruqlar, `amount_to_precision`, unikal `newClientOrderId` (idempotentlik),
  bajarilgan narx/komissiyani `fetch_order` orqali aniqlash. **Binance spot'da buy komissiyasi BTC'dan
  ushlanadi** — pozitsiya miqdori shunga moslashtiriladi, sotuvda balansdan ortiq sotilmaydi.
* `OrderManager` — SL/TP software tomonidan har siklda (30s) tekshiriladi; holat `state/bot_state.json`ga
  atomar yoziladi, qayta ishga tushganda tiklanadi; har bir savdo `state/trades.csv` jurnaliga yoziladi.

---

## 4. O'rnatish

```bash
cd trading-bot
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**TA-Lib** C kutubxonasini talab qiladi (o'rnatilmasa bot fallback bilan ishlayveradi):

* Linux/macOS: `pip install TA-Lib` (0.6+ versiyalar tayyor wheel bilan keladi). Muammo bo'lsa:
  macOS — `brew install ta-lib`; Ubuntu — ta-lib manbasidan `./configure && make && sudo make install`.
* Windows: `pip install TA-Lib` (yangi wheel'lar) yoki conda: `conda install -c conda-forge ta-lib`.

Testlar: `python -m pytest -q`

## 5. Testnet (Demo) muhitida ishga tushirish — bosqichma-bosqich

**1-qadam. Oflayn backtest** (internet shart emas):
```bash
python main.py backtest                         # sintetik ma'lumot
python main.py backtest --source exchange --days 90       # haqiqiy Binance tarixi
python main.py backtest --source exchange --days 180 --ml # ML: 60% o'qitish / 40% sinov
```
Profit factor > 1.2, max drawdown < 15% va savdolar soni ≥ 50 bo'lmasa — parametrlarni o'zgartiring.

**2-qadam. Paper rejim** (haqiqiy narxlar, virtual pul, API kalit shart emas):
```yaml
# config/config.yaml
mode: paper
```
```bash
python main.py run
```

**3-qadam. Binance Spot Testnet kalitlarini olish:**
1. https://testnet.binance.vision ga kiring → **"Log In with GitHub"**.
2. **"Generate HMAC_SHA256 Key"** → nom bering → API Key va Secret Key'ni saqlang (Secret faqat bir marta
   ko'rsatiladi). Testnet hisobiga avtomatik virtual BTC/USDT beriladi.
3. `.env` yarating:
   ```bash
   cp .env.example .env
   # EXCHANGE_API_KEY=...  EXCHANGE_API_SECRET=...  BOT_MODE=testnet
   ```

   Bybit testnet uchun: https://testnet.bybit.com → API kalit, `exchange.name: bybit`.

**4-qadam. Ulanishni tekshirish:**
```bash
python main.py check
# Ulanish OK ... Balans: 1.00000000 BTC, 10000.00 USDT
# Limitlar: MarketLimits(min_amount=1e-05, min_cost=5.0, amount_step=1e-05, ...)
```

**5-qadam. Botni ishga tushirish:**
```bash
python main.py run            # BOT_MODE=testnet .env dan olinadi
```
Log namunasi:
```
[2026-01-10 14:15] narx=60120.50 equity=10000.00 DD=0.0% | BUY (ball +0.412; pattern=+0.53, technical=+0.38, ml=+0.24) Patternlar: engulfing(+); RSI oversold (28.4); ML P(up)=0.62
Reja: 0.04150000 @ ~60120.50, SL 59520.50, TP 61320.50, xavf 32.37
Order 123456 BUY 0.04145850 @ 60124.10 (fee≈2.4945 USDT)
```
To'xtatish: `Ctrl+C` (ochiq pozitsiya state faylida saqlanadi, keyingi ishga tushishda tiklanadi).
Serverda uzluksiz ishlatish uchun `tmux`, `systemd` yoki `docker` dan foydalaning.

**6-qadam. Monitoring:** `logs/bot.log`, `state/trades.csv` (PnL, sabab: STOP_LOSS / TAKE_PROFIT /
SIGNAL_EXIT / KILL_SWITCH).

**Live rejim** faqat testnet'da barqaror natijadan keyin: `mode: live` **va** `.env`da
`ALLOW_LIVE_TRADING=yes`. API kalitida **withdraw ruxsatini o'chiring** va IP whitelist qo'ying.

## 6. Kengaytirish g'oyalari

* WebSocket (ccxt.pro `watch_ohlcv`) — polling o'rniga.
* Birja tomonida OCO / stop-loss order (bot o'chib qolsa ham himoya).
* Futures (short) — `defaultType: future`, leverage va likvidatsiya narxi nazorati bilan.
* Bir nechta simvol va portfel darajasidagi risk (korrelyatsiya).
* Telegram orqali bildirishnomalar.
