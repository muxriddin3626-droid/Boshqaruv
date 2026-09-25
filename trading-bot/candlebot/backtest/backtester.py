"""Backtester: aynan jonli botdagi SignalEngine + RiskManager + PaperBroker bilan tarixiy sinov.

Realizm qoidalari:
* Signal i-shamcha YOPILGANDA hisoblanadi, kirish (i+1)-shamcha OCHILISH narxida.
* SL/TP shamcha high/low bo'yicha; ikkalasi bir shamchada tegsa — SL (pessimistik).
* Narx SL ostida ochilsa (gap) — ochilish narxida chiqiladi.
* Komissiya va sirpanish har bir bajarilishda hisoblanadi.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from candlebot.config import RiskConfig
from candlebot.execution.brokers import PaperBroker
from candlebot.execution.order_manager import OrderManager
from candlebot.risk.manager import RiskManager
from candlebot.strategy.signal_engine import SignalEngine

BARS_PER_YEAR = {"1m": 525_600, "5m": 105_120, "15m": 35_040, "30m": 17_520, "1h": 8_760,
                 "4h": 2_190, "1d": 365}


@dataclass
class BacktestResult:
    metrics: dict
    trades: pd.DataFrame
    equity: pd.Series

    def summary(self) -> str:
        m = self.metrics
        halted = "HA" if m["halted"] else "yo'q"
        return "\n".join([
            f"Savdolar soni     : {m['trades']}",
            f"Umumiy daromad    : {m['total_return']:+.2%}   (Buy&Hold: {m['buy_hold_return']:+.2%})",
            f"Win rate          : {m['win_rate']:.1%}",
            f"Profit factor     : {m['profit_factor']:.2f}",
            f"Max drawdown      : {m['max_drawdown']:.2%}",
            f"Sharpe (yillik)   : {m['sharpe']:.2f}",
            f"Yakuniy kapital   : {m['final_equity']:.2f}",
            f"Kill-switch       : {halted}",
        ])


class Backtester:
    def __init__(self, engine: SignalEngine, risk_cfg: RiskConfig, initial_quote: float = 10_000.0,
                 timeframe: str = "15m", warmup: int = 210):
        self.engine = engine
        self.risk_cfg = risk_cfg
        self.initial_quote = initial_quote
        self.timeframe = timeframe
        self.warmup = warmup

    def run(self, df: pd.DataFrame) -> BacktestResult:
        cfg = self.risk_cfg
        broker = PaperBroker("BT", self.initial_quote, cfg.fee_rate, cfg.slippage)
        orders = OrderManager(broker)
        risk = RiskManager(cfg, self.initial_quote)
        risk.current_day = df.index[self.warmup].date()

        enriched = self.engine.enrich(df)
        o, h, l, c = (enriched[k].to_numpy() for k in ("open", "high", "low", "close"))
        atr = enriched["atr"].to_numpy()
        times = enriched.index
        equity_curve = []
        pending_buy_atr: float | None = None

        for i in range(self.warmup, len(enriched)):
            now = times[i].to_pydatetime()

            # 1) Oldingi shamcha signali bo'yicha kirish — joriy ochilish narxida
            if pending_buy_atr is not None and orders.position is None:
                eq = broker.equity(o[i])
                plan, _ = risk.plan_long(o[i], pending_buy_atr, eq, broker.quote, broker.limits)
                if plan:
                    orders.open_long(plan, now)
            pending_buy_atr = None

            # 2) SL/TP (shamcha ichida)
            pos = orders.position
            if pos is not None:
                reason, level = risk.check_exit(pos, l[i], h[i])
                if reason == "STOP_LOSS":
                    orders.close(reason, min(level, o[i]), now)
                    risk.register_exit(i)
                elif reason == "TAKE_PROFIT":
                    orders.close(reason, max(level, o[i]), now)
                    risk.register_exit(i)
                else:
                    risk.update_trailing(pos, c[i])

            equity = broker.equity(c[i])
            risk.update_equity(equity, now)
            equity_curve.append((times[i], equity))

            if risk.halted and orders.position is not None:
                orders.close("KILL_SWITCH", c[i], now)
                risk.register_exit(i)
            if i == len(enriched) - 1:
                break

            # 3) Yopilgan shamcha bo'yicha signal
            sig = self.engine.evaluate(enriched.iloc[: i + 1])
            if orders.position is not None and sig.action == "SELL":
                orders.close("SIGNAL_EXIT", c[i], now)
                risk.register_exit(i)
            elif orders.position is None and sig.action == "BUY":
                ok, _ = risk.can_open(0, i)
                if ok and math.isfinite(atr[i]):
                    pending_buy_atr = float(atr[i])

        if orders.position is not None:
            orders.close("END_OF_DATA", c[-1], times[-1].to_pydatetime())
            equity_curve[-1] = (times[-1], broker.equity(c[-1]))

        eq = pd.Series(dict(equity_curve))
        trades = pd.DataFrame(orders.trades)
        return BacktestResult(self._metrics(eq, trades, c, risk.halted), trades, eq)

    def _metrics(self, eq: pd.Series, trades: pd.DataFrame, close: np.ndarray, halted: bool) -> dict:
        rets = eq.pct_change().dropna()
        bpy = BARS_PER_YEAR.get(self.timeframe, 35_040)
        sharpe = float(rets.mean() / rets.std() * math.sqrt(bpy)) if len(rets) > 1 and rets.std() > 0 else 0.0
        max_dd = float((1 - eq / eq.cummax()).max()) if len(eq) else 0.0
        if len(trades):
            wins, losses = trades.loc[trades.pnl > 0, "pnl"], trades.loc[trades.pnl <= 0, "pnl"]
            win_rate = len(wins) / len(trades)
            profit_factor = float(wins.sum() / -losses.sum()) if losses.sum() < 0 else float("inf")
        else:
            win_rate, profit_factor = 0.0, 0.0
        return {
            "trades": len(trades),
            "total_return": float(eq.iloc[-1] / self.initial_quote - 1),
            "buy_hold_return": float(close[-1] / close[self.warmup] - 1),
            "win_rate": win_rate,
            "profit_factor": profit_factor,
            "max_drawdown": max_dd,
            "sharpe": sharpe,
            "final_equity": float(eq.iloc[-1]),
            "halted": halted,
        }
