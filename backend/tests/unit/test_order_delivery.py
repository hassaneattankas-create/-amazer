"""Livraison confirmee : meme resultat partout, notifications sans doublon."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services import order_delivery_service as svc


@pytest.fixture
def sent(monkeypatch):
    calls: list[tuple[str, str]] = []

    class FakeService:
        def __init__(self, _db):
            pass

        def send_to_user(self, *, user_id, payload):
            calls.append((user_id, payload.data["tag"]))

    monkeypatch.setattr(svc, "NotificationService", FakeService)
    return calls


def _order(**kw):
    fulfillments = [SimpleNamespace(status="livraison"), SimpleNamespace(status="preparation")]
    base = dict(id="o-1", tracking_code="AMZ-1", status="livraison", delivered_at=None, user_id="client",
                courier_user_id="livreur", items=[SimpleNamespace(vendor_id="v-1")], fulfillments=fulfillments)
    return SimpleNamespace(**{**base, **kw})


def _db(sellers=("vendeur",)):
    db = Mock()
    db.scalars.return_value.all.return_value = list(sellers)
    return db


def test_every_part_is_delivered_with_a_date(sent) -> None:
    order = _order()
    assert svc.mark_order_delivered(_db(), order, source="qr_scan") is True
    assert order.status == "recu" and order.delivered_at is not None
    assert all(row.status == "recu" for row in order.fulfillments)


def test_scan_notifies_customer_shop_and_courier(sent) -> None:
    svc.mark_order_delivered(_db(), _order(), source="qr_scan")
    assert {user for user, _tag in sent} == {"client", "vendeur", "livreur"}


def test_actor_is_not_notified_of_their_own_action(sent) -> None:
    svc.mark_order_delivered(_db(), _order(), source="courier")
    assert "livreur" not in {user for user, _ in sent}
    sent.clear()
    svc.mark_order_delivered(_db(), _order(), source="customer")
    assert "client" not in {user for user, _ in sent}


def test_second_confirmation_does_not_notify_again(sent) -> None:
    order = _order()
    svc.mark_order_delivered(_db(), order, source="courier")
    sent.clear()
    assert svc.mark_order_delivered(_db(), order, source="qr_scan") is False
    assert sent == []
