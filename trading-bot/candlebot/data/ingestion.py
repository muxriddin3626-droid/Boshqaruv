"""1-modul: Data Ingestion — ccxt orqali OHLCV shamchalarini olish.

Muhim qoidalar:
* Faqat YOPILGAN shamchalar bilan ishlaymiz (oxirgi, hali shakllanayotgan shamcha tashlanadi),
  aks holda pattern "qayta chizilib" (repaint) yolg'on signal beradi.
* Tarmoq xatolarida exponential backoff bilan qayta urinish.
* enableRateLimit=True — birja limitlarini buzmaslik uchun.
"""
from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

OHLCV_COLUMNS = ["timestamp", "open", "high", "low", "close", "volume"]


def build_exchange(name: str, testnet: bool, api_key: str = "", api_secret: str = "",
                   api_password: str = ""):
    """ccxt birja obyektini yaratish. testnet=True bo'lsa sandbox (demo) URL'lar ishlatiladi."""
    import ccxt

    klass = getattr(ccxt, name)
    params = {"enableRateLimit": True, "options": {"defaultType": "spot"}}
    if api_key:
        params.update({"apiKey": api_key, "secret": api_secret})
    if api_password:
        params["password"] = api_password
    exchange = klass(params)
    if testnet:
        exchange.set_sandbox_mode(True)  # Binance -> testnet.binance.vision, Bybit -> testnet.bybit.com
    return exchange


def ohlcv_to_frame(rows: list[list]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=OHLCV_COLUMNS)
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.drop_duplicates("timestamp").set_index("timestamp").sort_index()
    return df.astype(float)


class DataFeed(ABC):
    symbol: str
    timeframe: str

    @abstractmethod
    def fetch_ohlcv(self, limit: int = 500) -> pd.DataFrame:
        """Yopilgan shamchalar: index=UTC vaqt, ustunlar open/high/low/close/volume."""

    @abstractmethod
    def last_price(self) -> float:
        ...


class MarketDataFeed(DataFeed):
    """Birjadan real-vaqt OHLCV (REST polling)."""

    def __init__(self, exchange, symbol: str, timeframe: str, max_retries: int = 5):
        self.exchange = exchange
        self.symbol = symbol
        self.timeframe = timeframe
        self.max_retries = max_retries
        self.tf_ms = exchange.parse_timeframe(timeframe) * 1000

    def _call(self, fn, *args, **kwargs):
        import ccxt

        delay = 1.0
        for attempt in range(1, self.max_retries + 1):
            try:
                return fn(*args, **kwargs)
            except (ccxt.NetworkError, ccxt.RequestTimeout, ccxt.DDoSProtection) as exc:
                if attempt == self.max_retries:
                    raise
                log.warning("Tarmoq xatosi (%s), %d-urinish, %.0fs kutamiz", exc, attempt, delay)
                time.sleep(delay)
                delay = min(delay * 2, 30)

    def fetch_ohlcv(self, limit: int = 500) -> pd.DataFrame:
        rows = self._call(self.exchange.fetch_ohlcv, self.symbol, self.timeframe, limit=limit + 1)
        df = ohlcv_to_frame(rows)
        now_ms = self.exchange.milliseconds()
        # Oxirgi shamcha hali yopilmagan bo'lsa — tashlaymiz.
        if len(df) and (df.index[-1].value // 1_000_000) + self.tf_ms > now_ms:
            df = df.iloc[:-1]
        return df.tail(limit)

    def fetch_history(self, days: int) -> pd.DataFrame:
        """ML o'qitish / backtest uchun uzoq tarixni sahifalab yuklash."""
        since = self.exchange.milliseconds() - days * 86_400_000
        rows: list[list] = []
        while True:
            batch = self._call(self.exchange.fetch_ohlcv, self.symbol, self.timeframe,
                               since=since, limit=1000)
            if not batch:
                break
            rows.extend(batch)
            since = batch[-1][0] + self.tf_ms
            if len(batch) < 2 or since >= self.exchange.milliseconds():
                break
        df = ohlcv_to_frame(rows)
        return df.iloc[:-1] if len(df) else df

    def last_price(self) -> float:
        ticker = self._call(self.exchange.fetch_ticker, self.symbol)
        return float(ticker["last"])


class CSVDataFeed(DataFeed):
    """Oldindan yuklangan CSV (timestamp,open,high,low,close,volume)."""

    def __init__(self, path: str | Path, symbol: str = "BTC/USDT", timeframe: str = "15m"):
        self.symbol, self.timeframe = symbol, timeframe
        df = pd.read_csv(path)
        ts = df["timestamp"]
        df["timestamp"] = pd.to_datetime(ts, unit="ms", utc=True) if np.issubdtype(ts.dtype, np.number) \
            else pd.to_datetime(ts, utc=True)
        self.df = df.set_index("timestamp").sort_index()[OHLCV_COLUMNS[1:]].astype(float)

    def fetch_ohlcv(self, limit: int = 500) -> pd.DataFrame:
        return self.df.tail(limit)

    def last_price(self) -> float:
        return float(self.df["close"].iloc[-1])


class SyntheticDataFeed(DataFeed):
    """Oflayn test/backtest uchun: rejimlar almashadigan geometrik Broun harakati."""

    def __init__(self, n_bars: int = 2000, start_price: float = 30_000.0, seed: int = 42,
                 timeframe: str = "15m", symbol: str = "BTC/USDT"):
        self.symbol, self.timeframe = symbol, timeframe
        rng = np.random.default_rng(seed)
        drift = np.repeat(rng.choice([-0.0006, 0.0, 0.0006], size=n_bars // 100 + 1), 100)[:n_bars]
        rets = drift + rng.normal(0, 0.004, n_bars)
        close = start_price * np.exp(np.cumsum(rets))
        open_ = np.concatenate([[start_price], close[:-1]]) * (1 + rng.normal(0, 0.0005, n_bars))
        spread = np.abs(rng.normal(0, 0.003, n_bars)) * close
        high = np.maximum(open_, close) + spread * rng.random(n_bars)
        low = np.minimum(open_, close) - spread * rng.random(n_bars)
        volume = rng.lognormal(3, 0.5, n_bars) * (1 + 20 * np.abs(rets))
        idx = pd.date_range(end=pd.Timestamp.now(tz="UTC").floor("15min"), periods=n_bars,
                            freq=pd.Timedelta(timeframe.replace("m", "min")))
        self.df = pd.DataFrame({"open": open_, "high": high, "low": low, "close": close,
                                "volume": volume}, index=idx)

    def fetch_ohlcv(self, limit: int = 500) -> pd.DataFrame:
        return self.df.tail(limit)

    def last_price(self) -> float:
        return float(self.df["close"].iloc[-1])
