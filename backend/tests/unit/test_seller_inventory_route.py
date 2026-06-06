from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import NotFoundError
from app.routes import seller as seller_route
from app.schemas.seller import SellerInventoryUpdateRequest


def _request() -> SimpleNamespace:
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/seller/inventory/p1"))


def _price(*, vendor_id: str = "vendor-1") -> SimpleNamespace:
    product = SimpleNamespace(
        id="product-1",
        name="Produit Test",
        brand="AMAZER",
        description="Ancienne description",
        main_image_url="https://example.test/old.jpg",
        category_id=None,
        images=[],
        specs={},
    )
    return SimpleNamespace(
        id="price-1",
        product_id=product.id,
        vendor_id=vendor_id,
        product=product,
        amount=1000.0,
        currency="XOF",
        stock_quantity=2,
        is_active=True,
    )


def _db(profile: SimpleNamespace, price: SimpleNamespace) -> Mock:
    db = Mock()
    db.scalar.return_value = profile
    db.get.return_value = price
    return db


def test_update_inventory_updates_name_price_stock_and_description(monkeypatch) -> None:
    monkeypatch.setattr(seller_route, "enforce_csrf", lambda _request: None)
    monkeypatch.setattr(seller_route, "append_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(seller_route, "_invalidate_public_marketplace_cache", lambda: None)
    profile = SimpleNamespace(vendor_id="vendor-1")
    price = _price()
    db = _db(profile, price)

    response = seller_route.update_inventory_item(
        "price-1",
        SellerInventoryUpdateRequest(
            product_name="Nouveau produit",
            amount=1200,
            stock_quantity=5,
            description="Nouvelle description",
        ),
        _request(),
        db,
        SimpleNamespace(id="user-1"),
    )

    assert response.amount == 1200
    assert response.stock_quantity == 5
    assert response.product_name == "Nouveau produit"
    assert response.description == "Nouvelle description"
    assert price.product.name == "Nouveau produit"
    assert price.product.description == "Nouvelle description"
    assert db.add.call_count == 1
    db.commit.assert_called_once()


def test_update_inventory_rejects_other_vendor_item(monkeypatch) -> None:
    monkeypatch.setattr(seller_route, "enforce_csrf", lambda _request: None)
    profile = SimpleNamespace(vendor_id="vendor-1")
    price = _price(vendor_id="vendor-2")
    db = _db(profile, price)

    with pytest.raises(NotFoundError):
        seller_route.update_inventory_item(
            "price-1",
            SellerInventoryUpdateRequest(description="Interdit"),
            _request(),
            db,
            SimpleNamespace(id="user-1"),
        )


def test_update_inventory_description_only_does_not_create_price_history(monkeypatch) -> None:
    monkeypatch.setattr(seller_route, "enforce_csrf", lambda _request: None)
    monkeypatch.setattr(seller_route, "append_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(seller_route, "_invalidate_public_marketplace_cache", lambda: None)
    profile = SimpleNamespace(vendor_id="vendor-1")
    price = _price()
    db = _db(profile, price)

    response = seller_route.update_inventory_item(
        "price-1",
        SellerInventoryUpdateRequest(description="Description seule"),
        _request(),
        db,
        SimpleNamespace(id="user-1"),
    )

    assert response.description == "Description seule"
    db.add.assert_not_called()
    db.commit.assert_called_once()
