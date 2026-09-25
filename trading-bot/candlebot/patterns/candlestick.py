"""2-modul: Yaponiya shamchalari patternlarini aniqlash.

TA-Lib o'rnatilgan bo'lsa uning CDL* funksiyalari ishlatiladi (60+ pattern).
O'rnatilmagan bo'lsa — asosiy patternlar uchun sof numpy implementatsiyasi (fallback).

TA-Lib chiqishi: +100 (bullish), -100 (bearish), 0 (pattern yo'q).
Biz uni [-1, 1] oralig'idagi yagona `pattern_score` ga aylantiramiz:
    score = Σ (ishonchlilik_vazni × yo'nalish × trend_konteksti) / normalizator
Trend konteksti: reversal pattern faqat to'g'ri trendda kuchli (Hammer — pastki trendda,
Shooting Star — yuqori trendda). Aks holda uning vazni ikki baravar kamaytiriladi.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

try:
    import talib
    HAS_TALIB = True
except ImportError:  # pragma: no cover - muhitga bog'liq
    talib = None
    HAS_TALIB = False


@dataclass(frozen=True)
class PatternSpec:
    talib_fn: str
    weight: float     # tarixiy ishonchlilik (0..1). Doji = 0: noaniqlik belgisi, yo'nalish emas
    reversal: bool    # reversal pattern -> trend konteksti tekshiriladi


PATTERNS: dict[str, PatternSpec] = {
    "doji":               PatternSpec("CDLDOJI", 0.0, False),
    "dragonfly_doji":     PatternSpec("CDLDRAGONFLYDOJI", 0.4, True),
    "gravestone_doji":    PatternSpec("CDLGRAVESTONEDOJI", 0.4, True),
    "hammer":             PatternSpec("CDLHAMMER", 0.6, True),
    "inverted_hammer":    PatternSpec("CDLINVERTEDHAMMER", 0.4, True),
    "hanging_man":        PatternSpec("CDLHANGINGMAN", 0.5, True),
    "shooting_star":      PatternSpec("CDLSHOOTINGSTAR", 0.6, True),
    "engulfing":          PatternSpec("CDLENGULFING", 0.8, True),
    "harami":             PatternSpec("CDLHARAMI", 0.4, True),
    "piercing":           PatternSpec("CDLPIERCING", 0.7, True),
    "dark_cloud_cover":   PatternSpec("CDLDARKCLOUDCOVER", 0.7, True),
    "morning_star":       PatternSpec("CDLMORNINGSTAR", 1.0, True),
    "evening_star":       PatternSpec("CDLEVENINGSTAR", 1.0, True),
    "three_white_soldiers": PatternSpec("CDL3WHITESOLDIERS", 0.9, False),
    "three_black_crows":  PatternSpec("CDL3BLACKCROWS", 0.9, False),
}


class PatternRecognizer:
    def __init__(self, trend_period: int = 20, use_talib: bool | None = None):
        self.trend_period = trend_period
        self.use_talib = HAS_TALIB if use_talib is None else (use_talib and HAS_TALIB)
        if not self.use_talib:
            log.info("TA-Lib topilmadi — fallback pattern detektori ishlatiladi")

    # ------------------------------------------------------------------ public
    def detect(self, df: pd.DataFrame) -> pd.DataFrame:
        """Har bir pattern uchun `cdl_<nom>` ustuni (+100/-100/0) va `pattern_score` qo'shadi."""
        out = df.copy()
        o, h, l, c = (df[k].to_numpy(dtype=float) for k in ("open", "high", "low", "close"))
        raw = self._talib(o, h, l, c) if self.use_talib else self._fallback(o, h, l, c)
        for name, values in raw.items():
            out[f"cdl_{name}"] = values.astype(int)
        out["pattern_score"] = self._score(out)
        return out

    @staticmethod
    def active_patterns(row: pd.Series) -> list[str]:
        """Oxirgi shamchada topilgan patternlar ro'yxati (log va tushuntirish uchun)."""
        found = []
        for name in PATTERNS:
            v = row.get(f"cdl_{name}", 0)
            if v:
                found.append(f"{name}({'+' if v > 0 else '-'})")
        return found

    # ---------------------------------------------------------------- internals
    def _talib(self, o, h, l, c) -> dict[str, np.ndarray]:
        return {name: getattr(talib, spec.talib_fn)(o, h, l, c) for name, spec in PATTERNS.items()}

    def _score(self, df: pd.DataFrame) -> pd.Series:
        sma = df["close"].rolling(self.trend_period, min_periods=1).mean()
        downtrend = (df["close"] < sma).to_numpy()
        score = np.zeros(len(df))
        for name, spec in PATTERNS.items():
            if spec.weight == 0:
                continue
            direction = np.sign(df[f"cdl_{name}"].to_numpy())
            if spec.reversal:
                # bullish reversal pastki trendda, bearish reversal yuqori trendda kuchli
                in_context = np.where(direction > 0, downtrend, ~downtrend)
                ctx = np.where(in_context, 1.0, 0.5)
            else:
                ctx = 1.0
            score += spec.weight * direction * ctx
        return pd.Series(np.clip(score / 1.5, -1.0, 1.0), index=df.index)

    def _fallback(self, o, h, l, c) -> dict[str, np.ndarray]:
        """Sof numpy: TA-Lib ta'riflariga yaqin soddalashtirilgan qoidalar."""
        n = len(c)
        body = np.abs(c - o)
        rng = np.maximum(h - l, 1e-12)
        upper = h - np.maximum(o, c)
        lower = np.minimum(o, c) - l
        avg_body = pd.Series(body).rolling(10, min_periods=1).mean().to_numpy()
        bull, bear = c > o, c < o
        prev = lambda a, k=1: np.concatenate([np.full(k, np.nan), a[:-k]]) if n > k else np.full(n, np.nan)  # noqa: E731

        res = {name: np.zeros(n) for name in PATTERNS}
        small = body <= 0.1 * rng
        res["doji"] = np.where(small, 100, 0)
        res["dragonfly_doji"] = np.where(small & (upper <= 0.1 * rng) & (lower >= 0.6 * rng), 100, 0)
        res["gravestone_doji"] = np.where(small & (lower <= 0.1 * rng) & (upper >= 0.6 * rng), -100, 0)

        hammer_shape = (lower >= 2 * body) & (upper <= 0.3 * body + 0.05 * rng) & (body > 0.1 * rng)
        star_shape = (upper >= 2 * body) & (lower <= 0.3 * body + 0.05 * rng) & (body > 0.1 * rng)
        sma = pd.Series(c).rolling(self.trend_period, min_periods=1).mean().to_numpy()
        down, up = c < sma, c > sma
        res["hammer"] = np.where(hammer_shape & down, 100, 0)
        res["hanging_man"] = np.where(hammer_shape & up, -100, 0)
        res["inverted_hammer"] = np.where(star_shape & down, 100, 0)
        res["shooting_star"] = np.where(star_shape & up, -100, 0)

        po, pc, pbody = prev(o), prev(c), prev(body)
        pbull, pbear = pc > po, pc < po
        with np.errstate(invalid="ignore"):
            res["engulfing"] = np.select(
                [pbear & bull & (o <= pc) & (c >= po) & (body > pbody),
                 pbull & bear & (o >= pc) & (c <= po) & (body > pbody)], [100, -100], 0)
            res["harami"] = np.select(
                [pbear & bull & (pbody > avg_body) & (np.maximum(o, c) < po) & (np.minimum(o, c) > pc),
                 pbull & bear & (pbody > avg_body) & (np.maximum(o, c) < pc) & (np.minimum(o, c) > po)],
                [100, -100], 0)
            mid_prev = (po + pc) / 2
            res["piercing"] = np.where(pbear & bull & (o < pc) & (c > mid_prev) & (c < po), 100, 0)
            res["dark_cloud_cover"] = np.where(pbull & bear & (o > pc) & (c < mid_prev) & (c > po), -100, 0)

            o2, c2, b2 = prev(o, 2), prev(c, 2), prev(body, 2)
            long2 = b2 > avg_body
            small1 = pbody < 0.5 * avg_body
            res["morning_star"] = np.where(
                (c2 < o2) & long2 & small1 & bull & (c > (o2 + c2) / 2), 100, 0)
            res["evening_star"] = np.where(
                (c2 > o2) & long2 & small1 & bear & (c < (o2 + c2) / 2), -100, 0)

            c1 = pc
            res["three_white_soldiers"] = np.where(
                (c2 > o2) & pbull & bull & (c > c1) & (c1 > c2) & (body > 0.6 * rng), 100, 0)
            res["three_black_crows"] = np.where(
                (c2 < o2) & pbear & bear & (c < c1) & (c1 < c2) & (body > 0.6 * rng), -100, 0)
        return {k: np.nan_to_num(v) for k, v in res.items()}
