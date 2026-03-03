from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.price_alert import PriceAlert


class AlertRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_active_for_user_product(self, user_id: str, product_id: str) -> PriceAlert | None:
        stmt = select(PriceAlert).where(
            PriceAlert.user_id == user_id,
            PriceAlert.product_id == product_id,
            PriceAlert.is_active.is_(True),
        )
        return self.db.scalar(stmt)

    def add(self, alert: PriceAlert) -> PriceAlert:
        self.db.add(alert)
        return alert

    def list_active_for_user(self, user_id: str) -> list[PriceAlert]:
        stmt = (
            select(PriceAlert)
            .where(PriceAlert.user_id == user_id, PriceAlert.is_active.is_(True))
            .order_by(PriceAlert.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())
