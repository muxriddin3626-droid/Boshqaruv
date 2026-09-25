"""Konfiguratsiyani YAML + .env dan yuklash."""
from __future__ import annotations

import os
from dataclasses import dataclass, field, fields, is_dataclass
from pathlib import Path
from typing import Any

import yaml

try:
    from dotenv import load_dotenv
except ImportError:  # python-dotenv ixtiyoriy
    load_dotenv = None


@dataclass
class ExchangeConfig:
    name: str = "binance"
    symbol: str = "BTC/USDT"
    timeframe: str = "15m"
    history_limit: int = 500
    api_key: str = ""
    api_secret: str = ""
    api_password: str = ""  # OKX kabi birjalar uchun passphrase


@dataclass
class PaperConfig:
    initial_quote: float = 10_000.0


@dataclass
class RiskConfig:
    risk_per_trade: float = 0.01
    max_position_pct: float = 0.25
    atr_period: int = 14
    atr_sl_multiplier: float = 1.5
    reward_risk_ratio: float = 2.0
    breakeven_at_r: float = 1.0
    max_drawdown: float = 0.15
    daily_loss_limit: float = 0.05
    max_open_positions: int = 1
    cooldown_bars: int = 2
    fee_rate: float = 0.001
    slippage: float = 0.0005


@dataclass
class StrategyConfig:
    buy_threshold: float = 0.30
    sell_threshold: float = -0.30
    weights: dict = field(default_factory=lambda: {
        "pattern": 0.30, "technical": 0.35, "sentiment": 0.10, "ml": 0.25,
    })
    min_ml_probability: float = 0.55
    sentiment_veto: float = -0.50


@dataclass
class TechnicalConfig:
    rsi_period: int = 14
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    sma_fast: int = 20
    sma_slow: int = 50
    sr_pivot_window: int = 5
    sr_tolerance: float = 0.004
    sr_lookback: int = 200


@dataclass
class SentimentConfig:
    enabled: bool = False
    provider: str = "keyword"
    openai_model: str = "gpt-4o-mini"
    refresh_minutes: int = 30
    half_life_hours: float = 6.0
    keywords: list = field(default_factory=lambda: ["bitcoin", "btc", "crypto"])
    rss_feeds: list = field(default_factory=list)


@dataclass
class MLConfig:
    enabled: bool = False
    model_path: str = "models/candle_predictor.joblib"
    horizon: int = 3


@dataclass
class BotConfig:
    mode: str = "paper"
    loop_interval_sec: int = 30
    state_file: str = "state/bot_state.json"
    trade_journal: str = "state/trades.csv"
    log_level: str = "INFO"
    exchange: ExchangeConfig = field(default_factory=ExchangeConfig)
    paper: PaperConfig = field(default_factory=PaperConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    strategy: StrategyConfig = field(default_factory=StrategyConfig)
    technical: TechnicalConfig = field(default_factory=TechnicalConfig)
    sentiment: SentimentConfig = field(default_factory=SentimentConfig)
    ml: MLConfig = field(default_factory=MLConfig)

    def validate(self) -> None:
        if self.mode not in {"paper", "testnet", "live"}:
            raise ValueError(f"Noma'lum rejim: {self.mode}")
        if self.mode == "live" and os.getenv("ALLOW_LIVE_TRADING", "").lower() != "yes":
            raise PermissionError(
                "Live savdo bloklangan. Faqat ongli ravishda ALLOW_LIVE_TRADING=yes qo'yib yoqing."
            )
        if self.mode in {"testnet", "live"} and not (self.exchange.api_key and self.exchange.api_secret):
            raise ValueError("testnet/live rejim uchun EXCHANGE_API_KEY va EXCHANGE_API_SECRET kerak (.env)")
        r = self.risk
        if not 0 < r.risk_per_trade <= 0.05:
            raise ValueError("risk_per_trade 0 va 0.05 (5%) oralig'ida bo'lishi kerak")
        if not 0 < r.max_drawdown < 1:
            raise ValueError("max_drawdown 0 va 1 oralig'ida bo'lishi kerak")
        if r.reward_risk_ratio <= 0 or r.atr_sl_multiplier <= 0:
            raise ValueError("reward_risk_ratio va atr_sl_multiplier musbat bo'lishi kerak")


def _merge(dc: Any, data: dict) -> Any:
    """YAML lug'atini dataclass ichiga rekursiv joylash (noma'lum kalitlar e'tiborsiz)."""
    for f in fields(dc):
        if f.name not in data:
            continue
        current = getattr(dc, f.name)
        value = data[f.name]
        if is_dataclass(current) and isinstance(value, dict):
            _merge(current, value)
        else:
            setattr(dc, f.name, value)
    return dc


def load_config(path: str | Path = "config/config.yaml", env_file: str | Path = ".env") -> BotConfig:
    if load_dotenv is not None and Path(env_file).exists():
        load_dotenv(env_file)

    cfg = BotConfig()
    path = Path(path)
    if path.exists():
        with path.open(encoding="utf-8") as fh:
            _merge(cfg, yaml.safe_load(fh) or {})

    # Maxfiy ma'lumotlar faqat muhit o'zgaruvchilaridan olinadi.
    cfg.exchange.api_key = os.getenv("EXCHANGE_API_KEY", cfg.exchange.api_key)
    cfg.exchange.api_secret = os.getenv("EXCHANGE_API_SECRET", cfg.exchange.api_secret)
    cfg.exchange.api_password = os.getenv("EXCHANGE_API_PASSWORD", cfg.exchange.api_password)
    cfg.mode = os.getenv("BOT_MODE", cfg.mode)
    return cfg
