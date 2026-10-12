"""Acomptes de reservation : la reference saisie par le client n'est jamais une preuve de paiement."""

from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import NotFoundError
from app.routes import seller as seller_route
from app.schemas.restaurant import RestaurantReservationCreateRequest, RestaurantReservationStatusUpdateRequest
from app.schemas.seller import HotelBookingCreateRequest, HotelBookingStatusUpdateRequest


def _request() -> SimpleNamespace:
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/seller"), headers={})


def _client() -> SimpleNamespace:
    return SimpleNamespace(id="client-1", email="client@example.test")


@pytest.fixture(autouse=True)
def _no_side_effects(monkeypatch):
    monkeypatch.setattr(seller_route, "enforce_csrf", lambda _request: None)
    monkeypatch.setattr(seller_route, "_restaurant_reservation_response", lambda row: row)
    monkeypatch.setattr(seller_route, "_hotel_booking_response", lambda row: row)


def _restaurant_profile(deposit: float) -> SimpleNamespace:
    return SimpleNamespace(
        vendor_id="vendor-1",
        activity_type="restaurant",
        storefront_tier="basic",
        accepts_table_reservations=True,
        deposit_amount=deposit,
    )


def _hotel_profile() -> SimpleNamespace:
    return SimpleNamespace(
        vendor_id="vendor-1",
        activity_type="hotel",
        storefront_tier="premium",
        accepts_hotel_bookings=True,
        offers_transport=False,
        room_types=[{"id": "room-1", "name": "Standard", "night_price": 20000}],
    )


def _db_returning(profile: SimpleNamespace) -> Mock:
    db = Mock()
    db.scalar.return_value = profile
    return db


def _reservation_payload(reference: str | None) -> RestaurantReservationCreateRequest:
    return RestaurantReservationCreateRequest(
        vendor_id="vendor-1",
        customer_name="Client Test",
        customer_phone="+22790000000",
        reservation_at=datetime.now(UTC) + timedelta(days=1),
        guest_count=2,
        deposit_payment_method="nita",
        transaction_reference=reference,
    )


def test_table_reservation_with_declared_reference_stays_pending() -> None:
    reservation = seller_route.create_restaurant_reservation(
        "vendor-1", _reservation_payload("CODE-INVENTE"), _request(), _db_returning(_restaurant_profile(5000)), _client()
    )
    assert reservation.payment_status == "pending"
    assert reservation.transaction_reference == "CODE-INVENTE"


def test_table_reservation_without_deposit_has_nothing_to_pay() -> None:
    reservation = seller_route.create_restaurant_reservation(
        "vendor-1", _reservation_payload(None), _request(), _db_returning(_restaurant_profile(0)), _client()
    )
    assert reservation.payment_status == "paid"


def test_hotel_booking_with_declared_reference_stays_pending() -> None:
    today = date.today()
    booking = seller_route.create_hotel_booking(
        "vendor-1",
        HotelBookingCreateRequest(
            vendor_id="vendor-1",
            room_type_id="room-1",
            guest_name="Client Test",
            guest_phone="+22790000000",
            check_in_date=today + timedelta(days=1),
            check_out_date=today + timedelta(days=3),
            guest_count=1,
            deposit_payment_method="nita",
            transaction_reference="CODE-INVENTE",
        ),
        _request(),
        _db_returning(_hotel_profile()),
        _client(),
    )
    assert booking.deposit_amount == 40000
    assert booking.payment_status == "pending"


@pytest.mark.parametrize(("status", "expected"), [("confirmed", "paid"), ("declined", "pending"), ("pending", "pending")])
def test_seller_confirmation_marks_reservation_deposit_paid(status: str, expected: str) -> None:
    reservation = SimpleNamespace(vendor_id="vendor-1", status="pending", payment_status="pending")
    db = _db_returning(SimpleNamespace(vendor_id="vendor-1"))
    db.get.return_value = reservation

    seller_route.update_restaurant_reservation_status(
        "res-1", RestaurantReservationStatusUpdateRequest(status=status), _request(), db, _client()
    )
    assert reservation.payment_status == expected


@pytest.mark.parametrize(("status", "expected"), [("confirmed", "paid"), ("cancelled", "pending")])
def test_seller_confirmation_marks_hotel_deposit_paid(status: str, expected: str) -> None:
    booking = SimpleNamespace(vendor_id="vendor-1", status="pending", payment_status="pending")
    db = _db_returning(SimpleNamespace(vendor_id="vendor-1"))
    db.get.return_value = booking

    seller_route.update_hotel_booking_status("book-1", HotelBookingStatusUpdateRequest(status=status), _request(), db, _client())
    assert booking.payment_status == expected


def test_other_seller_cannot_confirm_deposit() -> None:
    reservation = SimpleNamespace(vendor_id="vendor-1", status="pending", payment_status="pending")
    db = _db_returning(SimpleNamespace(vendor_id="vendor-AUTRE"))
    db.get.return_value = reservation

    with pytest.raises(NotFoundError):
        seller_route.update_restaurant_reservation_status(
            "res-1", RestaurantReservationStatusUpdateRequest(status="confirmed"), _request(), db, _client()
        )
    assert reservation.payment_status == "pending"
