"""AI qarorlari xotirasi: har bir qaror va uning keyingi natijasi (o'z xatolaridan o'rganish).

Har bir qaror `horizon_seconds` (masalan 4 × 15m) o'tgach baholanadi. Vaqt belgisi ishlatiladi,
shuning uchun bot qayta ishga tushsa ham xotira to'g'ri ishlaydi:
* BUY  to'g'ri, agar narx xarajatlardan ko'proq o'sgan bo'lsa
* SELL to'g'ri, agar narx xarajatlardan ko'proq tushgan bo'lsa
* HOLD baholanmaydi (aks holda statistika "hech narsa qilmaslik"ka og'ib ketadi)
Oxirgi xato qarorlar keyingi promptga "saboq" sifatida beriladi.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)


class DecisionMemory:
    def __init__(self, path: str | Path | None = None, horizon_seconds: int = 3600, cost: float = 0.003,
                 max_records: int = 2000):
        self.path = Path(path) if path else None
        self.horizon, self.cost, self.max_records = horizon_seconds, cost, max_records
        self.records: list[dict] = []
        if self.path and self.path.exists():
            for line in self.path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    self.records.append(json.loads(line))
            self.records = self.records[-max_records:]

    def add(self, bar_time: int, price: float, action: str, confidence: float, reasoning: str) -> None:
        ts = datetime.fromtimestamp(bar_time, timezone.utc).strftime("%Y-%m-%d %H:%M")
        self.records.append({"bar_time": int(bar_time), "ts": ts, "price": price, "action": action,
                             "confidence": round(confidence, 3), "reasoning": reasoning[:300],
                             "outcome": None, "correct": None})
        self.records = self.records[-self.max_records:]
        self._save()

    def resolve(self, bar_time: int, price: float) -> int:
        """Muddati kelgan qarorlarni baholash. Baholanganlar sonini qaytaradi."""
        n = 0
        for r in self.records:
            if r["outcome"] is not None or bar_time - r["bar_time"] < self.horizon:
                continue
            ret = price / r["price"] - 1
            r["outcome"] = round(ret, 5)
            if r["action"] == "BUY":
                r["correct"] = ret > self.cost
            elif r["action"] == "SELL":
                r["correct"] = ret < -self.cost
            n += 1
        if n:
            self._save()
        return n

    def stats(self) -> dict:
        out = {}
        for action in ("BUY", "SELL"):
            judged = [r for r in self.records if r["action"] == action and r["correct"] is not None]
            if judged:
                out[action] = {"count": len(judged),
                               "accuracy": round(sum(r["correct"] for r in judged) / len(judged), 3),
                               "avg_return": round(sum(r["outcome"] for r in judged) / len(judged), 5)}
        return out

    def lessons(self, n: int = 5) -> list[str]:
        wrong = [r for r in self.records if r["correct"] is False][-n:]
        return [f"{r['ts']}: {r['action']} (ishonch {r['confidence']}) -> natija {r['outcome']:+.2%}. "
                f"Sabab edi: {r['reasoning'][:150]}" for r in wrong]

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in self.records) + "\n",
                       encoding="utf-8")
        tmp.replace(self.path)
