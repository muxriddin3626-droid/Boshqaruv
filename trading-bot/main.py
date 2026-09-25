"""CandleBot CLI.

    python main.py backtest [--source synthetic|exchange|csv] [--ml]
    python main.py train    [--days 120]
    python main.py check                 # testnet ulanishi va balansni tekshirish
    python main.py run                   # config.mode bo'yicha: paper | testnet | live
"""
from __future__ import annotations

import argparse
import logging
import sys

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
    log.info("Rejim: %s | boshlang'ich equity: %.2f", cfg.mode.upper(), equity)
    sentiment = SentimentAnalyzer(cfg.sentiment, cfg.exchange.symbol.split("/")[0]) if cfg.sentiment.enabled else None
    bot = TradingBot(feed, make_engine(cfg, load_predictor(cfg)), RiskManager(cfg.risk, equity), orders,
                     sentiment, cfg.exchange.history_limit, cfg.loop_interval_sec)
    bot.run()


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
    args = parser.parse_args(argv)

    cfg = load_config(args.config)
    setup_logging(cfg.log_level, "logs/bot.log" if args.command == "run" else None)
    {"backtest": cmd_backtest, "train": cmd_train, "check": cmd_check, "run": cmd_run}[args.command](cfg, args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
