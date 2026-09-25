"""ML uchun xususiyatlar (features) va belgilar (labels).

Barcha xususiyatlar narxdan mustaqil (nisbiy) — model turli narx darajalarida ishlashi uchun.
Label: keyingi `horizon` shamchadan keyin narx komissiya+sirpanishdan KO'PROQ o'sadimi (1/0).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "ret_1", "ret_3", "ret_6", "ret_12",
    "rsi", "macd_hist_n", "dist_sma_fast", "dist_sma_slow", "dist_ema_200",
    "atr_n", "bb_pos", "volume_ratio",
    "body_n", "upper_wick_n", "lower_wick_n", "pattern_score",
]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """`df` TechnicalAnalyzer.compute va PatternRecognizer.detect dan o'tgan bo'lishi kerak."""
    c = df["close"]
    rng = (df["high"] - df["low"]).replace(0, np.nan)
    f = pd.DataFrame(index=df.index)
    for k in (1, 3, 6, 12):
        f[f"ret_{k}"] = np.log(c / c.shift(k))
    f["rsi"] = df["rsi"] / 100.0
    f["macd_hist_n"] = df["macd_hist"] / c
    f["dist_sma_fast"] = c / df["sma_fast"] - 1
    f["dist_sma_slow"] = c / df["sma_slow"] - 1
    f["dist_ema_200"] = c / df["ema_200"] - 1
    f["atr_n"] = df["atr"] / c
    f["bb_pos"] = (c - df["bb_lower"]) / (df["bb_upper"] - df["bb_lower"]).replace(0, np.nan)
    f["volume_ratio"] = df["volume_ratio"]
    f["body_n"] = (df["close"] - df["open"]) / rng
    f["upper_wick_n"] = (df["high"] - df[["open", "close"]].max(axis=1)) / rng
    f["lower_wick_n"] = (df[["open", "close"]].min(axis=1) - df["low"]) / rng
    f["pattern_score"] = df["pattern_score"]
    return f[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan)


def build_labels(df: pd.DataFrame, horizon: int, cost: float) -> pd.Series:
    """1 = `horizon` shamchadan keyin foyda (xarajatlardan keyin) > 0. Oxirgi `horizon` qator NaN."""
    fwd = df["close"].shift(-horizon) / df["close"] - 1
    labels = (fwd > cost).astype(float)
    labels[fwd.isna()] = np.nan
    return labels
