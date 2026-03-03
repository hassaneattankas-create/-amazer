from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RankingBreakdown:
    price_competitiveness: float
    stock_signal: float
    text_relevance: float
    vendor_signal: float
    score_total: float


class RankingService:
    PRICE_WEIGHT = 0.40
    STOCK_WEIGHT = 0.20
    TEXT_WEIGHT = 0.25
    VENDOR_WEIGHT = 0.15

    def score_offer(
        self,
        *,
        amount: float,
        min_amount: float,
        max_amount: float,
        stock_quantity: int,
        text_relevance: float,
        vendor_is_active: bool,
    ) -> RankingBreakdown:
        if max_amount == min_amount:
            price_competitiveness = 1.0
        else:
            price_competitiveness = 1.0 - ((amount - min_amount) / (max_amount - min_amount))
        price_competitiveness = max(0.0, min(1.0, price_competitiveness))

        stock_signal = max(0.0, min(1.0, stock_quantity / 100.0))
        normalized_text = max(0.0, min(1.0, text_relevance))
        vendor_signal = 1.0 if vendor_is_active else 0.2

        score_total = (
            (price_competitiveness * self.PRICE_WEIGHT)
            + (stock_signal * self.STOCK_WEIGHT)
            + (normalized_text * self.TEXT_WEIGHT)
            + (vendor_signal * self.VENDOR_WEIGHT)
        )
        return RankingBreakdown(
            price_competitiveness=round(price_competitiveness, 6),
            stock_signal=round(stock_signal, 6),
            text_relevance=round(normalized_text, 6),
            vendor_signal=round(vendor_signal, 6),
            score_total=round(score_total, 6),
        )
