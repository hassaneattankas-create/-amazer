"""Moderation : un produit masque par l'admin ne peut pas etre reaffiche par le vendeur."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.deps import get_admin_user
from app.core.exceptions import ConflictError, UnauthorizedError
from app.routes import admin_moderation as route
from app.routes import seller as seller_route
from app.schemas.seller import SellerInventoryUpdateRequest


def _price(**overrides) -> SimpleNamespace:
    values = {
        "id": "price-1",
        "vendor_id": "vendor-1",
        "product_id": "product-1",
        "product": SimpleNamespace(id="product-1", name="Telephone", brand="X", description=None, main_image_url=None,
                                   category_id=None, images=[], specs={}),
        "vendor": SimpleNamespace(name="Boutique Une"),
        "amount": 10000.0,
        "stock_quantity": 4,
        "is_active": True,
        "hidden_by_admin": False,
        "currency": "XOF",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(route, "append_audit_log", lambda *a, **k: None)
    monkeypatch.setattr(route, "cache_delete_prefixes", lambda *a: None)
    sent: list[dict] = []
    monkeypatch.setattr(route, "NotificationService", lambda _db: SimpleNamespace(send_to_user=lambda **k: sent.append(k)))
    return sent


def _request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/admin/moderation"), headers={})


def test_moderation_routes_require_admin() -> None:
    with pytest.raises(UnauthorizedError):
        get_admin_user(SimpleNamespace(id="u", email="u@example.test", role="user"), Mock())


def test_admin_hides_product_and_seller_is_notified(_isolate) -> None:
    price = _price()
    db = Mock()
    db.get.return_value = price
    db.scalar.return_value = "seller-user-1"
    admin = SimpleNamespace(id="admin-1", email="a@example.test", role="admin")

    item = route.set_product_visibility("price-1", route.ProductVisibilityRequest(visible=False, reason="Contrefacon"), _request(), db, admin)

    assert price.is_active is False and price.hidden_by_admin is True
    assert item.hidden_by_admin is True
    assert _isolate[0]["user_id"] == "seller-user-1"
    assert "Contrefacon" in _isolate[0]["payload"].body


def test_admin_can_show_product_again(_isolate) -> None:
    price = _price(is_active=False, hidden_by_admin=True)
    db = Mock()
    db.get.return_value = price
    route.set_product_visibility("price-1", route.ProductVisibilityRequest(visible=True), _request(), db,
                                 SimpleNamespace(id="admin-1", email="a@example.test", role="admin"))
    assert price.is_active is True and price.hidden_by_admin is False
    assert _isolate == []  # pas de notification au reaffichage


def test_seller_cannot_reactivate_product_hidden_by_admin(monkeypatch) -> None:
    monkeypatch.setattr(seller_route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(seller_route, "append_audit_log", lambda *a, **k: None)
    monkeypatch.setattr(seller_route, "_invalidate_public_marketplace_cache", lambda: None)
    price = _price(is_active=False, hidden_by_admin=True)
    db = Mock()
    db.scalar.return_value = SimpleNamespace(vendor_id="vendor-1")
    db.get.return_value = price

    with pytest.raises(ConflictError, match="moderation|AMAZER"):
        seller_route.update_inventory_item(
            "price-1",
            SellerInventoryUpdateRequest(is_active=True),
            SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/seller/inventory/price-1")),
            db,
            SimpleNamespace(id="seller-1"),
        )
    assert price.is_active is False


def test_reports_list_shows_reason_and_shop(monkeypatch) -> None:
    row = SimpleNamespace(
        id="audit-1",
        created_at=datetime.now(UTC),
        actor_email="client@example.test",
        entity_id="conv-1",
        details={"role": "customer", "reason": "Insultes", "vendor_id": "vendor-1"},
    )
    db = Mock()
    db.scalars.side_effect = [
        SimpleNamespace(all=lambda: [row]),
        SimpleNamespace(all=lambda: [SimpleNamespace(id="vendor-1", name="Boutique Une")]),
    ]
    items = route.list_conversation_reports(db, SimpleNamespace(id="admin-1"), limit=50)
    assert items[0].reason == "Insultes"
    assert items[0].vendor_name == "Boutique Une"
    assert items[0].conversation_id == "conv-1"
