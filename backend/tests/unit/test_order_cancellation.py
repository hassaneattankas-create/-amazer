"""Annulation : le client n'annule que ce qu'il n'a pas paye ; une commande annulee est figee."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import ConflictError
from app.routes import orders as orders_route
from app.schemas.order import PaymentConfirmRequest
from app.services.order_cancellation_service import CANCELLED_STATUS, cancel_order


def _order(**overrides) -> SimpleNamespace:
    values = {
        "id": "order-1",
        "user_id": "client-1",
        "status": "payment_pending",
        "payment_status": "pending",
        "payment_mode": "nita",
        "items": [SimpleNamespace(product_id="p1", vendor_id="v1", quantity=2)],
        "fulfillments": [SimpleNamespace(vendor_id="v1", status="commande")],
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.parametrize("status", ["payment_pending", "commande"])
def test_customer_cancels_unpaid_order_without_touching_stock(status) -> None:
    order = _order(status=status)
    db = Mock()
    assert cancel_order(db, order, by_admin=False) is False
    assert order.status == CANCELLED_STATUS
    assert order.fulfillments[0].status == CANCELLED_STATUS
    db.scalar.assert_not_called()  # le stock n'avait pas ete pris


def test_customer_cannot_cancel_paid_order() -> None:
    order = _order(status="commande", payment_status="paid")
    with pytest.raises(ConflictError, match="support"):
        cancel_order(Mock(), order, by_admin=False)
    assert order.status == "commande"


def test_customer_cannot_cancel_order_in_preparation() -> None:
    with pytest.raises(ConflictError):
        cancel_order(Mock(), _order(status="preparation"), by_admin=False)


def test_admin_cancels_paid_order_and_restocks() -> None:
    price = SimpleNamespace(stock_quantity=3)
    db = Mock()
    db.scalar.return_value = price
    order = _order(status="preparation", payment_status="paid")

    assert cancel_order(db, order, by_admin=True) is True
    assert price.stock_quantity == 5
    assert order.status == CANCELLED_STATUS


@pytest.mark.parametrize("status", ["recu", "CLAIMED", CANCELLED_STATUS])
def test_delivered_or_cancelled_order_cannot_be_cancelled(status) -> None:
    with pytest.raises(ConflictError):
        cancel_order(Mock(), _order(status=status, payment_status="paid"), by_admin=True)


def test_cancelled_order_can_no_longer_be_paid(monkeypatch) -> None:
    monkeypatch.setattr(orders_route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(orders_route, "enforce_rate_limit", lambda *a, **k: None)
    order = _order(status=CANCELLED_STATUS, transaction_code_hash=None, payment_reference="PAY-1")
    db = Mock()
    db.scalar.return_value = order
    admin = SimpleNamespace(id="admin-1", email=orders_route.settings.admin_email, role="admin")
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/x"), headers={})

    with pytest.raises(ConflictError):
        orders_route.confirm_order_payment("order-1", PaymentConfirmRequest(provider_reference="NITA-1234"), request, db, admin)
    assert order.payment_status == "pending"


def test_customer_cancel_route_rejects_other_users_order(monkeypatch) -> None:
    monkeypatch.setattr(orders_route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(orders_route, "enforce_rate_limit", lambda *a, **k: None)
    order = _order()
    db = Mock()
    db.scalar.return_value = order
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/x"), headers={})
    from app.core.exceptions import ValidationDomainError

    with pytest.raises(ValidationDomainError):
        orders_route.client_cancel_order("order-1", request, db, SimpleNamespace(id="intrus", email="i@example.test"))
    assert order.status == "payment_pending"
