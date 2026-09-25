"""AI Trading Agent: bozorni "treyder kabi" o'qib, qaror qabul qiluvchi LLM qatlami.

Agent nimalarni ko'radi (har yopilgan shamchada):
* oxirgi shamchalar, indikatorlar, topilgan Yaponiya shamcha patternlari, Support/Resistance
* katta taymfreymlar (1h, 4h) trendi — "katta rasm"
* kvant signal (pattern + texnik + ML ballari) va ML ehtimolligi
* so'nggi yangiliklar sarlavhalari va ularning sentiment bali
* ochiq pozitsiya, kapital, drawdown, risk holati
* o'zining oldingi xato qarorlari (saboqlar) va aniqlik statistikasi

Agent NIMA QILA OLMAYDI (xavfsizlik):
* pozitsiya hajmini, Stop-Loss yoki leverage'ni tanlay olmaydi — buni RiskManager qiladi
* kill-switch, kunlik limit, birja cheklovlarini chetlab o'ta olmaydi
* LLM xato qilsa / javob bermasa -> xavfsiz tomonga (HOLD yoki kvant signal) o'tiladi
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from candlebot.ai.llm import LLMClient
from candlebot.ai.memory import DecisionMemory
from candlebot.config import AIConfig
from candlebot.patterns.candlestick import PatternRecognizer

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an elite, disciplined crypto spot trader running an automated account.
You receive a JSON market snapshot every time a candle closes and must decide ONE action:
- "BUY": open a long position (only allowed when flat)
- "SELL": close the open long position (only allowed when in a position)
- "HOLD": do nothing

Principles you follow:
1. Capital preservation first. Missing a trade costs nothing; a bad trade costs money and fees.
   HOLD is the correct answer most of the time.
2. Require confluence: a candlestick pattern alone is never enough. Look for agreement between
   higher-timeframe trend, momentum (RSI/MACD), location (support/resistance), volume, and news.
3. Do not buy directly under resistance, into strongly overbought conditions, against a clear
   higher-timeframe downtrend, or right after major negative news.
4. When in a position: SELL if the thesis is invalidated (bearish reversal at resistance,
   trend break, seriously negative news). Do not panic on normal noise — a Stop-Loss exists.
5. Fees are ~0.2% round trip: expected move must clearly exceed that.
6. Learn from the "lessons" section: these are your own recent wrong calls.
7. You do NOT choose position size, stop-loss or take-profit; the risk engine does.

Answer ONLY with JSON:
{"action": "BUY|SELL|HOLD", "confidence": 0.0-1.0,
 "reasoning": "max 3 short sentences, in Uzbek (latin script)",
 "risks": ["main risk 1", "main risk 2"]}"""

NEWS_REVIEW_PROMPT = SYSTEM_PROMPT + """

EMERGENCY NEWS REVIEW: new headlines just arrived while you hold a position. Decide only between
"SELL" (exit now) and "HOLD" (keep the position). Exit only if the news is materially negative
for the asset's short-term price."""


@dataclass
class AIDecision:
    action: str
    confidence: float
    reasoning: str
    risks: list = field(default_factory=list)
    source: str = "ai"     # ai | fallback | skipped

    def __str__(self) -> str:
        return f"AI[{self.source}] {self.action} ({self.confidence:.0%}): {self.reasoning}"


def _r(x, nd: int = 4):
    """JSON uchun qisqa son (NaN -> None)."""
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return None if not np.isfinite(x) else round(x, nd)


def timeframe_summary(df: pd.DataFrame) -> dict:
    """Katta taymfreym uchun ixcham xulosa (TechnicalAnalyzer.compute dan o'tgan df)."""
    row = df.iloc[-1]
    trend = "up" if row["sma_fast"] > row["sma_slow"] else "down"
    return {
        "trend": trend,
        "close_vs_ema200_pct": _r((row["close"] / row["ema_200"] - 1) * 100, 2),
        "rsi": _r(row["rsi"], 1),
        "macd_hist": _r(row["macd_hist"], 2),
        "change_last_24_bars_pct": _r((row["close"] / df["close"].iloc[-25] - 1) * 100, 2) if len(df) > 25 else None,
    }


class AITradingAgent:
    def __init__(self, cfg: AIConfig, llm: LLMClient, memory: DecisionMemory | None = None):
        self.cfg = cfg
        self.llm = llm
        self.memory = memory or DecisionMemory()
        self._calls: list[float] = []

    # ------------------------------------------------------------- snapshot
    def build_snapshot(self, enriched: pd.DataFrame, signal, *, symbol: str, timeframe: str,
                       position=None, equity: float = 0.0, drawdown: float = 0.0,
                       higher_tf: dict | None = None, news: list | None = None,
                       sentiment: float | None = None) -> dict:
        row = enriched.iloc[-1]
        price = float(row["close"])
        n = self.cfg.candles_in_prompt
        candles = [
            {"t": ts.strftime("%m-%d %H:%M"), "o": _r(r.open, 2), "h": _r(r.high, 2), "l": _r(r.low, 2),
             "c": _r(r.close, 2), "vol_x_avg": _r(r.volume_ratio, 2)}
            for ts, r in enriched.tail(n).iterrows()
        ]
        recent_patterns = []
        for ts, r in enriched.tail(5).iterrows():
            found = PatternRecognizer.active_patterns(r)
            if found:
                recent_patterns.append({"t": ts.strftime("%m-%d %H:%M"), "patterns": found})

        lv = signal.levels
        snap = {
            "symbol": symbol,
            "timeframe": timeframe,
            "time_utc": enriched.index[-1].isoformat(),
            "price": _r(price, 2),
            "candles_oldest_to_newest": candles,
            "candlestick_patterns_last_5_bars": recent_patterns,
            "indicators": {
                "rsi": _r(row["rsi"], 1), "macd_hist": _r(row["macd_hist"], 3),
                "sma20": _r(row["sma_fast"], 2), "sma50": _r(row["sma_slow"], 2), "ema200": _r(row["ema_200"], 2),
                "atr_pct": _r(row["atr"] / price * 100, 3),
                "bollinger_upper": _r(row["bb_upper"], 2), "bollinger_lower": _r(row["bb_lower"], 2),
            },
            "support_levels": [_r(x, 2) for x in (lv.supports if lv else [])],
            "resistance_levels": [_r(x, 2) for x in (lv.resistances if lv else [])],
            "higher_timeframes": higher_tf or {},
            "quant_signal": {"action": signal.action, "score": _r(signal.score, 3),
                             "components": {k: _r(v, 3) for k, v in signal.components.items()},
                             "reasons": signal.reasons},
            "news_sentiment_score": _r(sentiment, 3),
            "recent_news": (news or [])[: self.cfg.news_in_prompt],
            "account": {
                "equity": _r(equity, 2),
                "drawdown_from_peak_pct": _r(drawdown * 100, 2),
                "position": None if position is None else {
                    "entry": _r(position.entry_price, 2), "stop_loss": _r(position.stop_loss, 2),
                    "take_profit": _r(position.take_profit, 2),
                    "unrealized_pct": _r((price / position.entry_price - 1) * 100, 2),
                    "opened_at": position.opened_at,
                },
            },
            "your_track_record": self.memory.stats(),
            "lessons_from_your_recent_mistakes": self.memory.lessons(self.cfg.lessons_in_prompt),
        }
        return snap

    # --------------------------------------------------------------- decide
    def should_ask(self, signal, in_position: bool) -> bool:
        """Xarajatni tejash: bozor "jim" bo'lsa LLM chaqirilmaydi."""
        return in_position or abs(signal.score) >= self.cfg.ask_threshold

    def decide(self, snapshot: dict, quant_action: str, in_position: bool) -> AIDecision:
        return self._ask(SYSTEM_PROMPT, snapshot, quant_action, in_position, allowed=None)

    def review_news(self, snapshot: dict, new_headlines: list) -> AIDecision:
        snapshot = dict(snapshot, breaking_news=new_headlines)
        return self._ask(NEWS_REVIEW_PROMPT, snapshot, "HOLD", True, allowed={"SELL", "HOLD"})

    def _ask(self, system: str, snapshot: dict, quant_action: str, in_position: bool,
             allowed: set | None) -> AIDecision:
        if not self._budget_ok():
            return self._fallback(quant_action, in_position, "Kunlik LLM chaqiruv limiti tugadi")
        try:
            self._calls.append(time.time())
            raw = self.llm.complete_json(system, json.dumps(snapshot, ensure_ascii=False, default=str))
            decision = self._parse(raw)
        except Exception as exc:
            log.warning("LLM xatosi: %s", exc)
            return self._fallback(quant_action, in_position, f"LLM xatosi: {exc}")
        return self._enforce(decision, in_position, allowed)

    @staticmethod
    def _parse(raw: dict) -> AIDecision:
        action = str(raw.get("action", "HOLD")).upper().strip()
        if action not in {"BUY", "SELL", "HOLD"}:
            raise ValueError(f"Noto'g'ri action: {action}")
        conf = float(raw.get("confidence", 0))
        risks = raw.get("risks") or []
        return AIDecision(action, max(0.0, min(1.0, conf)), str(raw.get("reasoning", ""))[:600],
                          [str(r)[:200] for r in risks][:5] if isinstance(risks, list) else [])

    def _enforce(self, d: AIDecision, in_position: bool, allowed: set | None) -> AIDecision:
        """AI javobini qat'iy qoidalarga moslash."""
        if allowed is not None and d.action not in allowed:
            d.action = "HOLD"
        if d.action == "BUY" and in_position:
            d.action = "HOLD"
        if d.action == "SELL" and not in_position:
            d.action = "HOLD"
        if d.action == "BUY" and d.confidence < self.cfg.min_confidence_buy:
            d.reasoning += f" [ishonch {d.confidence:.0%} < {self.cfg.min_confidence_buy:.0%} -> HOLD]"
            d.action = "HOLD"
        if d.action == "SELL" and d.confidence < self.cfg.min_confidence_sell:
            d.reasoning += f" [ishonch {d.confidence:.0%} < {self.cfg.min_confidence_sell:.0%} -> HOLD]"
            d.action = "HOLD"
        return d

    def _fallback(self, quant_action: str, in_position: bool, why: str) -> AIDecision:
        if self.cfg.fallback_to_quant:
            action = quant_action
            if (action == "BUY" and in_position) or (action == "SELL" and not in_position):
                action = "HOLD"
            return AIDecision(action, 0.0, f"{why}; kvant signal ishlatildi", source="fallback")
        return AIDecision("HOLD", 0.0, why, source="fallback")

    def _budget_ok(self) -> bool:
        day_ago = time.time() - 86_400
        self._calls = [t for t in self._calls if t > day_ago]
        return len(self._calls) < self.cfg.max_calls_per_day

    # -------------------------------------------------------------- combine
    def combine(self, quant_action: str, ai: AIDecision) -> str:
        """Yakuniy harakat: `decider` — AI hal qiladi; `confirm` — BUY uchun ikkalasi rozi bo'lishi kerak."""
        if self.cfg.mode == "confirm":
            if quant_action == "BUY" and ai.action == "BUY":
                return "BUY"
            if "SELL" in (quant_action, ai.action):
                return "SELL"
            return "HOLD"
        return ai.action

    def record(self, bar_time: int, price: float, decision: AIDecision) -> None:
        """Faqat haqiqiy AI qarorlari xotiraga yoziladi (fallback'lar emas)."""
        if decision.source == "ai":
            self.memory.add(bar_time, price, decision.action, decision.confidence, decision.reasoning)

    def resolve_due(self, bar_time: int, price: float) -> int:
        return self.memory.resolve(bar_time, price)
