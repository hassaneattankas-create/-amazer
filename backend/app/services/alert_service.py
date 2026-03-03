from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.price_alert import PriceAlert
from app.models.product import Price
from app.repositories.alert_repository import AlertRepository
from app.repositories.product_repository import ProductRepository


class AlertService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.alerts = AlertRepository(db)
        self.products = ProductRepository(db)

    def create_or_update_alert(self, *, user_id: str, product_id: str, target_price: float) -> PriceAlert:
        product = self.products.get_by_id(product_id)
        if product is None:
            raise NotFoundError("Product not found")

        currency = self._resolve_currency(product.prices)
        existing = self.alerts.get_active_for_user_product(user_id, product_id)

        if existing is not None:
            existing.target_price = target_price
            existing.currency = currency
            self.db.add(existing)
            self.db.commit()
            self.db.refresh(existing)
            return existing

        created = PriceAlert(
            user_id=user_id,
            product_id=product_id,
            target_price=target_price,
            currency=currency,
            is_active=True,
        )
        self.alerts.add(created)
        self.db.commit()
        self.db.refresh(created)
        return created

    def list_active_alerts(self, user_id: str) -> list[PriceAlert]:
        return self.alerts.list_active_for_user(user_id)

    def _resolve_currency(self, prices: list[Price]) -> str:
        active_prices = [price for price in prices if price.is_active]
        if not active_prices:
            return "EUR"
        best_price = min(active_prices, key=lambda price: price.amount)
        return best_price.currency or "EUR"
