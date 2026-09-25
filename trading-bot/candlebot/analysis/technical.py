"""3-modul: Texnik indikatorlar va Support/Resistance.

Barcha indikatorlar KAUZAL (faqat o'tgan ma'lumotdan foydalanadi) — backtestda
kelajakka qarash (look-ahead bias) bo'lmasligi uchun.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from candlebot.config import TechnicalConfig

try:
    import talib
except ImportError:  # pragma: no cover
    talib = None


@dataclass
class SRLevels:
    supports: list[float] = field(default_factory=list)     # narxdan pastdagi, yaqinidan boshlab
    resistances: list[float] = field(default_factory=list)  # narxdan yuqoridagi, yaqinidan boshlab

    @property
    def nearest_support(self) -> float | None:
        return self.supports[0] if self.supports else None

    @property
    def nearest_resistance(self) -> float | None:
        return self.resistances[0] if self.resistances else None


class TechnicalAnalyzer:
    def __init__(self, cfg: TechnicalConfig | None = None, atr_period: int = 14):
        self.cfg = cfg or TechnicalConfig()
        self.atr_period = atr_period

    # ------------------------------------------------------------ indicators
    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        c = self.cfg
        out = df.copy()
        close, high, low = out["close"], out["high"], out["low"]

        if talib is not None:
            cl, hi, lo = (x.to_numpy(dtype=float) for x in (close, high, low))
            out["rsi"] = talib.RSI(cl, timeperiod=c.rsi_period)
            macd, sig, hist = talib.MACD(cl, c.macd_fast, c.macd_slow, c.macd_signal)
            out["macd"], out["macd_signal"], out["macd_hist"] = macd, sig, hist
            out["atr"] = talib.ATR(hi, lo, cl, timeperiod=self.atr_period)
        else:
            out["rsi"] = self._rsi(close, c.rsi_period)
            ema_f = close.ewm(span=c.macd_fast, adjust=False).mean()
            ema_s = close.ewm(span=c.macd_slow, adjust=False).mean()
            out["macd"] = ema_f - ema_s
            out["macd_signal"] = out["macd"].ewm(span=c.macd_signal, adjust=False).mean()
            out["macd_hist"] = out["macd"] - out["macd_signal"]
            out["atr"] = self._atr(high, low, close, self.atr_period)

        out["sma_fast"] = close.rolling(c.sma_fast).mean()
        out["sma_slow"] = close.rolling(c.sma_slow).mean()
        out["ema_200"] = close.ewm(span=200, adjust=False).mean()
        mid = close.rolling(20).mean()
        std = close.rolling(20).std()
        out["bb_upper"], out["bb_lower"] = mid + 2 * std, mid - 2 * std
        out["volume_ratio"] = out["volume"] / out["volume"].rolling(20).mean()
        return out

    @staticmethod
    def _rsi(close: pd.Series, period: int) -> pd.Series:
        delta = close.diff()
        gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
        loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
        rs = gain / loss.replace(0, np.nan)
        return (100 - 100 / (1 + rs)).fillna(100.0).where(loss.notna())

    @staticmethod
    def _atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int) -> pd.Series:
        prev_close = close.shift()
        tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
        return tr.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()

    # ----------------------------------------------------- support/resistance
    def support_resistance(self, df: pd.DataFrame, max_levels: int = 4) -> SRLevels:
        """Fraktal pivotlar (lokal max/min) ni topib, yaqin darajalarni klasterlash.

        Pivot j-shamchada faqat j+window shamcha yopilgandan keyin tasdiqlanadi, shuning
        uchun oxirgi `window` ta shamcha pivot sifatida ko'rilmaydi (kauzallik).
        """
        w, tol = self.cfg.sr_pivot_window, self.cfg.sr_tolerance
        data = df.tail(self.cfg.sr_lookback)
        if len(data) < 2 * w + 1:
            return SRLevels()
        highs, lows = data["high"].to_numpy(), data["low"].to_numpy()
        price = float(data["close"].iloc[-1])

        pivots: list[float] = []
        for j in range(w, len(data) - w):
            window_h = highs[j - w:j + w + 1]
            window_l = lows[j - w:j + w + 1]
            if highs[j] == window_h.max():
                pivots.append(highs[j])
            if lows[j] == window_l.min():
                pivots.append(lows[j])

        # Klasterlash: bir-biridan tol% dan yaqin darajalar birlashtiriladi, kuchi = teginishlar soni.
        clusters: list[list[float]] = []
        for p in sorted(pivots):
            if clusters and abs(p - np.mean(clusters[-1])) / p <= tol:
                clusters[-1].append(p)
            else:
                clusters.append([p])
        levels = [(float(np.mean(cl)), len(cl)) for cl in clusters]
        strong = [lvl for lvl, touches in levels if touches >= 2] or [lvl for lvl, _ in levels]

        supports = sorted((lv for lv in strong if lv < price), reverse=True)[:max_levels]
        resistances = sorted(lv for lv in strong if lv > price)[:max_levels]
        return SRLevels(supports, resistances)

    # ------------------------------------------------------------------ score
    def score(self, df: pd.DataFrame, levels: SRLevels | None = None) -> tuple[float, list[str]]:
        """Oxirgi shamcha uchun texnik ball [-1, 1] va sabablar ro'yxati."""
        row, prev = df.iloc[-1], df.iloc[-2]
        reasons: list[str] = []
        parts: list[float] = []

        # RSI: oversold -> bullish, overbought -> bearish
        rsi = row["rsi"]
        if not np.isnan(rsi):
            if rsi < 30:
                parts.append(1.0); reasons.append(f"RSI oversold ({rsi:.1f})")
            elif rsi > 70:
                parts.append(-1.0); reasons.append(f"RSI overbought ({rsi:.1f})")
            else:
                parts.append((50 - rsi) / 50 * 0.5)

        # MACD: histogram kesishishi kuchli, aks holda yo'nalishi
        if not np.isnan(row["macd_hist"]) and not np.isnan(prev["macd_hist"]):
            if prev["macd_hist"] <= 0 < row["macd_hist"]:
                parts.append(1.0); reasons.append("MACD bullish crossover")
            elif prev["macd_hist"] >= 0 > row["macd_hist"]:
                parts.append(-1.0); reasons.append("MACD bearish crossover")
            else:
                parts.append(0.4 * np.sign(row["macd_hist"]))

        # Trend: SMA fast/slow va narxning EMA200 ga nisbatan joyi
        if not np.isnan(row["sma_slow"]):
            trend = 0.5 * np.sign(row["sma_fast"] - row["sma_slow"]) + 0.5 * np.sign(row["close"] - row["ema_200"])
            parts.append(trend)
            if trend >= 1:
                reasons.append("Kuchli yuqori trend (SMA20>SMA50, narx>EMA200)")
            elif trend <= -1:
                reasons.append("Kuchli pastki trend")

        # Support/Resistance yaqinligi (ATR birligida)
        if levels is not None and not np.isnan(row["atr"]) and row["atr"] > 0:
            price, atr = row["close"], row["atr"]
            if levels.nearest_support and (price - levels.nearest_support) / atr < 1.0:
                parts.append(0.8); reasons.append(f"Support yaqinida ({levels.nearest_support:.2f})")
            if levels.nearest_resistance and (levels.nearest_resistance - price) / atr < 1.0:
                parts.append(-0.8); reasons.append(f"Resistance yaqinida ({levels.nearest_resistance:.2f})")

        if not parts:
            return 0.0, reasons
        return float(np.clip(np.mean(parts), -1, 1)), reasons
