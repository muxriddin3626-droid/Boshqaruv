from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

from candlebot.analysis.technical import TechnicalAnalyzer
from candlebot.backtest.backtester import Backtester
from candlebot.config import BotConfig, RiskConfig, SentimentConfig, StrategyConfig
from candlebot.data.ingestion import SyntheticDataFeed
from candlebot.execution.brokers import PaperBroker
from candlebot.execution.order_manager import OrderManager
from candlebot.patterns.candlestick import HAS_TALIB, PatternRecognizer
from candlebot.risk.manager import MarketLimits, PositionState, RiskManager
from candlebot.sentiment.news import KeywordSentimentModel, NewsItem, SentimentAnalyzer
from candlebot.strategy.signal_engine import SignalEngine


def candles(rows):
    idx = pd.date_range("2024-01-01", periods=len(rows), freq="15min", tz="UTC")
    return pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx).assign(volume=1.0)


def downtrend_then(last_rows):
    rows = [[110 - i, 110.5 - i, 108.5 - i, 109 - i] for i in range(20)]
    return candles(rows + last_rows)


# ------------------------------------------------------------------ patterns
@pytest.mark.parametrize("use_talib", [False] + ([True] if HAS_TALIB else []))
def test_bullish_engulfing_detected(use_talib):
    df = downtrend_then([[91.0, 91.2, 89.9, 90.0], [89.8, 91.8, 89.7, 91.6]])
    out = PatternRecognizer(use_talib=use_talib).detect(df)
    assert out["cdl_engulfing"].iloc[-1] == 100
    assert out["pattern_score"].iloc[-1] > 0


def test_fallback_hammer_in_downtrend():
    df = downtrend_then([[89.6, 90.3, 87.5, 90.2]])
    out = PatternRecognizer(use_talib=False).detect(df)
    assert out["cdl_hammer"].iloc[-1] == 100
    assert "hammer(+)" in PatternRecognizer.active_patterns(out.iloc[-1])


def test_support_resistance_levels_straddle_price():
    df = SyntheticDataFeed(600, seed=3).df
    ta = TechnicalAnalyzer()
    levels = ta.support_resistance(ta.compute(df))
    price = df["close"].iloc[-1]
    assert all(s < price for s in levels.supports)
    assert all(r > price for r in levels.resistances)


# ---------------------------------------------------------------------- risk
LIMITS = MarketLimits(min_amount=0.0001, min_cost=5, amount_step=0.0001)


def test_position_sizing_respects_risk_budget():
    cfg = RiskConfig(risk_per_trade=0.01, max_position_pct=1.0, atr_sl_multiplier=2, reward_risk_ratio=2)
    plan, why = RiskManager(cfg, 10_000).plan_long(entry=100, atr=1, equity=10_000, free_quote=10_000,
                                                   limits=LIMITS)
    assert plan is not None, why
    assert plan.stop_loss == pytest.approx(98) and plan.take_profit == pytest.approx(104)
    assert plan.risk_amount <= 100 + 1e-9  # 1% of equity incl. fees
    assert plan.amount == pytest.approx(round(plan.amount / 0.0001) * 0.0001)


def test_position_capped_by_max_position_pct():
    cfg = RiskConfig(max_position_pct=0.1)
    plan, _ = RiskManager(cfg, 10_000).plan_long(100, 0.1, 10_000, 10_000, LIMITS)
    assert plan.notional <= 1_000 + 1e-6


def test_min_notional_rejected():
    plan, why = RiskManager(RiskConfig(), 10).plan_long(100, 1, 10, 10, MarketLimits(min_cost=5))
    assert plan is None and "notional" in why


def test_tp_must_cover_fees():
    cfg = RiskConfig(fee_rate=0.01)
    plan, why = RiskManager(cfg, 10_000).plan_long(100, 0.1, 10_000, 10_000, LIMITS)
    assert plan is None and "komissiya" in why


def test_kill_switch_and_daily_limit():
    rm = RiskManager(RiskConfig(max_drawdown=0.1, daily_loss_limit=0.05), 1000)
    now = datetime.now(timezone.utc)
    rm.update_equity(940, now)
    assert rm.daily_blocked and not rm.halted
    assert rm.can_open(0, 10) == (False, "Kunlik zarar limiti")
    rm.update_equity(950, now + timedelta(days=1))
    assert not rm.daily_blocked
    rm.update_equity(890, now + timedelta(days=1))
    assert rm.halted and not rm.can_open(0, 10)[0]


def test_cooldown_and_exit_priority():
    rm = RiskManager(RiskConfig(cooldown_bars=3), 1000)
    rm.register_exit(10)
    assert not rm.can_open(0, 12)[0] and rm.can_open(0, 13)[0]
    pos = PositionState(entry_price=100, stop_loss=98, take_profit=104, initial_stop=98)
    assert rm.check_exit(pos, low=97, high=105)[0] == "STOP_LOSS"   # ikkalasi tegsa -> SL
    assert rm.check_exit(pos, low=99, high=105) == ("TAKE_PROFIT", 104)
    assert rm.update_trailing(pos, 102) and pos.stop_loss > 100


# ----------------------------------------------------------------- execution
def test_paper_round_trip_pays_fees(tmp_path):
    broker = PaperBroker("BTC/USDT", 1000, fee_rate=0.001, slippage=0.0)
    om = OrderManager(broker, tmp_path / "state.json", tmp_path / "trades.csv")
    plan, _ = RiskManager(RiskConfig(max_position_pct=0.5), 1000).plan_long(100, 1, 1000, 1000, LIMITS)
    om.open_long(plan)
    trade = om.close("TEST", 100)
    assert trade["pnl"] == pytest.approx(-2 * 0.001 * plan.amount * 100, rel=1e-6)
    assert (tmp_path / "trades.csv").read_text().count("\n") == 2


def test_state_restored_after_restart(tmp_path):
    broker = PaperBroker("BTC/USDT", 1000, slippage=0.0)
    om = OrderManager(broker, tmp_path / "state.json")
    plan, _ = RiskManager(RiskConfig(), 1000).plan_long(100, 1, 1000, 1000, LIMITS)
    om.open_long(plan)
    restored = OrderManager(broker, tmp_path / "state.json")
    assert restored.position is not None and restored.position.amount == om.position.amount


# ------------------------------------------------------------------ strategy
def test_signal_engine_and_backtest_run():
    cfg = BotConfig()
    engine = SignalEngine(cfg.strategy, PatternRecognizer(), TechnicalAnalyzer(cfg.technical))
    df = SyntheticDataFeed(800, seed=7).df
    sig = engine.evaluate(engine.enrich(df), sentiment=0.2)
    assert sig.action in {"BUY", "SELL", "HOLD"} and -1 <= sig.score <= 1
    res = Backtester(engine, cfg.risk).run(df)
    assert res.equity.iloc[0] == pytest.approx(10_000, rel=0.05)
    assert res.metrics["max_drawdown"] < cfg.risk.max_drawdown + 0.05


def test_sentiment_veto_blocks_buy():
    cfg = StrategyConfig(buy_threshold=-1.0, weights={"pattern": 0, "technical": 0, "sentiment": 0.0001})
    engine = SignalEngine(cfg, PatternRecognizer(), TechnicalAnalyzer())
    enriched = engine.enrich(SyntheticDataFeed(300).df)
    assert engine.evaluate(enriched, sentiment=0.0).action == "BUY"
    assert engine.evaluate(enriched, sentiment=-0.9).action == "HOLD"


# ----------------------------------------------------------------- sentiment
def test_keyword_sentiment_with_time_decay():
    now = datetime.now(timezone.utc)
    items = [NewsItem("Bitcoin rally to record high", "", "t", now),
             NewsItem("Bitcoin crash after exchange hack", "", "t", now - timedelta(hours=24)),
             NewsItem("Weather is nice", "", "t", now)]
    sa = SentimentAnalyzer(SentimentConfig(enabled=True, half_life_hours=6), model=KeywordSentimentModel())
    score = sa.aggregate(items, now)
    assert 0.8 < score <= 1.0  # yangi ijobiy xabar eski salbiydan ancha og'irroq


def test_live_mode_requires_explicit_opt_in(monkeypatch):
    monkeypatch.delenv("ALLOW_LIVE_TRADING", raising=False)
    cfg = BotConfig(mode="live")
    with pytest.raises(PermissionError):
        cfg.validate()


def test_rsi_bounds():
    out = TechnicalAnalyzer().compute(SyntheticDataFeed(400).df)
    rsi = out["rsi"].dropna()
    assert ((rsi >= 0) & (rsi <= 100)).all() and not np.isnan(out["atr"].iloc[-1])


# ------------------------------------------------------- ccxt broker (mock)
class FakeExchange:
    precisionMode = 4  # ccxt TICK_SIZE

    def __init__(self):
        self.free = {"BTC": 0.0, "USDT": 1000.0}
        self.orders = []

    def load_markets(self):
        pass

    def market(self, symbol):
        return {"base": "BTC", "quote": "USDT", "taker": 0.001,
                "limits": {"amount": {"min": 0.00001}, "cost": {"min": 5}},
                "precision": {"amount": 0.00001, "price": 0.01}}

    def amount_to_precision(self, symbol, amount):
        return f"{int(amount / 0.00001 + 1e-9) * 0.00001:.5f}"

    def fetch_balance(self):
        return {"free": dict(self.free)}

    def create_order(self, symbol, type_, side, amount, params=None):
        assert type_ == "market" and params["newClientOrderId"].startswith("cb")
        self.orders.append((side, amount))
        price, fee_base = 100.0, (amount * 0.001 if side == "buy" else 0)
        if side == "buy":
            self.free["BTC"] += amount - fee_base
            self.free["USDT"] -= amount * price
            fee = {"cost": fee_base, "currency": "BTC"}
        else:
            self.free["BTC"] -= amount
            self.free["USDT"] += amount * price * 0.999
            fee = {"cost": amount * price * 0.001, "currency": "USDT"}
        return {"id": str(len(self.orders)), "status": "closed", "filled": amount, "average": price,
                "cost": amount * price, "fees": [fee]}


def test_ccxt_broker_handles_fee_in_base_asset():
    from candlebot.execution.brokers import CCXTBroker

    ex = FakeExchange()
    broker = CCXTBroker(ex, "BTC/USDT")
    assert broker.limits.min_cost == 5 and broker.limits.amount_step == 0.00001
    om = OrderManager(broker)
    plan, _ = RiskManager(RiskConfig(), 1000).plan_long(100, 1, 1000, 1000, broker.limits)
    pos = om.open_long(plan)
    assert pos.amount == pytest.approx(plan.amount * 0.999)  # komissiya BTC'dan ushlandi
    om.close("TEST", 100)
    assert ex.orders[1][1] <= ex.free["BTC"] + pos.amount  # mavjud balansdan ortiq sotilmadi
    assert ex.free["BTC"] >= -1e-12
