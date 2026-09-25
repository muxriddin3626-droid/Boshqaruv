"""LLM mijozlari: bir xil interfeys — OpenAI (ChatGPT) va Anthropic (Claude).

Har bir mijoz `complete_json(system, user)` -> dict qaytaradi. Javob JSON bo'lmasa
xato ko'tariladi va agent xavfsiz tomonga (HOLD) o'tadi.
"""
from __future__ import annotations

import json
import logging
import os
import re
from abc import ABC, abstractmethod

log = logging.getLogger(__name__)


def extract_json(text: str) -> dict:
    """Model javobidan birinchi JSON obyektini ajratib olish (```json bloklari bilan ham)."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError(f"LLM javobida JSON topilmadi: {text[:200]}")
        return json.loads(match.group(0))


class LLMClient(ABC):
    name: str = "llm"

    @abstractmethod
    def complete_json(self, system: str, user: str) -> dict:
        ...


class OpenAIClient(LLMClient):
    name = "openai"

    def __init__(self, model: str = "gpt-4o-mini", timeout: float = 60):
        from openai import OpenAI

        self.client = OpenAI(api_key=os.environ["OPENAI_API_KEY"], timeout=timeout)
        self.model = model

    def complete_json(self, system: str, user: str) -> dict:
        resp = self.client.chat.completions.create(
            model=self.model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        return extract_json(resp.choices[0].message.content)


class AnthropicClient(LLMClient):
    name = "anthropic"

    def __init__(self, model: str = "claude-sonnet-5", timeout: float = 60, max_tokens: int = 1500):
        import anthropic

        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"], timeout=timeout)
        self.model, self.max_tokens = model, max_tokens

    def complete_json(self, system: str, user: str) -> dict:
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(block.text for block in resp.content if getattr(block, "type", "") == "text")
        return extract_json(text)


def build_llm(provider: str, model: str) -> LLMClient:
    if provider == "openai":
        return OpenAIClient(model)
    if provider == "anthropic":
        return AnthropicClient(model)
    raise ValueError(f"Noma'lum LLM provayder: {provider} (openai | anthropic)")
