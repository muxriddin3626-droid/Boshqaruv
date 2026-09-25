"""6-modul: Risk Management Engine.

Qat'iy qoidalar (hech bir signal ularni chetlab o'ta olmaydi):
1. Position sizing — fixed-fractional: har savdoda kapitalning `risk_per_trade` qismi xavfda.
     amount = (equity × risk%) / (stop masofasi + komissiyalar + sirpanish)
2. Stop-Loss = entry − ATR × k;  Take-Profit = entry + (entry − SL) × R:R
3. Pozitsiya hajmi chegarasi (`max_position_pct`) va mavjud balans.
4. Birja cheklovlari: minimal miqdor, minimal summa (notional), miqdor qadami (precision).
5. Max drawdown kill-switch — cho'qqidan X% tushsa bot butunlay to'xtaydi (qo'lda qayta yoqish).
6. Kunlik zarar limiti — limitga yetsa ertangi UTC kungacha yangi savdo yo'q.
7. Cooldown — pozitsiya yopilgach N shamcha kutish (revenge trading'ga qarshi).
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timezone

from candlebot.config import RiskConfig

log = logging.getLogger(__name__)


@dataclass
class MarketLimits:
    min_amount: float = 0.0
    min_cost: float = 0.0       # minimal notional (masalan Binance BTC/USDT uchun ~5 USDT)
    amount_step: float = 0.0    # miqdor qadami (0 = cheklov yo'q)
    price_step: float = 0.0

    @classmethod
    def from_ccxt_market(cls, market: dict, precision_mode: int) -> "MarketLimits":
        """ccxt market ma'lumotidan limitlarni o'qish (TICK_SIZE va DECIMAL_PLACES rejimlari)."""
        from ccxt.base.decimal_to_precision import TICK_SIZE

        def step(p):
            if p is None:
                return 0.0
            return float(p) if precision_mode == TICK_SIZE else 10 ** (-int(p))

        limits = market.get("limits", {})
        return cls(
            min_amount=float((limits.get("amount") or {}).get("min") or 0),
            min_cost=float((limits.get("cost") or {}).get("min") or 0),
            amount_step=step(market.get("precision", {}).get("amount")),
            price_step=step(market.get("precision", {}).get("price")),
        )

    def floor_amount(self, amount: float) -> float:
        if self.amount_step <= 0:
            return amount
        # suzuvchi nuqta xatolariga qarshi kichik epsilon
        return math.floor(amount / self.amount_step + 1e-9) * self.amount_step


@dataclass
class TradePlan:
    side: str
    entry_price: float
    amount: float
    stop_loss: float
    take_profit: float
    risk_amount: float      # SL ishlasa taxminiy zarar (komissiyalar bilan)
    notional: float


@dataclass
class PositionState:
    """RiskManager'ga kerakli minimal pozitsiya ma'lumoti (long)."""
    entry_price: float
    stop_loss: float
    take_profit: float
    initial_stop: float


class RiskManager:
    def __init__(self, cfg: RiskConfig, initial_equity: float):
        self.cfg = cfg
        self.peak_equity = initial_equity
        self.day_start_equity = initial_equity
        self.current_day = datetime.now(timezone.utc).date()
        self.halted = False           # max drawdown — qattiq to'xtash
        self.daily_blocked = False
        self.last_exit_bar: int | None = None
        self.halt_reason = ""

    # ---------------------------------------------------------- equity guard
    def update_equity(self, equity: float, now: datetime | None = None) -> None:
        now = now or datetime.now(timezone.utc)
        if now.date() != self.current_day:
            self.current_day = now.date()
            self.day_start_equity = equity
            self.daily_blocked = False
        self.peak_equity = max(self.peak_equity, equity)

        drawdown = 1 - equity / self.peak_equity if self.peak_equity > 0 else 0.0
        if drawdown >= self.cfg.max_drawdown and not self.halted:
            self.halted = True
            self.halt_reason = f"Max drawdown {drawdown:.1%} >= {self.cfg.max_drawdown:.0%}"
            log.critical("KILL-SWITCH: %s. Bot yangi savdo ochmaydi.", self.halt_reason)

        daily_loss = 1 - equity / self.day_start_equity if self.day_start_equity > 0 else 0.0
        if daily_loss >= self.cfg.daily_loss_limit and not self.daily_blocked:
            self.daily_blocked = True
            log.error("Kunlik zarar limiti: %.1f%% — bugun yangi savdo yo'q", daily_loss * 100)

    def drawdown(self, equity: float) -> float:
        return 1 - equity / self.peak_equity if self.peak_equity > 0 else 0.0

    def register_exit(self, bar_index: int) -> None:
        self.last_exit_bar = bar_index

    def can_open(self, open_positions: int, bar_index: int) -> tuple[bool, str]:
        if self.halted:
            return False, self.halt_reason
        if self.daily_blocked:
            return False, "Kunlik zarar limiti"
        if open_positions >= self.cfg.max_open_positions:
            return False, "Ochiq pozitsiyalar limiti"
        if self.last_exit_bar is not None and bar_index - self.last_exit_bar < self.cfg.cooldown_bars:
            return False, "Cooldown"
        return True, ""

    # ---------------------------------------------------------------- sizing
    def plan_long(self, entry: float, atr: float, equity: float, free_quote: float,
                  limits: MarketLimits) -> tuple[TradePlan | None, str]:
        c = self.cfg
        if not (entry > 0 and atr > 0 and math.isfinite(atr)):
            return None, "Noto'g'ri narx/ATR"

        stop_dist = atr * c.atr_sl_multiplier
        stop_loss = entry - stop_dist
        if stop_loss <= 0:
            return None, "Stop-Loss nolga teng yoki manfiy"
        take_profit = entry + stop_dist * c.reward_risk_ratio

        # Kirish va chiqishdagi komissiya + sirpanish ham xavf qismi.
        cost_per_unit = entry * (2 * c.fee_rate + 2 * c.slippage)
        if stop_dist * c.reward_risk_ratio <= cost_per_unit:
            return None, "Take-Profit komissiyalarni qoplamaydi"
        risk_per_unit = stop_dist + cost_per_unit

        risk_budget = equity * c.risk_per_trade
        amount = risk_budget / risk_per_unit
        amount = min(amount, equity * c.max_position_pct / entry)
        buy_price = entry * (1 + c.slippage)
        amount = min(amount, free_quote / (buy_price * (1 + c.fee_rate)))
        amount = limits.floor_amount(amount)

        notional = amount * entry
        if amount <= 0:
            return None, "Balans yetarli emas"
        if limits.min_amount and amount < limits.min_amount:
            return None, f"Miqdor {amount:.8f} < birja minimumi {limits.min_amount}"
        if limits.min_cost and notional < limits.min_cost:
            return None, f"Summa {notional:.2f} < birja min notional {limits.min_cost}"

        return TradePlan("buy", entry, amount, stop_loss, take_profit,
                         risk_amount=amount * risk_per_unit, notional=notional), ""

    # ------------------------------------------------------------------ exit
    def check_exit(self, pos: PositionState, low: float, high: float) -> tuple[str | None, float]:
        """Shamcha diapazonida SL/TP tekshirish. Ikkalasi ham tegsa — konservativ: SL."""
        if low <= pos.stop_loss:
            return "STOP_LOSS", pos.stop_loss
        if high >= pos.take_profit:
            return "TAKE_PROFIT", pos.take_profit
        return None, 0.0

    def update_trailing(self, pos: PositionState, price: float) -> bool:
        """1R foydaga yetganda SL'ni breakeven (+komissiya) ga ko'chirish. O'zgarsa True."""
        if self.cfg.breakeven_at_r <= 0:
            return False
        r = pos.entry_price - pos.initial_stop
        breakeven = pos.entry_price * (1 + 2 * self.cfg.fee_rate)
        if price - pos.entry_price >= r * self.cfg.breakeven_at_r and pos.stop_loss < breakeven:
            pos.stop_loss = breakeven
            return True
        return False
