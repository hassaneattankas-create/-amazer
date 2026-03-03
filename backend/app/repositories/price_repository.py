from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.price_history import PriceHistory
from app.models.product import Price


class PriceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_price_with_vendor(self, price_id: str) -> Price | None:
        stmt = (
            select(Price)
            .where(Price.id == price_id)
            .options(selectinload(Price.vendor), selectinload(Price.history_entries))
        )
        return self.db.scalar(stmt)

    def add_history(
        self,
        *,
        price_id: str,
        previous_amount: float,
        new_amount: float,
        previous_stock_quantity: int,
        new_stock_quantity: int,
        reason: str | None,
    ) -> PriceHistory:
        history = PriceHistory(
            price_id=price_id,
            previous_amount=previous_amount,
            new_amount=new_amount,
            previous_stock_quantity=previous_stock_quantity,
            new_stock_quantity=new_stock_quantity,
            reason=reason,
        )
        self.db.add(history)
        self.db.flush()
        return history
