"""Revente sans stock : prix bornes, marge cote serveur, gains, vue client sans marge."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import ValidationDomainError
from app.models.order import OrderItem
from app.routes import orders as orders_route
from app.routes import resellers as route

PRICE = SimpleNamespace(id="price-1", amount=10000, vendor_id="v-1", product_id="p-1", stock_quantity=5,
                        is_active=True, product=SimpleNamespace(name="Riz 25 kg", main_image_url=None))


@pytest.mark.parametrize("amount", [9999, 30001])
def test_resale_price_must_stay_between_shop_price_and_three_times(amount) -> None:
    with pytest.raises(ValidationDomainError):
        route._validate_amount(PRICE, amount)


def test_resale_price_within_bounds_is_kept() -> None:
    assert route._validate_amount(PRICE, 11500) == 11500


def test_checkout_uses_listing_only_when_it_matches_the_offer(monkeypatch) -> None:
    monkeypatch.setattr(orders_route, "subscription_active", lambda _db, _uid: True)
    listing = SimpleNamespace(id="l-1", price_id="price-1", is_active=True, resale_amount=11500, reseller_user_id="r-1")
    db = Mock()
    db.get.return_value = listing
    assert orders_route._resolve_reseller_listing(db, "l-1", PRICE) is listing
    other_offer = SimpleNamespace(**{**PRICE.__dict__, "id": "price-2"})
    assert orders_route._resolve_reseller_listing(db, "l-1", other_offer) is None
    listing.is_active = False
    assert orders_route._resolve_reseller_listing(db, "l-1", PRICE) is None
    assert orders_route._resolve_reseller_listing(db, None, PRICE) is None


def test_customer_pays_shop_price_plus_margin_shop_keeps_its_price() -> None:
    item = OrderItem(product_id="p-1", vendor_id="v-1", quantity=2, unit_price=10000, reseller_margin=3000)
    assert item.unit_price == 10000  # la boutique est payee a son prix
    assert item.customer_unit_price == 11500  # le client paie le prix du revendeur


def test_earnings_split_delivered_and_pending() -> None:
    db = Mock()
    db.execute.return_value.all.return_value = [("o-1", "recu", 3000.0), ("o-2", "preparation", 1500.0), ("o-3", "CLAIMED", 500.0)]
    result = route.compute_earnings(db, "r-1")
    assert (result.earned, result.pending, result.orders_delivered, result.orders_pending) == (3500.0, 1500.0, 2, 1)


def test_public_shop_never_exposes_shop_price_or_margin() -> None:
    fields = set(route.PublicListing.model_fields)
    assert "supplier_amount" not in fields and "margin" not in fields and "price" in fields


def test_expired_reseller_subscription_falls_back_to_shop_price(monkeypatch) -> None:
    monkeypatch.setattr(orders_route, "subscription_active", lambda _db, _uid: False)
    listing = SimpleNamespace(id="l-1", price_id="price-1", is_active=True, resale_amount=11500, reseller_user_id="r-1")
    db = Mock()
    db.get.return_value = listing
    assert orders_route._resolve_reseller_listing(db, "l-1", PRICE) is None


def test_seller_cannot_resell_own_product(monkeypatch) -> None:
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(route, "enforce_rate_limit", lambda *a, **k: None)
    db = Mock()
    db.scalar.side_effect = [PRICE, "v-1"]  # l'offre, puis la boutique du demandeur
    with pytest.raises(ValidationDomainError):
        route.create_listing(route.ListingCreateRequest(price_id="price-1", resale_amount=12000), Mock(), db, SimpleNamespace(id="u-1"))
