"""Notifications automatiques du parcours de commande."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services import order_event_notifications as events


@pytest.fixture
def sent(monkeypatch):
    calls: list[tuple[str, str, str]] = []

    class FakeService:
        def __init__(self, _db):
            pass

        def send_to_user(self, *, user_id, payload):
            calls.append((user_id, payload.title, payload.data["tag"]))

    monkeypatch.setattr(events, "NotificationService", FakeService)
    return calls


def _order(**kw):
    base = dict(id="o-1", user_id="client", tracking_code="AMZ-1", total_amount=5000, payment_status="paid",
                delivery_type="standard", delivery_district="Plateau")
    return SimpleNamespace(**{**base, **kw})


def test_payment_confirmed_reaches_customer_and_every_courier(sent) -> None:
    db = Mock()
    db.scalars.return_value.all.return_value = ["courier-1", "courier-2"]
    events.notify_order_paid(db, _order())
    assert sent[0] == ("client", "Paiement confirmé", "order-o-1-paid")
    assert [row[0] for row in sent[1:]] == ["courier-1", "courier-2"]
    assert "Plateau" not in sent[1][1]  # le quartier est dans le message, pas le titre


def test_restaurant_payment_does_not_alert_couriers(sent) -> None:
    events.notify_order_paid(Mock(), _order(), couriers=False)
    assert [row[0] for row in sent] == ["client"]


def test_each_status_has_its_own_subject(sent) -> None:
    for status in ("preparation", "livraison", "recu", "statut-inconnu"):
        events.notify_order_status(Mock(), _order(), status)
    assert [row[2] for row in sent] == ["order-o-1-preparation", "order-o-1-livraison", "order-o-1-recu"]


def test_notification_failure_never_breaks_the_order(monkeypatch) -> None:
    db = Mock()
    db.scalars.side_effect = RuntimeError("base indisponible")
    monkeypatch.setattr(events, "NotificationService", Mock(side_effect=RuntimeError("panne")))
    assert events.notify_order_paid(db, _order()) is None  # aucune exception remontee
