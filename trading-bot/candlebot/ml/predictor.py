"""Keyingi shamcha harakati ehtimolini baholovchi model (Scikit-Learn).

* HistGradientBoostingClassifier — NaN'larni o'zi qayta ishlaydi, tez va kuchli baseline.
* TimeSeriesSplit — vaqt qatorlari uchun to'g'ri cross-validation (kelajak ma'lumoti
  o'qitishga aralashmaydi). Oddiy KFold bu yerda xato natija beradi!
* Model + metama'lumot joblib bilan saqlanadi.
"""
from __future__ import annotations

import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, precision_score, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit

from candlebot.ml.features import FEATURE_COLUMNS

log = logging.getLogger(__name__)


class CandlePredictor:
    def __init__(self, model_path: str | Path = "models/candle_predictor.joblib"):
        self.model_path = Path(model_path)
        self.model: HistGradientBoostingClassifier | None = None
        self.metrics: dict = {}

    @staticmethod
    def _new_model() -> HistGradientBoostingClassifier:
        return HistGradientBoostingClassifier(
            max_depth=4, learning_rate=0.05, max_iter=300, l2_regularization=1.0,
            early_stopping=True, validation_fraction=0.15, random_state=42,
        )

    def train(self, features: pd.DataFrame, labels: pd.Series, n_splits: int = 5) -> dict:
        data = features.join(labels.rename("y")).dropna(subset=["y"])
        X, y = data[FEATURE_COLUMNS], data["y"].astype(int)
        if len(X) < 300:
            raise ValueError(f"O'qitish uchun ma'lumot kam: {len(X)} qator (kamida 300)")

        folds = []
        for tr, te in TimeSeriesSplit(n_splits=n_splits).split(X):
            m = self._new_model().fit(X.iloc[tr], y.iloc[tr])
            proba = m.predict_proba(X.iloc[te])[:, 1]
            pred = (proba >= 0.5).astype(int)
            yt = y.iloc[te]
            folds.append({
                "accuracy": accuracy_score(yt, pred),
                "precision": precision_score(yt, pred, zero_division=0),
                "roc_auc": roc_auc_score(yt, proba) if yt.nunique() > 1 else np.nan,
            })
        self.metrics = {k: float(np.nanmean([f[k] for f in folds])) for k in folds[0]}
        self.metrics["base_rate"] = float(y.mean())
        self.model = self._new_model().fit(X, y)
        log.info("ML CV natijalari: %s", {k: round(v, 3) for k, v in self.metrics.items()})
        return self.metrics

    def predict_proba_up(self, features: pd.DataFrame) -> float:
        """Oxirgi qator uchun P(narx xarajatlardan ko'proq o'sadi)."""
        if self.model is None:
            raise RuntimeError("Model o'qitilmagan yoki yuklanmagan")
        return float(self.model.predict_proba(features[FEATURE_COLUMNS].iloc[[-1]])[0, 1])

    def save(self) -> None:
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self.model, "metrics": self.metrics, "features": FEATURE_COLUMNS},
                    self.model_path)

    def load(self) -> "CandlePredictor":
        blob = joblib.load(self.model_path)
        if blob["features"] != FEATURE_COLUMNS:
            raise ValueError("Saqlangan model boshqa xususiyatlar to'plami bilan o'qitilgan — qayta o'qiting")
        self.model, self.metrics = blob["model"], blob["metrics"]
        return self
