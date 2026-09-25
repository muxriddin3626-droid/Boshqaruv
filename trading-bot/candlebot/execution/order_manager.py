"""Order Management: pozitsiyani ochish/yopish, holatni diskka saqlash, savdo jurnali.

SL/TP "software-managed": har siklda narx tekshiriladi va kerak bo'lsa market sell yuboriladi.
Bot qayta ishga tushsa, ochiq pozitsiya state faylidan tiklanadi.
"""
from __future__ import annotations

import csv
import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from candlebot.execution.brokers import Broker
from candlebot.risk.manager import PositionState, TradePlan

log = logging.getLogger(__name__)


@dataclass
class Position(PositionState):
    symbol: str
    amount: float
    cost_quote: float      # kirishda sarflangan jami summa (komissiya bilan)
    opened_at: str
    entry_order_id: str


class OrderManager:
    JOURNAL_FIELDS = ["symbol", "opened_at", "closed_at", "entry_price", "exit_price", "amount",
                      "pnl", "pnl_pct", "reason", "entry_order_id", "exit_order_id"]

    def __init__(self, broker: Broker, state_file: str | Path | None = None,
                 journal_file: str | Path | None = None):
        self.broker = broker
        self.state_file = Path(state_file) if state_file else None
        self.journal_file = Path(journal_file) if journal_file else None
        self.position: Position | None = None
        self.trades: list[dict] = []
        self._load_state()

    # ----------------------------------------------------------------- trade
    def open_long(self, plan: TradePlan, now: datetime | None = None) -> Position:
        if self.position is not None:
            raise RuntimeError("Pozitsiya allaqachon ochiq")
        fill = self.broker.market_buy(plan.amount, plan.entry_price)
        # SL/TP masofalarini haqiqiy bajarilish narxiga moslashtiramiz.
        shift = fill.avg_price - plan.entry_price
        self.position = Position(
            entry_price=fill.avg_price,
            stop_loss=plan.stop_loss + shift,
            take_profit=plan.take_profit + shift,
            initial_stop=plan.stop_loss + shift,
            symbol=self.broker.symbol,
            amount=fill.amount,
            cost_quote=fill.quote_amount,
            opened_at=(now or datetime.now(timezone.utc)).isoformat(),
            entry_order_id=fill.order_id,
        )
        log.info("LONG ochildi: %.8f @ %.2f | SL %.2f | TP %.2f", fill.amount, fill.avg_price,
                 self.position.stop_loss, self.position.take_profit)
        self._save_state()
        return self.position

    def close(self, reason: str, ref_price: float, now: datetime | None = None) -> dict:
        pos = self.position
        if pos is None:
            raise RuntimeError("Yopiladigan pozitsiya yo'q")
        fill = self.broker.market_sell(pos.amount, ref_price)
        pnl = fill.quote_amount - pos.cost_quote
        trade = {
            "symbol": pos.symbol, "opened_at": pos.opened_at,
            "closed_at": (now or datetime.now(timezone.utc)).isoformat(),
            "entry_price": round(pos.entry_price, 8), "exit_price": round(fill.avg_price, 8),
            "amount": pos.amount, "pnl": round(pnl, 8),
            "pnl_pct": round(pnl / pos.cost_quote, 6) if pos.cost_quote else 0.0,
            "reason": reason, "entry_order_id": pos.entry_order_id, "exit_order_id": fill.order_id,
        }
        self.trades.append(trade)
        self.position = None
        log.info("Pozitsiya yopildi (%s): PnL %+.2f (%+.2f%%)", reason, pnl, trade["pnl_pct"] * 100)
        self._journal(trade)
        self._save_state()
        return trade

    # ----------------------------------------------------------- persistence
    def _save_state(self) -> None:
        if not self.state_file:
            return
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps({"position": asdict(self.position) if self.position else None}, indent=2))
        tmp.replace(self.state_file)  # atomar yozish

    def _load_state(self) -> None:
        if not (self.state_file and self.state_file.exists()):
            return
        data = json.loads(self.state_file.read_text() or "{}")
        if data.get("position"):
            pos = Position(**data["position"])
            base_free, _ = self.broker.balances()
            if base_free + 1e-12 < pos.amount * 0.99:
                log.warning("State'dagi pozitsiya (%.8f) balansda yo'q (%.8f) — e'tiborsiz qoldirildi",
                            pos.amount, base_free)
                return
            self.position = pos
            log.info("Ochiq pozitsiya tiklandi: %s", pos)

    def _journal(self, trade: dict) -> None:
        if not self.journal_file:
            return
        self.journal_file.parent.mkdir(parents=True, exist_ok=True)
        new = not self.journal_file.exists()
        with self.journal_file.open("a", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=self.JOURNAL_FIELDS)
            if new:
                writer.writeheader()
            writer.writerow(trade)
