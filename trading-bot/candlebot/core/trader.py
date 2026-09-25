"""Orkestrator: barcha modullarni real-vaqt siklida bog'laydi.

Sikl (har `loop_interval_sec` da):
  1. Data Ingestion      -> yopilgan shamchalar + joriy narx
  2. Risk: equity nazorati (drawdown / kunlik limit / kill-switch)
  3. Ochiq pozitsiya -> SL/TP/trailing tekshiruvi (har tikda)
  4. Yangiliklar monitoringi -> muhim yangi xabar + ochiq pozitsiya => AI favqulodda ko'rib chiqadi
  5. Yangi shamcha yopilganda -> Pattern + TA + Sentiment + ML -> kvant signal
                              -> AI agent (katta taymfreymlar, yangiliklar, xotira) -> yakuniy qaror
  6. BUY -> Risk plan (sizing, SL/TP, birja limitlari) -> Execution -> Telegram
"""
from __future__ import annotations

import logging
import signal as os_signal
import time

from candlebot.ai.agent import AITradingAgent, timeframe_summary
from candlebot.data.ingestion import DataFeed
from candlebot.execution.order_manager import OrderManager
from candlebot.risk.manager import RiskManager
from candlebot.sentiment.news import SentimentAnalyzer
from candlebot.strategy.signal_engine import SignalEngine
from candlebot.utils.notifier import Notifier

log = logging.getLogger(__name__)


class TradingBot:
    def __init__(self, feed: DataFeed, engine: SignalEngine, risk: RiskManager, orders: OrderManager,
                 sentiment: SentimentAnalyzer | None = None, history_limit: int = 500,
                 loop_interval_sec: int = 30, agent: AITradingAgent | None = None,
                 higher_feeds: dict[str, DataFeed] | None = None, notifier: Notifier | None = None):
        self.feed, self.engine, self.risk, self.orders = feed, engine, risk, orders
        self.sentiment = sentiment
        self.agent = agent
        self.higher_feeds = higher_feeds or {}
        self.notifier = notifier or Notifier()
        self.history_limit = history_limit
        self.loop_interval = loop_interval_sec
        self.last_bar_ts = None
        self.bar_index = 0
        self._last_snapshot: dict | None = None
        self._halt_notified = False
        self._running = False

    # ---------------------------------------------------------------- helpers
    def _close(self, reason: str, price: float, note: str = "") -> None:
        trade = self.orders.close(reason, price)
        self.risk.register_exit(self.bar_index)
        self.notifier.send(f"🔴 {trade['symbol']} yopildi ({reason}) @ {trade['exit_price']:.2f}\n"
                           f"PnL: {trade['pnl']:+.2f} ({trade['pnl_pct']:+.2%}){chr(10) + note if note else ''}")

    def _higher_tf(self) -> dict:
        out = {}
        for tf, feed in self.higher_feeds.items():
            try:
                out[tf] = timeframe_summary(self.engine.technical.compute(feed.fetch_ohlcv(250)))
            except Exception as exc:
                log.warning("%s taymfreym olinmadi: %s", tf, exc)
        return out

    def _check_news(self, price: float) -> None:
        """Yangiliklar monitoringi: muhim yangi xabar chiqsa, ochiq pozitsiyani AI qayta ko'radi."""
        if not self.sentiment:
            return
        new = self.sentiment.poll_new()
        if not new:
            return
        for item, score in new:
            log.info("📰 Yangilik (%+.2f): %s", score, item.title)
        pos = self.orders.position
        if pos is None or self.agent is None or self._last_snapshot is None:
            return
        threshold = self.agent.cfg.news_alert_threshold
        important = [{"title": it.title, "sentiment": round(sc, 2)} for it, sc in new if abs(sc) >= threshold]
        if not important:
            return
        decision = self.agent.review_news(self._last_snapshot, important)
        log.warning("Favqulodda yangilik tahlili: %s", decision)
        if decision.action == "SELL":
            self._close("AI_NEWS_EXIT", price, f"🤖 {decision.reasoning}")

    # -------------------------------------------------------------- main step
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
        if self.risk.halted and not self._halt_notified:
            self._halt_notified = True
            self.notifier.send(f"⛔ KILL-SWITCH: {self.risk.halt_reason}. Bot yangi savdo ochmaydi.")

        pos = self.orders.position
        if pos is not None:
            if self.risk.update_trailing(pos, price):
                log.info("SL breakeven'ga ko'chirildi: %.2f", pos.stop_loss)
            reason, _ = self.risk.check_exit(pos, price, price)
            if reason is None and self.risk.halted:
                reason = "KILL_SWITCH"
            if reason:
                self._close(reason, price)
                return

        self._check_news(price)
        if not new_bar:
            return
        pos = self.orders.position

        enriched = self.engine.enrich(df)
        sent = self.sentiment.get_score() if self.sentiment else None
        sig = self.engine.evaluate(enriched, sent)
        log.info("[%s] narx=%.2f equity=%.2f DD=%.1f%% | %s", self.last_bar_ts, price, equity,
                 self.risk.drawdown(equity) * 100, sig)

        action = sig.action
        ai_note = ""
        if self.agent is not None:
            bar_time = int(self.last_bar_ts.timestamp())
            if self.agent.resolve_due(bar_time, float(enriched["close"].iloc[-1])):
                log.info("AI aniqlik statistikasi: %s", self.agent.memory.stats())
            snapshot = self.agent.build_snapshot(
                enriched, sig, symbol=self.feed.symbol, timeframe=self.feed.timeframe, position=pos,
                equity=equity, drawdown=self.risk.drawdown(equity), higher_tf=self._higher_tf(),
                news=self.sentiment.headlines(self.agent.cfg.news_in_prompt) if self.sentiment else None,
                sentiment=sent)
            self._last_snapshot = snapshot
            if self.agent.should_ask(sig, pos is not None):
                decision = self.agent.decide(snapshot, sig.action, pos is not None)
                self.agent.record(bar_time, price, decision)
                action = self.agent.combine(sig.action, decision)
                ai_note = f"🤖 {decision.reasoning}"
                log.info("%s -> yakuniy: %s", decision, action)
            else:
                action = "HOLD"

        if pos is not None:
            if action == "SELL":
                self._close("AI_EXIT" if self.agent else "SIGNAL_EXIT", price, ai_note)
            return
        if action != "BUY":
            return

        ok, why = self.risk.can_open(0, self.bar_index)
        if not ok:
            log.info("BUY o'tkazib yuborildi: %s", why)
            return
        _, free_quote = self.orders.broker.balances()
        plan, why = self.risk.plan_long(price, float(enriched["atr"].iloc[-1]), equity, free_quote,
                                        self.orders.broker.limits)
        if plan is None:
            log.info("Savdo rejasi rad etildi: %s", why)
            return
        log.info("Reja: %.8f @ ~%.2f, SL %.2f, TP %.2f, xavf %.2f", plan.amount, plan.entry_price,
                 plan.stop_loss, plan.take_profit, plan.risk_amount)
        p = self.orders.open_long(plan)
        self.notifier.send(f"🟢 {p.symbol} LONG {p.amount:.6f} @ {p.entry_price:.2f}\n"
                           f"SL {p.stop_loss:.2f} | TP {p.take_profit:.2f} | xavf ≈ {plan.risk_amount:.2f}\n{ai_note}")

    def run(self) -> None:
        self._running = True
        os_signal.signal(os_signal.SIGINT, self._stop)
        os_signal.signal(os_signal.SIGTERM, self._stop)
        mode = "AI agent" if self.agent else "kvant"
        log.info("Bot ishga tushdi (%s): %s %s", mode, self.feed.symbol, self.feed.timeframe)
        self.notifier.send(f"▶️ CandleBot ishga tushdi ({mode}): {self.feed.symbol} {self.feed.timeframe}")
        while self._running:
            try:
                self.run_once()
            except Exception:
                # Bitta xato butun botni to'xtatmasligi kerak; ammo to'liq traceback loglanadi.
                log.exception("Siklda xato")
            time.sleep(self.loop_interval)
        log.info("Bot to'xtatildi. Ochiq pozitsiya: %s", self.orders.position)
        self.notifier.send("⏹ CandleBot to'xtatildi")

    def _stop(self, *_):
        log.info("To'xtatish signali olindi...")
        self._running = False
