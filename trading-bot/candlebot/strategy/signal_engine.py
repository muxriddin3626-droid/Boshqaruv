"""Signal Engine: pattern + texnik + sentiment + ML ballarini yagona qarorga birlashtirish.

    composite = Σ w_i × score_i / Σ w_i        (faqat mavjud komponentlar bo'yicha)
    ML komponenti: score_ml = 2 × P(up) − 1   → [-1, 1]

Filtrlar (veto):
* ML yoqilgan bo'lsa BUY uchun P(up) >= min_ml_probability
* Sentiment juda salbiy bo'lsa BUY bloklanadi
* Bearish pattern + overbought -> BUY yo'q (kompozit ball orqali tabiiy ravishda)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from candlebot.analysis.technical import SRLevels, TechnicalAnalyzer
from candlebot.config import StrategyConfig
from candlebot.ml.features import build_features
from candlebot.ml.predictor import CandlePredictor
from candlebot.patterns.candlestick import PatternRecognizer

log = logging.getLogger(__name__)


@dataclass
class Signal:
    action: str                       # BUY | SELL | HOLD
    score: float
    components: dict = field(default_factory=dict)
    reasons: list = field(default_factory=list)
    levels: SRLevels | None = None

    def __str__(self) -> str:
        comps = ", ".join(f"{k}={v:+.2f}" for k, v in self.components.items())
        return f"{self.action} (ball {self.score:+.3f}; {comps}) {'; '.join(self.reasons)}"


class SignalEngine:
    def __init__(self, cfg: StrategyConfig, patterns: PatternRecognizer, technical: TechnicalAnalyzer,
                 predictor: CandlePredictor | None = None):
        self.cfg = cfg
        self.patterns = patterns
        self.technical = technical
        self.predictor = predictor

    def enrich(self, df: pd.DataFrame) -> pd.DataFrame:
        """Xom OHLCV -> indikatorlar + patternlar (bir marta hisoblanadi)."""
        return self.patterns.detect(self.technical.compute(df))

    def evaluate(self, enriched: pd.DataFrame, sentiment: float | None = None) -> Signal:
        row = enriched.iloc[-1]
        levels = self.technical.support_resistance(enriched)
        tech_score, reasons = self.technical.score(enriched, levels)
        comps = {"pattern": float(row["pattern_score"]), "technical": tech_score}

        found = PatternRecognizer.active_patterns(row)
        if found:
            reasons.insert(0, "Patternlar: " + ", ".join(found))
        if sentiment is not None:
            comps["sentiment"] = float(sentiment)

        p_up = None
        if self.predictor is not None and self.predictor.model is not None:
            # indikatorlar allaqachon hisoblangan — xususiyatlar uchun oxirgi qatorlar yetarli
            p_up = self.predictor.predict_proba_up(build_features(enriched.tail(50)))
            comps["ml"] = 2 * p_up - 1
            reasons.append(f"ML P(up)={p_up:.2f}")

        w = self.cfg.weights
        total_w = sum(w.get(k, 0) for k in comps)
        score = sum(w.get(k, 0) * v for k, v in comps.items()) / total_w if total_w else 0.0
        score = float(np.clip(score, -1, 1))

        action = "HOLD"
        if score >= self.cfg.buy_threshold:
            action = "BUY"
            if p_up is not None and p_up < self.cfg.min_ml_probability:
                action = "HOLD"; reasons.append("ML veto: ehtimollik past")
            if sentiment is not None and sentiment < self.cfg.sentiment_veto:
                action = "HOLD"; reasons.append("Sentiment veto")
        elif score <= self.cfg.sell_threshold:
            action = "SELL"
        return Signal(action, score, comps, reasons, levels)
