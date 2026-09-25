"""Broker abstraksiyasi: bir xil interfeys — PaperBroker (simulyatsiya) va CCXTBroker (testnet/live).

Strategiya kodi qaysi broker ishlatilayotganini bilmaydi, shuning uchun paper -> testnet -> live
o'tish faqat konfiguratsiya o'zgarishi bilan amalga oshadi.
"""
from __future__ import annotations

import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

from candlebot.risk.manager import MarketLimits

log = logging.getLogger(__name__)


@dataclass
class Fill:
    order_id: str
    side: str
    amount: float          # sof bazaviy aktiv (buy: komissiyadan keyin qabul qilingan)
    avg_price: float
    quote_amount: float    # buy: sarflangan, sell: olingan (komissiyadan keyin)
    fee_quote: float       # komissiya quote valyutada (taxminiy)


class Broker(ABC):
    symbol: str
    limits: MarketLimits

    @abstractmethod
    def balances(self) -> tuple[float, float]:
        """(base_free, quote_free)"""

    @abstractmethod
    def market_buy(self, amount: float, ref_price: float) -> Fill:
        ...

    @abstractmethod
    def market_sell(self, amount: float, ref_price: float) -> Fill:
        ...

    def equity(self, price: float) -> float:
        base, quote = self.balances()
        return quote + base * price


class PaperBroker(Broker):
    """Komissiya va sirpanishni hisobga oluvchi simulyatsiya."""

    def __init__(self, symbol: str, initial_quote: float, fee_rate: float = 0.001,
                 slippage: float = 0.0005, limits: MarketLimits | None = None):
        self.symbol = symbol
        self.base, self.quote = 0.0, float(initial_quote)
        self.fee_rate, self.slippage = fee_rate, slippage
        self.limits = limits or MarketLimits(min_amount=1e-5, min_cost=5.0, amount_step=1e-5, price_step=0.01)

    def balances(self) -> tuple[float, float]:
        return self.base, self.quote

    def market_buy(self, amount: float, ref_price: float) -> Fill:
        price = ref_price * (1 + self.slippage)
        cost = amount * price
        fee = cost * self.fee_rate
        if cost + fee > self.quote + 1e-9:
            raise ValueError(f"Paper: balans yetarli emas ({cost + fee:.2f} > {self.quote:.2f})")
        self.quote -= cost + fee
        self.base += amount
        return Fill(f"paper-{uuid.uuid4().hex[:10]}", "buy", amount, price, cost + fee, fee)

    def market_sell(self, amount: float, ref_price: float) -> Fill:
        amount = min(amount, self.base)
        price = ref_price * (1 - self.slippage)
        gross = amount * price
        fee = gross * self.fee_rate
        self.base -= amount
        self.quote += gross - fee
        return Fill(f"paper-{uuid.uuid4().hex[:10]}", "sell", amount, price, gross - fee, fee)


class CCXTBroker(Broker):
    """Haqiqiy birja (testnet yoki live) orqali market buyruqlar."""

    def __init__(self, exchange, symbol: str):
        self.exchange = exchange
        self.symbol = symbol
        exchange.load_markets()
        self.market = exchange.market(symbol)
        self.base_ccy, self.quote_ccy = self.market["base"], self.market["quote"]
        self.limits = MarketLimits.from_ccxt_market(self.market, exchange.precisionMode)
        self.taker_fee = float(self.market.get("taker") or 0.001)
        log.info("Bozor %s limitlari: %s, taker fee=%.4f", symbol, self.limits, self.taker_fee)

    def balances(self) -> tuple[float, float]:
        bal = self.exchange.fetch_balance()
        free = bal.get("free", {})
        return float(free.get(self.base_ccy) or 0), float(free.get(self.quote_ccy) or 0)

    def _client_id(self) -> str:
        # Idempotentlik: tarmoq uzilib qayta yuborilsa, birja takroriy buyruqni rad etadi.
        return f"cb{uuid.uuid4().hex[:20]}"

    def _fee_quote(self, order: dict, price: float) -> tuple[float, float]:
        """(komissiya quote'da, bazaviy aktivdan ushlangan komissiya)."""
        fees = order.get("fees") or ([order["fee"]] if order.get("fee") else [])
        fee_quote = fee_base = 0.0
        for f in fees:
            cost = float(f.get("cost") or 0)
            ccy = f.get("currency")
            if ccy == self.quote_ccy:
                fee_quote += cost
            elif ccy == self.base_ccy:
                fee_base += cost
                fee_quote += cost * price
            # boshqa valyuta (masalan BNB) — balansga ta'sir qilmaydi, taxminiy hisoblanmaydi
        return fee_quote, fee_base

    def _execute(self, side: str, amount: float, ref_price: float) -> Fill:
        amount = float(self.exchange.amount_to_precision(self.symbol, amount))
        order = self.exchange.create_order(self.symbol, "market", side, amount,
                                           params={"newClientOrderId": self._client_id()})
        if order.get("status") != "closed" or not order.get("average"):
            order = self.exchange.fetch_order(order["id"], self.symbol)
        filled = float(order.get("filled") or amount)
        avg = float(order.get("average") or order.get("price") or ref_price)
        fee_quote, fee_base = self._fee_quote(order, avg)
        cost = float(order.get("cost") or filled * avg)
        if side == "buy":
            fill = Fill(order["id"], side, filled - fee_base, avg, cost + fee_quote - fee_base * avg, fee_quote)
        else:
            fill = Fill(order["id"], side, filled, avg, cost - fee_quote, fee_quote)
        log.info("Order %s %s %.8f @ %.2f (fee≈%.4f %s)", order["id"], side.upper(), fill.amount,
                 avg, fee_quote, self.quote_ccy)
        return fill

    def market_buy(self, amount: float, ref_price: float) -> Fill:
        return self._execute("buy", amount, ref_price)

    def market_sell(self, amount: float, ref_price: float) -> Fill:
        base_free, _ = self.balances()
        return self._execute("sell", min(amount, base_free), ref_price)
