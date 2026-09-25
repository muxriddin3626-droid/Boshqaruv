"""CandleBot CLI.

    python main.py backtest [--source synthetic|exchange|csv] [--ml]
    python main.py train    [--days 120]
    python main.py check                 # testnet ulanishi va balansni tekshirish
    python main.py run                   # config.mode bo'yicha: paper | testnet | live
    python main.py ai-test [--dry]       # AI agent bozorni qanday ko'rishini va qarorini ko'rsatish
"""
from __future__ import annotations

import argparse
import json
import logging
import sys

import ccxt

from candlebot.ai.agent import AITradingAgent, timeframe_summary
from candlebot.ai.llm import build_llm
from candlebot.ai.memory import DecisionMemory
from candlebot.analysis.technical import TechnicalAnalyzer
from candlebot.backtest.backtester import Backtester
from candlebot.config import BotConfig, load_config
from candlebot.core.trader import TradingBot
from candlebot.data.ingestion import CSVDataFeed, MarketDataFeed, SyntheticDataFeed, build_exchange
from candlebot.execution.brokers import CCXTBroker, PaperBroker
from candlebot.execution.order_manager import OrderManager
from candlebot.ml.features import build_features, build_labels
from candlebot.ml.predictor import CandlePredictor
from candlebot.patterns.candlestick import PatternRecognizer
from candlebot.risk.manager import RiskManager
from candlebot.sentiment.news import SentimentAnalyzer
from candlebot.strategy.signal_engine import SignalEngine
from candlebot.utils.logger import setup_logging
from candlebot.utils.notifier import build_notifier

log = logging.getLogger("candlebot")


def make_engine(cfg: BotConfig, predictor: CandlePredictor | None = None) -> SignalEngine:
    return SignalEngine(cfg.strategy, PatternRecognizer(cfg.technical.sma_fast),
                        TechnicalAnalyzer(cfg.technical, cfg.risk.atr_period), predictor)


def load_predictor(cfg: BotConfig) -> CandlePredictor | None:
    if not cfg.ml.enabled:
        return None
    try:
        return CandlePredictor(cfg.ml.model_path).load()
    except FileNotFoundError:
        log.warning("ML model topilmadi (%s) — avval `python main.py train`. ML o'chirildi.", cfg.ml.model_path)
        return None


def public_feed(cfg: BotConfig) -> MarketDataFeed:
    # Tahlil uchun ochiq (public) mainnet ma'lumoti — testnet'dagi narxlar ko'pincha real emas.
    ex = build_exchange(cfg.exchange.name, testnet=False)
    return MarketDataFeed(ex, cfg.exchange.symbol, cfg.exchange.timeframe)


def get_history(cfg: BotConfig, source: str, days: int, csv_path: str | None, bars: int):
    if source == "synthetic":
        return SyntheticDataFeed(n_bars=bars, timeframe=cfg.exchange.timeframe).df
    if source == "csv":
        return CSVDataFeed(csv_path, cfg.exchange.symbol, cfg.exchange.timeframe).df
    return public_feed(cfg).fetch_history(days)


def train_model(cfg: BotConfig, df) -> CandlePredictor:
    engine = make_engine(cfg)
    enriched = engine.enrich(df)
    cost = 2 * (cfg.risk.fee_rate + cfg.risk.slippage)
    predictor = CandlePredictor(cfg.ml.model_path)
    predictor.train(build_features(enriched), build_labels(enriched, cfg.ml.horizon, cost))
    return predictor


def cmd_backtest(cfg: BotConfig, args) -> None:
    if not args.verbose:
        logging.getLogger("candlebot.execution").setLevel(logging.WARNING)
    df = get_history(cfg, args.source, args.days, args.csv, args.bars)
    log.info("Backtest ma'lumoti: %d shamcha (%s .. %s)", len(df), df.index[0], df.index[-1])
    predictor = None
    if args.ml:
        split = int(len(df) * 0.6)  # birinchi 60% da o'qitish, qolgan 40% da sinov (out-of-sample)
        predictor = train_model(cfg, df.iloc[:split])
        df = df.iloc[split - 210:]
    result = Backtester(make_engine(cfg, predictor), cfg.risk, cfg.paper.initial_quote,
                        cfg.exchange.timeframe).run(df)
    print("\n=== BACKTEST NATIJASI ===")
    print(result.summary())
    if len(result.trades):
        print("\nOxirgi savdolar:")
        print(result.trades.tail(10)[["opened_at", "entry_price", "exit_price", "pnl", "reason"]]
              .to_string(index=False))


def cmd_train(cfg: BotConfig, args) -> None:
    df = get_history(cfg, args.source, args.days, args.csv, args.bars)
    predictor = train_model(cfg, df)
    predictor.save()
    print(f"Model saqlandi: {cfg.ml.model_path}\nCV metrikalar: {predictor.metrics}")
    if predictor.metrics.get("roc_auc", 0) < 0.52:
        print("DIQQAT: ROC-AUC ~0.5 — model tasodifiydan yaxshi emas, ML'ni yoqishdan oldin o'ylab ko'ring.")


def cmd_check(cfg: BotConfig, _args) -> None:
    ex = build_exchange(cfg.exchange.name, cfg.mode != "live", cfg.exchange.api_key,
                        cfg.exchange.api_secret, cfg.exchange.api_password)
    broker = CCXTBroker(ex, cfg.exchange.symbol)
    base, quote = broker.balances()
    print(f"Ulanish OK ({ex.urls['api'] if isinstance(ex.urls.get('api'), str) else cfg.exchange.name})")
    print(f"Balans: {base:.8f} {broker.base_ccy}, {quote:.2f} {broker.quote_ccy}")
    print(f"Limitlar: {broker.limits}, taker fee: {broker.taker_fee}")


def build_agent(cfg: BotConfig) -> AITradingAgent:
    tf_sec = ccxt.Exchange.parse_timeframe(cfg.exchange.timeframe)
    memory = DecisionMemory(cfg.ai.memory_file, horizon_seconds=cfg.ai.memory_horizon * tf_sec,
                            cost=2 * (cfg.risk.fee_rate + cfg.risk.slippage))
    return AITradingAgent(cfg.ai, build_llm(cfg.ai.provider, cfg.ai.model), memory)


def build_sentiment(cfg: BotConfig) -> SentimentAnalyzer | None:
    if cfg.ai.enabled:
        # AI agent yangiliklarni doimiy kuzatadi
        cfg.sentiment.enabled = True
        cfg.sentiment.refresh_minutes = min(cfg.sentiment.refresh_minutes, cfg.ai.news_poll_minutes)
    if not cfg.sentiment.enabled:
        return None
    return SentimentAnalyzer(cfg.sentiment, cfg.exchange.symbol.split("/")[0])


def cmd_run(cfg: BotConfig, _args) -> None:
    cfg.validate()
    if cfg.mode == "paper":
        feed = public_feed(cfg)
        broker = PaperBroker(cfg.exchange.symbol, cfg.paper.initial_quote, cfg.risk.fee_rate, cfg.risk.slippage)
    else:
        ex = build_exchange(cfg.exchange.name, cfg.mode == "testnet", cfg.exchange.api_key,
                            cfg.exchange.api_secret, cfg.exchange.api_password)
        broker = CCXTBroker(ex, cfg.exchange.symbol)
        cfg.risk.fee_rate = max(cfg.risk.fee_rate, broker.taker_fee)
        feed = MarketDataFeed(ex, cfg.exchange.symbol, cfg.exchange.timeframe)

    orders = OrderManager(broker, cfg.state_file, cfg.trade_journal)
    equity = broker.equity(feed.last_price())
    log.info("Rejim: %s | AI: %s | boshlang'ich equity: %.2f", cfg.mode.upper(),
             f"{cfg.ai.provider}/{cfg.ai.model} ({cfg.ai.mode})" if cfg.ai.enabled else "o'chiq", equity)

    agent, higher_feeds = None, {}
    if cfg.ai.enabled:
        agent = build_agent(cfg)
        higher_feeds = {tf: MarketDataFeed(feed.exchange, cfg.exchange.symbol, tf)
                        for tf in cfg.ai.higher_timeframes if tf != cfg.exchange.timeframe}
    bot = TradingBot(feed, make_engine(cfg, load_predictor(cfg)), RiskManager(cfg.risk, equity), orders,
                     build_sentiment(cfg), cfg.exchange.history_limit, cfg.loop_interval_sec,
                     agent=agent, higher_feeds=higher_feeds,
                     notifier=build_notifier(cfg.notify.telegram_token, cfg.notify.telegram_chat_id))
    bot.run()


def cmd_ai_test(cfg: BotConfig, args) -> None:
    """Bir martalik: AI'ga yuboriladigan bozor holatini tuzish va (--dry bo'lmasa) qarorini olish."""
    engine = make_engine(cfg, load_predictor(cfg))
    if args.source == "synthetic":
        df, higher = SyntheticDataFeed(n_bars=600, timeframe=cfg.exchange.timeframe).df, {}
    else:
        feed = public_feed(cfg)
        df = feed.fetch_ohlcv(cfg.exchange.history_limit)
        higher = {tf: timeframe_summary(engine.technical.compute(
            MarketDataFeed(feed.exchange, cfg.exchange.symbol, tf).fetch_ohlcv(250)))
            for tf in cfg.ai.higher_timeframes}
    enriched = engine.enrich(df)
    sentiment = build_sentiment(cfg) if args.source != "synthetic" else None
    score = sentiment.get_score() if sentiment else None
    sig = engine.evaluate(enriched, score)

    agent = AITradingAgent(cfg.ai, llm=None, memory=DecisionMemory(cfg.ai.memory_file)) if args.dry \
        else build_agent(cfg)
    snapshot = agent.build_snapshot(enriched, sig, symbol=cfg.exchange.symbol, timeframe=cfg.exchange.timeframe,
                                    equity=cfg.paper.initial_quote, higher_tf=higher,
                                    news=sentiment.headlines() if sentiment else None, sentiment=score)
    print("=== AI'ga yuboriladigan bozor holati ===")
    print(json.dumps(snapshot, ensure_ascii=False, indent=2, default=str))
    print(f"\nKvant signal: {sig}")
    if not args.dry:
        print(f"\n=== AI qarori ===\n{agent.decide(snapshot, sig.action, in_position=False)}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CandleBot — Yaponiya shamchalari savdo boti")
    parser.add_argument("--config", default="config/config.yaml")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("backtest", "train"):
        p = sub.add_parser(name)
        p.add_argument("--source", choices=["synthetic", "exchange", "csv"], default="synthetic")
        p.add_argument("--csv")
        p.add_argument("--days", type=int, default=90)
        p.add_argument("--bars", type=int, default=3000)
        if name == "backtest":
            p.add_argument("--ml", action="store_true", help="walk-forward: 60%% o'qitish, 40%% sinov")
            p.add_argument("--verbose", action="store_true", help="har bir order logini ko'rsatish")
    sub.add_parser("check")
    sub.add_parser("run")
    p = sub.add_parser("ai-test")
    p.add_argument("--source", choices=["synthetic", "exchange"], default="exchange")
    p.add_argument("--dry", action="store_true", help="LLM chaqirmasdan faqat bozor holatini ko'rsatish")
    args = parser.parse_args(argv)

    cfg = load_config(args.config)
    setup_logging(cfg.log_level, "logs/bot.log" if args.command == "run" else None)
    {"backtest": cmd_backtest, "train": cmd_train, "check": cmd_check, "run": cmd_run,
     "ai-test": cmd_ai_test}[args.command](cfg, args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
