"""Scan du recu client par le livreur a la remise du colis."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import UnauthorizedError
from app.routes import orders as route


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(route, "enforce_rate_limit", lambda *a, **k: None)
    monkeypatch.setattr(route, "decode_receipt_access_token", lambda _t: {"sub": "o-1", "digest": "d"})
    monkeypatch.setattr(route, "receipt_integrity_hash", lambda _p: "d")
    monkeypatch.setattr(route, "_build_receipt_payload", lambda *a: {})
    monkeypatch.setattr(route, "_product_names", lambda *a: {})
    monkeypatch.setattr(route, "sync_fulfillments", lambda _o: None)
    from app.services import order_delivery_service as delivery
    monkeypatch.setattr(delivery, "sync_fulfillments", lambda _o: None)
    monkeypatch.setattr(delivery, "_notify_delivery", lambda *a: None)


def _call(user, order):
    db = Mock()
    db.scalar.side_effect = [None, order]  # pas de profil vendeur, puis la commande
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/x"))
    payload = SimpleNamespace(token="t", vendor_id=None, gps=None)
    return route.verify_receipt_scan(payload, request, db, user)


def _order(courier_id):
    return SimpleNamespace(
        id="o-1", status="livraison", items=[], user=None, courier_user_id=courier_id, delivered_at=None
    )


COURIER = SimpleNamespace(id="c-1", role="courier", email="livreur@example.test")


def test_assigned_courier_confirms_delivery_by_scanning() -> None:
    order = _order("c-1")
    result = _call(COURIER, order)
    assert result.status == "claimed"
    assert order.status == "recu" and order.delivered_at is not None


def test_courier_cannot_scan_someone_elses_delivery() -> None:
    with pytest.raises(UnauthorizedError):
        _call(COURIER, _order("c-2"))


def test_regular_client_cannot_scan() -> None:
    with pytest.raises(UnauthorizedError):
        _call(SimpleNamespace(id="u-1", role="user", email="client@example.test"), _order("c-1"))
