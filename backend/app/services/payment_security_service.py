from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import payment_code_hash
from app.models.order import Order
from app.models.restaurant import RestaurantOrder


def verify_payment_code(db: Session, code: str) -> bool:
    digest = payment_code_hash(code)
    exists_order = db.scalar(select(Order.id).where(Order.transaction_code_hash == digest))
    if exists_order:
        return False
    exists_restaurant_order = db.scalar(
        select(RestaurantOrder.id).where(RestaurantOrder.transaction_code_hash == digest)
    )
    return exists_restaurant_order is None
