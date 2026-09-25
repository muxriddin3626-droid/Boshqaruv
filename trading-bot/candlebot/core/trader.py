"""Orkestrator: barcha modullarni real-vaqt siklida bog'laydi.

Sikl (har `loop_interval_sec` da):
  1. Data Ingestion      -> yopilgan shamchalar + joriy narx
  2. Risk: equity nazorati (drawdown / kunlik limit)
  3. Ochiq pozitsiya bo'lsa -> SL/TP/trailing tekshiruvi (har tikda)
  4. Yangi shamcha yopilgan bo'lsa -> Pattern + TA + Sentiment + ML -> Signal
  5. BUY signali -> Risk plan (sizing, SL/TP, birja limitlari) -> Execution
"""
from __future__ import annotations

import logging
import signal as os_signal
import time

from candlebot.data.ingestion import DataFeed
from candlebot.execution.order_manager import OrderManager
from candlebot.risk.manager import RiskManager
from candlebot.sentiment.news import SentimentAnalyzer
from candlebot.strategy.signal_engine import SignalEngine

log = logging.getLogger(__name__)


class TradingBot:
    def __init__(self, feed: DataFeed, engine: SignalEngine, risk: RiskManager, orders: OrderManager,
                 sentiment: SentimentAnalyzer | None = None, history_limit: int = 500,
                 loop_interval_sec: int = 30):
        self.feed, self.engine, self.risk, self.orders = feed, engine, risk, orders
        self.sentiment = sentiment
        self.history_limit = history_limit
        self.loop_interval = loop_interval_sec
        self.last_bar_ts = None
        self.bar_index = 0
        self._running = False

    def run_once(self) -> None:
        df = self.feed.fetch_ohlcv(self.history_limit)
        if len(df) < 100:
            log.warning("Tahlil uchun shamchalar yetarli emas (%d)", len(df))
            return
        new_bar = df.index[-1] != self.last_bar_ts
        if new_bar:
            self.last_bar_ts = df.index[-1]
            self.bar_index += 1

        price = self.feed.last_price()
        equity = self.orders.broker.equity(price)
        self.risk.update_equity(equity)

        pos = self.orders.position
        if pos is not None:
            if self.risk.update_trailing(pos, price):
                log.info("SL breakeven'ga ko'chirildi: %.2f", pos.stop_loss)
            reason, _ = self.risk.check_exit(pos, price, price)
            if reason is None and self.risk.halted:
                reason = "KILL_SWITCH"
            if reason:
                self.orders.close(reason, price)
                self.risk.register_exit(self.bar_index)
                return

        if not new_bar:
            return

        enriched = self.engine.enrich(df)
        sent = self.sentiment.get_score() if self.sentiment and self.sentiment.cfg.enabled else None
        sig = self.engine.evaluate(enriched, sent)
        log.info("[%s] narx=%.2f equity=%.2f DD=%.1f%% | %s", self.last_bar_ts, price, equity,
                 self.risk.drawdown(equity) * 100, sig)

        if pos is not None:
            if sig.action == "SELL":
                self.orders.close("SIGNAL_EXIT", price)
                self.risk.register_exit(self.bar_index)
            return

        if sig.action != "BUY":
            return
        ok, why = self.risk.can_open(0, self.bar_index)
        if not ok:
            log.info("BUY signali o'tkazib yuborildi: %s", why)
            return
        _, free_quote = self.orders.broker.balances()
        plan, why = self.risk.plan_long(price, float(enriched["atr"].iloc[-1]), equity, free_quote,
                                        self.orders.broker.limits)
        if plan is None:
            log.info("Savdo rejasi rad etildi: %s", why)
            return
        log.info("Reja: %.8f @ ~%.2f, SL %.2f, TP %.2f, xavf %.2f", plan.amount, plan.entry_price,
                 plan.stop_loss, plan.take_profit, plan.risk_amount)
        self.orders.open_long(plan)

    def run(self) -> None:
        self._running = True
        os_signal.signal(os_signal.SIGINT, self._stop)
        os_signal.signal(os_signal.SIGTERM, self._stop)
        log.info("Bot ishga tushdi: %s %s", self.feed.symbol, self.feed.timeframe)
        while self._running:
            try:
                self.run_once()
            except Exception:
                # Bitta xato butun botni to'xtatmasligi kerak; ammo to'liq traceback loglanadi.
                log.exception("Siklda xato")
            time.sleep(self.loop_interval)
        log.info("Bot to'xtatildi. Ochiq pozitsiya: %s", self.orders.position)

    def _stop(self, *_):
        log.info("To'xtatish signali olindi...")
        self._running = False
