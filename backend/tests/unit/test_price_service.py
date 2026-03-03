from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import NotFoundError, ValidationDomainError
from app.services.price_service import PriceService


def _build_service() -> tuple[PriceService, Mock]:
    db = Mock()
    service = PriceService(db=db)
    service.prices = Mock()
    return service, db


def test_update_offer_creates_history() -> None:
    service, db = _build_service()
    price = SimpleNamespace(
        id="price-1",
        amount=10.0,
        stock_quantity=2,
        vendor=SimpleNamespace(is_active=True),
    )
    service.prices.get_price_with_vendor.return_value = price

    updated = service.update_offer(
        price_id="price-1",
        new_amount=12.5,
        new_stock_quantity=5,
        reason="manual update",
    )

    assert updated.amount == 12.5
    assert updated.stock_quantity == 5
    service.prices.add_history.assert_called_once()
    db.commit.assert_called_once()


def test_update_offer_validates_business_rules() -> None:
    service, _ = _build_service()
    with pytest.raises(ValidationDomainError):
        service.update_offer(price_id="price-1", new_amount=0, new_stock_quantity=1)

    with pytest.raises(ValidationDomainError):
        service.update_offer(price_id="price-1", new_amount=10, new_stock_quantity=-1)


def test_update_offer_raises_not_found() -> None:
    service, _ = _build_service()
    service.prices.get_price_with_vendor.return_value = None

    with pytest.raises(NotFoundError):
        service.update_offer(price_id="missing", new_amount=10, new_stock_quantity=1)
