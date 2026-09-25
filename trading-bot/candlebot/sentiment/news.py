"""4-modul: Yangiliklar va Sentiment tahlili.

Provayderlar (config.sentiment.provider):
* keyword — lug'atga asoslangan, tezkor, bog'liqliksiz (default / fallback)
* finbert — HuggingFace `ProsusAI/finbert` (pip install transformers torch)
* openai  — ChatGPT API (pip install openai, OPENAI_API_KEY)

Natija: [-1, 1] oralig'idagi yagona ball. Yangi xabarlar eski xabarlardan kuchliroq
hisoblanadi (exponential time-decay, half-life soatlarda).
"""
from __future__ import annotations

import json
import logging
import math
import os
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from candlebot.config import SentimentConfig

log = logging.getLogger(__name__)


@dataclass
class NewsItem:
    title: str
    summary: str
    source: str
    published: datetime

    @property
    def text(self) -> str:
        return f"{self.title}. {self.summary}".strip()


class NewsFetcher:
    """RSS lentalaridan yangiliklarni olish (qo'shimcha kutubxonasiz)."""

    def __init__(self, feeds: list[str], timeout: int = 10):
        self.feeds = feeds
        self.timeout = timeout

    def fetch(self) -> list[NewsItem]:
        items: list[NewsItem] = []
        for url in self.feeds:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "CandleBot/1.0"})
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    items.extend(self._parse_rss(resp.read(), url))
            except Exception as exc:  # tarmoq xatosi botni to'xtatmasligi kerak
                log.warning("RSS o'qilmadi %s: %s", url, exc)
        return items

    @staticmethod
    def _parse_rss(payload: bytes, source: str) -> list[NewsItem]:
        root = ET.fromstring(payload)
        out = []
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            desc = re.sub(r"<[^>]+>", " ", item.findtext("description") or "")[:500]
            try:
                published = parsedate_to_datetime(item.findtext("pubDate") or "")
                if published.tzinfo is None:
                    published = published.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                published = datetime.now(timezone.utc)
            out.append(NewsItem(title, desc.strip(), source, published))
        return out


# --------------------------------------------------------------------- models
class SentimentModel(ABC):
    @abstractmethod
    def score_texts(self, texts: list[str]) -> list[float]:
        """Har bir matn uchun [-1, 1] ball."""


class KeywordSentimentModel(SentimentModel):
    POSITIVE = {
        "surge", "rally", "bullish", "soar", "gain", "record", "high", "approval", "approved",
        "adoption", "inflow", "inflows", "breakout", "upgrade", "partnership", "buy", "rises", "jump",
    }
    NEGATIVE = {
        "crash", "plunge", "bearish", "hack", "hacked", "ban", "lawsuit", "sec", "fraud", "sell-off",
        "selloff", "outflow", "outflows", "liquidation", "liquidations", "drop", "falls", "exploit",
        "bankrupt", "bankruptcy", "fear", "dump",
    }

    def score_texts(self, texts: list[str]) -> list[float]:
        scores = []
        for t in texts:
            words = re.findall(r"[a-z\-]+", t.lower())
            pos = sum(w in self.POSITIVE for w in words)
            neg = sum(w in self.NEGATIVE for w in words)
            scores.append(0.0 if pos + neg == 0 else (pos - neg) / (pos + neg))
        return scores


class FinBERTSentimentModel(SentimentModel):
    def __init__(self, model_name: str = "ProsusAI/finbert"):
        from transformers import pipeline  # og'ir import — faqat kerak bo'lganda

        self.pipe = pipeline("text-classification", model=model_name, top_k=None, truncation=True)

    def score_texts(self, texts: list[str]) -> list[float]:
        if not texts:
            return []
        results = self.pipe(texts, batch_size=16)
        scores = []
        for res in results:
            probs = {r["label"].lower(): r["score"] for r in res}
            scores.append(probs.get("positive", 0.0) - probs.get("negative", 0.0))
        return scores


class OpenAISentimentModel(SentimentModel):
    PROMPT = (
        "You are a financial news sentiment analyst for crypto markets. For each numbered headline, "
        "return the expected short-term price impact on {asset} as a number from -1 (very bearish) "
        "to 1 (very bullish). Respond ONLY with JSON: {{\"scores\": [numbers in order]}}."
    )

    def __init__(self, model: str = "gpt-4o-mini", asset: str = "BTC"):
        from openai import OpenAI

        self.client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        self.model, self.asset = model, asset

    def score_texts(self, texts: list[str]) -> list[float]:
        if not texts:
            return []
        numbered = "\n".join(f"{i + 1}. {t[:300]}" for i, t in enumerate(texts))
        resp = self.client.chat.completions.create(
            model=self.model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": self.PROMPT.format(asset=self.asset)},
                      {"role": "user", "content": numbered}],
        )
        scores = json.loads(resp.choices[0].message.content).get("scores", [])
        scores = [max(-1.0, min(1.0, float(s))) for s in scores]
        return (scores + [0.0] * len(texts))[:len(texts)]


def build_model(cfg: SentimentConfig, asset: str) -> SentimentModel:
    try:
        if cfg.provider == "finbert":
            return FinBERTSentimentModel()
        if cfg.provider == "openai":
            return OpenAISentimentModel(cfg.openai_model, asset)
    except Exception as exc:
        log.warning("%s modeli yuklanmadi (%s) — keyword modeliga o'tildi", cfg.provider, exc)
    return KeywordSentimentModel()


# ------------------------------------------------------------------ analyzer
class SentimentAnalyzer:
    """Yangiliklarni doimiy kuzatadi: oladi, filtrlaydi, faqat YANGI xabarlarni baholaydi va saqlaydi."""

    KEEP_HOURS = 48

    def __init__(self, cfg: SentimentConfig, asset: str = "BTC",
                 model: SentimentModel | None = None, fetcher: NewsFetcher | None = None):
        self.cfg = cfg
        self.model = model or build_model(cfg, asset)
        self.fetcher = fetcher or NewsFetcher(cfg.rss_feeds)
        self.keywords = [k.lower() for k in cfg.keywords]
        self.scored: list[tuple[NewsItem, float]] = []
        self._seen: set[str] = set()
        self._last_refresh = 0.0

    def _relevant(self, items: list[NewsItem]) -> list[NewsItem]:
        return [it for it in items if any(k in it.text.lower() for k in self.keywords)]

    def _weighted(self, pairs: list[tuple[NewsItem, float]], now: datetime) -> float:
        num = den = 0.0
        for it, s in pairs:
            age_h = max((now - it.published).total_seconds() / 3600, 0.0)
            w = math.exp(-math.log(2) * age_h / self.cfg.half_life_hours)
            num += w * s
            den += w
        return num / den if den else 0.0

    def aggregate(self, items: list[NewsItem], now: datetime | None = None) -> float:
        """Berilgan xabarlar ro'yxati uchun vaqt bo'yicha tortilgan ball (keshsiz)."""
        relevant = self._relevant(items)
        if not relevant:
            return 0.0
        scores = self.model.score_texts([it.text for it in relevant])
        return self._weighted(list(zip(relevant, scores)), now or datetime.now(timezone.utc))

    def refresh(self) -> list[tuple[NewsItem, float]]:
        """Lentalarni o'qish; faqat oldin ko'rilmagan xabarlarni baholash. Yangi xabarlarni qaytaradi."""
        self._last_refresh = time.time()
        fresh = [it for it in self._relevant(self.fetcher.fetch()) if it.title not in self._seen]
        new = list(zip(fresh, self.model.score_texts([it.text for it in fresh]))) if fresh else []
        self._seen.update(it.title for it in fresh)
        cutoff = datetime.now(timezone.utc).timestamp() - self.KEEP_HOURS * 3600
        self.scored = [(it, sc) for it, sc in self.scored + new if it.published.timestamp() >= cutoff]
        return new

    def poll_new(self) -> list[tuple[NewsItem, float]]:
        """Monitoring: `news_poll_minutes` o'tgan bo'lsa yangi xabarlarni qaytaradi.
        Birinchi o'qish faqat "bazaviy chiziq" — eski xabarlar favqulodda signal bermaydi."""
        first = self._last_refresh == 0.0
        if not first and time.time() - self._last_refresh < self.cfg.refresh_minutes * 60:
            return []
        try:
            new = self.refresh()
        except Exception as exc:
            log.warning("Yangiliklar o'qilmadi: %s", exc)
            return []
        return [] if first else new

    def headlines(self, limit: int = 10) -> list[dict]:
        now = datetime.now(timezone.utc)
        recent = sorted(self.scored, key=lambda p: p[0].published, reverse=True)[:limit]
        return [{"title": it.title[:200], "source": it.source.split("/")[2] if "//" in it.source else it.source,
                 "age_hours": round((now - it.published).total_seconds() / 3600, 1), "sentiment": round(sc, 2)}
                for it, sc in recent]

    def get_score(self) -> float:
        if not self.cfg.enabled:
            return 0.0
        if time.time() - self._last_refresh >= self.cfg.refresh_minutes * 60:
            try:
                self.refresh()
            except Exception as exc:
                log.warning("Sentiment yangilanmadi: %s", exc)
        score = self._weighted(self.scored, datetime.now(timezone.utc))
        log.info("Sentiment ball: %+.3f (%d xabar)", score, len(self.scored))
        return score
