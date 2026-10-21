"""Suivi admin des commandes : pas de livraison sans paiement, reference Nita visible pour validation."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.crypto import encrypt_payment_code
from app.core.exceptions import ValidationDomainError
from app.routes import admin_finance as route
from app.schemas.finance import AdminOrderStatusUpdateRequest


def _order(**kw):
    base = dict(
        id="o-1", status="commande", payment_status="pending", payment_mode="nita", total_amount=20500.0, tracking_code="AMZ-1",
        created_at=datetime.now(UTC), transaction_code=None, delivery_district="Plateau", items=[SimpleNamespace(quantity=2)],
        user=SimpleNamespace(full_name="Awa Moussa"), fulfillments=[],
    )
    return SimpleNamespace(**{**base, **kw})


@pytest.fixture
def request_stub(monkeypatch):
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(route, "_require_finance_pin", lambda *_a, **_k: None)
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/admin/finance/orders"))


@pytest.mark.parametrize("target", ["livraison", "recu"])
def test_unpaid_order_cannot_be_sent_or_marked_delivered(request_stub, target) -> None:
    db = Mock()
    db.get.return_value = _order()
    with pytest.raises(ValidationDomainError):
        route.dispatch_order_to_delivery("o-1", AdminOrderStatusUpdateRequest(status=target), request_stub, db, SimpleNamespace(id="admin"))
    db.commit.assert_not_called()


def test_client_reference_shown_only_while_payment_is_pending() -> None:
    pending = _order(transaction_code=encrypt_payment_code("NITA-778899"))
    assert route._client_reference(pending) == "NITA-778899"
    assert route._client_reference(_order(payment_status="paid", transaction_code=encrypt_payment_code("NITA-1"))) is None
    assert route._client_reference(_order(transaction_code="illisible")) is None


def test_restaurant_nita_orders_reach_the_admin_with_client_reference() -> None:
    row = SimpleNamespace(
        id="r-1", vendor_id="v-r", customer_name="Hadiza", status="commande", payment_mode="nita", total_amount=4500.0,
        payment_reference="RST-1", created_at=datetime.now(UTC), payment_status="pending",
        transaction_code=encrypt_payment_code("NITA-55"), items=[SimpleNamespace(quantity=2), SimpleNamespace(quantity=1)],
    )
    db = Mock()
    results = iter([[row], [SimpleNamespace(vendor_id="v-r", business_name="Chez Mariama")]])
    db.scalars.side_effect = lambda _q: SimpleNamespace(all=lambda: next(results))
    [item] = route._restaurant_orders_for_admin(db, 40)
    assert (item.kind, item.place_name, item.client_reference, item.item_count, item.payment_status) == (
        "restaurant", "Chez Mariama", "NITA-55", 3, "pending")
