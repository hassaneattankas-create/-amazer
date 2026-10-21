"""Espace livreur : acces reserve, prise en charge unique, confidentialite du client."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import ConflictError, ForbiddenError
from app.routes import courier as route


def _user(user_id: str, role: str = "user", name: str = "Awa Moussa", email: str | None = None):
    return SimpleNamespace(id=user_id, role=role, full_name=name, email=email or f"{user_id}@example.test", whatsapp_phone="+22790000001")


COURIER = _user("courier-1", "courier", "Ibrahim")
OTHER_COURIER = _user("courier-2", "courier", "Sani")


def _order(**overrides):
    values = {
        "id": "order-1",
        "tracking_code": "AMZ-ORDER1",
        "status": "preparation",
        "payment_status": "paid",
        "created_at": datetime.now(UTC),
        "delivery_type": "standard",
        "delivery_district": "Plateau",
        "delivery_address": "Rue 12, porte bleue",
        "delivery_phone": "+22796000000",
        "total_amount": 15000.0,
        "user_id": "client-1",
        "user": _user("client-1", name="Awa Moussa"),
        "items": [SimpleNamespace(vendor_id="v1", product_id="p1", quantity=2)],
        "fulfillments": [],
        "courier_user_id": None,
        "courier_assigned_at": None,
        "delivered_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(route, "enforce_rate_limit", lambda *a, **k: None)
    monkeypatch.setattr(route, "append_audit_log", lambda *a, **k: None)
    monkeypatch.setattr(route, "_notify", lambda *a, **k: None)


def _request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/courier"), headers={})


def _db(order):
    db = Mock()
    db.scalar.return_value = order
    profile = SimpleNamespace(vendor_id="v1", business_name="Boutique Une", address="Grand marché", city="Niamey",
                              whatsapp_contact="+22791111111", payout_phone=None)
    product = SimpleNamespace(id="p1", name="Riz 5 kg")
    db.scalars.side_effect = lambda query: SimpleNamespace(
        all=lambda: [profile] if "seller_profiles" in str(query) else [product]
    )
    return db


@pytest.mark.parametrize("user", [_user("client-1"), _user("seller-1")])
def test_only_couriers_and_admins_access(user) -> None:
    with pytest.raises(ForbiddenError):
        route.get_courier_user(user)
    assert route.get_courier_user(COURIER) is COURIER


def test_available_order_shows_phone_but_hides_address_until_taken() -> None:
    item = route._build(_db(_order()), _order(), COURIER)
    assert item.customer_name == "Awa"  # prenom seulement
    assert item.customer_phone == "+22796000000"
    assert item.delivery_address is None
    assert item.district == "Plateau"
    assert item.pickups[0].shop_name == "Boutique Une"
    assert item.pickups[0].items == ["2 × Riz 5 kg"]


def test_take_order_assigns_courier_and_reveals_contact() -> None:
    order = _order()
    item = route.take_order("order-1", _request(), _db(order), COURIER)
    assert order.courier_user_id == "courier-1"
    assert order.status == "livraison"
    assert item.assigned_to_me is True
    assert item.customer_phone == "+22796000000"
    assert item.delivery_address == "Rue 12, porte bleue"


def test_order_cannot_be_taken_twice() -> None:
    order = _order(courier_user_id="courier-2", status="livraison")
    with pytest.raises(ConflictError):
        route.take_order("order-1", _request(), _db(order), COURIER)
    assert order.courier_user_id == "courier-2"


@pytest.mark.parametrize("overrides", [{"payment_status": "pending"}, {"status": "annulee"}, {"status": "recu"}])
def test_unpaid_or_closed_order_cannot_be_taken(overrides) -> None:
    order = _order(**overrides)
    with pytest.raises(ConflictError):
        route.take_order("order-1", _request(), _db(order), COURIER)
    assert order.courier_user_id is None


def test_only_assigned_courier_marks_delivered() -> None:
    order = _order(courier_user_id="courier-1", status="livraison")
    with pytest.raises(ForbiddenError):
        route.mark_delivered("order-1", _request(), _db(order), OTHER_COURIER)
    route.mark_delivered("order-1", _request(), _db(order), COURIER)
    assert order.status == "recu"
    assert order.delivered_at is not None


def test_release_puts_order_back_for_other_couriers() -> None:
    order = _order(courier_user_id="courier-1", status="livraison", courier_assigned_at=datetime.now(UTC))
    route.release_order("order-1", _request(), _db(order), COURIER)
    assert order.courier_user_id is None
    assert order.status == "preparation"


def test_courier_sees_public_shop_info_but_never_the_payment_number() -> None:
    from datetime import timedelta

    db = _db(_order())
    profile = SimpleNamespace(vendor_id="v1", business_name="Boutique Une", address="Grand marché", city="Niamey", phone=None,
                              whatsapp_contact="+22791111111", payout_phone="+22799999999", opening_hours="8 h – 20 h",
                              latitude=13.5137, longitude=2.1098)
    product = SimpleNamespace(id="p1", name="Riz 5 kg")
    db.scalars.side_effect = lambda query: SimpleNamespace(all=lambda: [profile] if "seller_profiles" in str(query) else [product])
    paid_at = datetime(2026, 10, 21, 10, 0, tzinfo=UTC)
    order = _order(
        fulfillments=[SimpleNamespace(vendor_id="v1", status="livraison")],
        fee_breakdown={"delivery_fee": 1500},
        payment_confirmed_at=paid_at,
        estimated_minutes=180,
        courier_user_id=COURIER.id,
    )
    item = route._build(db, order, COURIER)
    pickup = item.pickups[0]
    assert pickup.phone == "+22791111111" and "+22799999999" not in str(item.model_dump())
    assert pickup.maps_url.endswith("destination=13.513700,2.109800")
    assert pickup.opening_hours == "8 h – 20 h" and pickup.status_label == "Prête / remise au livreur"
    assert item.delivery_fee == 1500 and item.deliver_before == paid_at + timedelta(minutes=180)
    assert item.customer_maps_url and "Rue%2012" in item.customer_maps_url
    # Avant la prise en charge, ni adresse ni itineraire client.
    assert route._build(db, _order(), COURIER).customer_maps_url is None
