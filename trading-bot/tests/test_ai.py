import json
from datetime import datetime, timezone

import pytest

from candlebot.ai.agent import AIDecision, AITradingAgent
from candlebot.ai.llm import LLMClient, extract_json
from candlebot.ai.memory import DecisionMemory
from candlebot.analysis.technical import TechnicalAnalyzer
from candlebot.config import AIConfig, BotConfig, SentimentConfig
from candlebot.core.trader import TradingBot
from candlebot.data.ingestion import SyntheticDataFeed
from candlebot.execution.brokers import PaperBroker
from candlebot.execution.order_manager import OrderManager
from candlebot.patterns.candlestick import PatternRecognizer
from candlebot.risk.manager import RiskManager
from candlebot.sentiment.news import KeywordSentimentModel, NewsItem, SentimentAnalyzer
from candlebot.strategy.signal_engine import SignalEngine
from candlebot.utils.notifier import Notifier


class FakeLLM(LLMClient):
    """Oddiy bozorda BUY, favqulodda yangilik so'ralganda SELL qaytaradi."""

    def __init__(self, reply=None):
        self.reply = reply
        self.prompts = []

    def complete_json(self, system, user):
        self.prompts.append(json.loads(user))
        if self.reply is not None:
            if isinstance(self.reply, Exception):
                raise self.reply
            return self.reply
        if "breaking_news" in self.prompts[-1]:
            return {"action": "SELL", "confidence": 0.8, "reasoning": "Birja buzib kirildi — chiqamiz"}
        return {"action": "BUY", "confidence": 0.9, "reasoning": "Support'dan bullish engulfing", "risks": ["x"]}


class FakeFetcher:
    def __init__(self):
        self.items = []

    def fetch(self):
        return list(self.items)


class ListNotifier(Notifier):
    def __init__(self):
        self.sent = []

    def send(self, text):
        self.sent.append(text)


def test_extract_json_handles_code_fences():
    assert extract_json('Mana:\n```json\n{"action": "HOLD", "confidence": 0.3}\n```') == \
        {"action": "HOLD", "confidence": 0.3}


def test_agent_enforces_rules():
    agent = AITradingAgent(AIConfig(min_confidence_buy=0.7), FakeLLM())
    assert agent.decide({}, "HOLD", in_position=False).action == "BUY"
    assert agent.decide({}, "HOLD", in_position=True).action == "HOLD"      # allaqachon pozitsiyada
    agent.llm = FakeLLM({"action": "BUY", "confidence": 0.5, "reasoning": "?"})
    assert agent.decide({}, "HOLD", in_position=False).action == "HOLD"     # ishonch past
    agent.llm = FakeLLM({"action": "SELL", "confidence": 0.9, "reasoning": "?"})
    assert agent.decide({}, "HOLD", in_position=False).action == "HOLD"     # sotadigan narsa yo'q
    agent.llm = FakeLLM({"action": "YOLO", "confidence": 1})
    d = agent.decide({}, "BUY", in_position=False)
    assert d.source == "fallback" and d.action == "BUY"                      # kvant signalga qaytish


def test_llm_failure_without_fallback_holds():
    agent = AITradingAgent(AIConfig(fallback_to_quant=False), FakeLLM(TimeoutError("timeout")))
    d = agent.decide({}, "BUY", in_position=False)
    assert d.action == "HOLD" and d.source == "fallback"


def test_daily_call_budget():
    llm = FakeLLM()
    agent = AITradingAgent(AIConfig(max_calls_per_day=2, fallback_to_quant=False), llm)
    for _ in range(3):
        d = agent.decide({}, "HOLD", in_position=False)
    assert len(llm.prompts) == 2 and d.source == "fallback"


def test_confirm_mode_requires_agreement():
    agent = AITradingAgent(AIConfig(mode="confirm"), FakeLLM())
    buy = AIDecision("BUY", 0.9, "")
    assert agent.combine("HOLD", buy) == "HOLD"
    assert agent.combine("BUY", buy) == "BUY"
    assert agent.combine("SELL", AIDecision("HOLD", 0.9, "")) == "SELL"
    assert AITradingAgent(AIConfig(mode="decider"), FakeLLM()).combine("HOLD", buy) == "BUY"


def test_memory_scores_decisions_and_persists(tmp_path):
    path = tmp_path / "mem.jsonl"
    mem = DecisionMemory(path, horizon_seconds=3600, cost=0.003)
    t0 = 1_700_000_000
    mem.add(t0, 100.0, "BUY", 0.8, "yaxshi ko'rinadi")
    mem.add(t0, 100.0, "SELL", 0.7, "tushadi")
    assert mem.resolve(t0 + 1800, 95.0) == 0          # muddat hali kelmagan
    assert mem.resolve(t0 + 3600, 95.0) == 2
    assert mem.stats()["BUY"]["accuracy"] == 0 and mem.stats()["SELL"]["accuracy"] == 1
    assert "BUY" in mem.lessons()[0]
    assert DecisionMemory(path).stats() == mem.stats()  # qayta ishga tushgandan keyin ham


def _bot(tmp_path, llm):
    cfg = BotConfig()
    cfg.ai = AIConfig(enabled=True, ask_threshold=0.0, news_alert_threshold=0.4)
    feed = SyntheticDataFeed(600, seed=5)
    engine = SignalEngine(cfg.strategy, PatternRecognizer(), TechnicalAnalyzer(cfg.technical))
    broker = PaperBroker(feed.symbol, 10_000, cfg.risk.fee_rate, cfg.risk.slippage)
    fetcher = FakeFetcher()
    sentiment = SentimentAnalyzer(SentimentConfig(enabled=True, refresh_minutes=0), model=KeywordSentimentModel(),
                                  fetcher=fetcher)
    agent = AITradingAgent(cfg.ai, llm, DecisionMemory(tmp_path / "mem.jsonl"))
    notifier = ListNotifier()
    bot = TradingBot(feed, engine, RiskManager(cfg.risk, 10_000), OrderManager(broker), sentiment,
                     agent=agent, higher_feeds={"1h": SyntheticDataFeed(300, seed=6, timeframe="1h")},
                     notifier=notifier)
    return bot, fetcher, notifier


def test_bot_trades_with_ai_and_exits_on_breaking_news(tmp_path):
    llm = FakeLLM()
    bot, fetcher, notifier = _bot(tmp_path, llm)

    bot.run_once()
    assert bot.orders.position is not None, "AI BUY qarori pozitsiya ochishi kerak edi"
    snap = llm.prompts[0]
    assert snap["higher_timeframes"]["1h"]["trend"] in {"up", "down"}
    assert len(snap["candles_oldest_to_newest"]) == 24 and snap["account"]["position"] is None
    assert any("LONG" in m for m in notifier.sent)

    fetcher.items.append(NewsItem("Bitcoin exchange hacked, crash fears", "", "https://x.com/rss",
                                  datetime.now(timezone.utc)))
    bot.run_once()  # yangi shamcha yo'q, lekin yangilik monitoringi ishlaydi
    assert bot.orders.position is None
    assert bot.orders.trades[-1]["reason"] == "AI_NEWS_EXIT"
    assert "breaking_news" in llm.prompts[-1]


def test_bot_does_not_ask_ai_in_quiet_market(tmp_path):
    llm = FakeLLM()
    bot, _, _ = _bot(tmp_path, llm)
    bot.agent.cfg.ask_threshold = 2.0  # hech qachon yetib bo'lmaydi
    bot.run_once()
    assert llm.prompts == [] and bot.orders.position is None


def test_ai_config_validation(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    cfg = BotConfig()
    cfg.ai.enabled = True
    with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
        cfg.validate()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    cfg.validate()
