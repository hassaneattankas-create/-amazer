from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationDomainError
from app.models.product import Price
from app.repositories.price_repository import PriceRepository


class PriceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.prices = PriceRepository(db)

    def update_offer(
        self,
        *,
        price_id: str,
        new_amount: float,
        new_stock_quantity: int,
        reason: str | None = None,
    ) -> Price:
        if new_amount <= 0:
            raise ValidationDomainError("Price amount must be greater than 0")
        if new_stock_quantity < 0:
            raise ValidationDomainError("Stock quantity cannot be negative")

        price = self.prices.get_price_with_vendor(price_id)
        if price is None:
            raise NotFoundError("Price not found")
        if not price.vendor.is_active:
            raise ValidationDomainError("Vendor is inactive")

        previous_amount = price.amount
        previous_stock_quantity = price.stock_quantity

        price.amount = new_amount
        price.stock_quantity = new_stock_quantity
        self.db.add(price)

        self.prices.add_history(
            price_id=price.id,
            previous_amount=previous_amount,
            new_amount=new_amount,
            previous_stock_quantity=previous_stock_quantity,
            new_stock_quantity=new_stock_quantity,
            reason=reason,
        )
        self.db.commit()
        self.db.refresh(price)
        return price
