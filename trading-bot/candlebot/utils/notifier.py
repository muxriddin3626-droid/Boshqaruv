"""Telegram xabarnomalari: bot o'zi savdo qilganda odam nima bo'layotganini bilib turadi."""
from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request

log = logging.getLogger(__name__)


class Notifier:
    def send(self, text: str) -> None:
        log.debug("notify: %s", text)


class TelegramNotifier(Notifier):
    def __init__(self, token: str, chat_id: str, timeout: int = 10):
        self.url = f"https://api.telegram.org/bot{token}/sendMessage"
        self.chat_id, self.timeout = chat_id, timeout

    def send(self, text: str) -> None:
        data = urllib.parse.urlencode({"chat_id": self.chat_id, "text": text[:4000]}).encode()
        try:
            with urllib.request.urlopen(self.url, data=data, timeout=self.timeout) as resp:
                if not json.loads(resp.read()).get("ok"):
                    log.warning("Telegram xabar yuborilmadi")
        except Exception as exc:  # xabarnoma xatosi savdoni to'xtatmasligi kerak
            log.warning("Telegram xatosi: %s", exc)


def build_notifier(token: str, chat_id: str) -> Notifier:
    return TelegramNotifier(token, chat_id) if token and chat_id else Notifier()
