"""Parcours transport sur une vraie base : recherche toutes compagnies, places, report et commission."""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.database import Base
from app.models.global_settings import GlobalSettings
from app.models.hospitality import HotelBooking, TransportCommissionPayment
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.services import transport_pricing, transport_service


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[t.__table__ for t in (User, Vendor, SellerProfile, GlobalSettings, HotelBooking, TransportCommissionPayment)])
    with Session(engine) as session:
        session.add(GlobalSettings())
        session.commit()
        yield session


def company(db: Session, uid: str, trips: list[dict], paid: bool = True, mode: str = "subscription") -> SellerProfile:
    now = datetime.now(UTC)
    db.add(User(id=uid, email=f"{uid}@test.ne", full_name=uid, hashed_password="x", is_active=True))
    db.add(Vendor(id=f"v-{uid}", name=uid, slug=f"slug-{uid}", is_active=True))
    profile = SellerProfile(
        user_id=uid, vendor_id=f"v-{uid}", business_name=f"Compagnie {uid}", city="Niamey",
        storefront_tier="premium", activity_type="enterprise", offers_transport=True, accepts_hotel_bookings=True,
        onboarding_fee_paid_at=now if paid else None, subscription_paid_until=now + timedelta(days=30) if paid else None,
        room_types=trips, billing_mode=mode,
    )
    db.add(profile)
    db.commit()
    return profile


def book(db: Session, profile: SellerProfile, trip: dict, day: date, time: str, seats: int, status: str = "confirmed") -> None:
    db.add(HotelBooking(
        vendor_id=profile.vendor_id, room_type_id=trip["id"], room_snapshot=trip, guest_name="Awa", guest_phone="90000000",
        check_in_date=day, check_out_date=day + timedelta(days=1), guest_count=seats, deposit_payment_method="nita",
        deposit_amount=trip["night_price"] * seats, status=status, departure_time=time,
    ))
    db.commit()


def test_search_compares_companies_cheapest_first_with_seats_left(db: Session) -> None:
    day = date.today() + timedelta(days=3)
    diffa = {"id": "t1", "name": "Niamey - Diffa", "stops": ["Dosso", "Maradi", "Zinder"], "night_price": 18000, "capacity": 50, "departure_times": ["06:00", "12:00"]}
    zinder = {"id": "t2", "name": "Niamey → Zinder", "night_price": 15000, "capacity": 30, "departure_times": ["07:00"]}
    a = company(db, "rapide", [diffa])
    company(db, "eco", [zinder])
    company(db, "impaye", [dict(zinder, id="t3")], paid=False)
    book(db, a, diffa, day, "06:00", 48)

    rows = transport_service.search_trips(db, "niamey", "Zinder", day)
    assert [row["company"] for row in rows] == ["Compagnie eco", "Compagnie rapide"]  # moins cher d'abord, impayé masqué
    rapide = rows[1]
    assert rapide["board_city"] == "Niamey" and rapide["alight_city"] == "Zinder"
    assert rapide["departures"] == [{"time": "06:00", "seats_left": 2}, {"time": "12:00", "seats_left": 50}]
    assert transport_service.search_trips(db, "Zinder", "Niamey", day) == []


def test_commission_counts_confirmed_tickets_only(db: Session) -> None:
    day = date.today() + timedelta(days=2)
    trip = {"id": "t1", "name": "Niamey - Maradi", "night_price": 10000, "capacity": 40, "departure_times": ["06:00"]}
    profile = company(db, "comm", [trip], mode="commission")
    book(db, profile, trip, day, "06:00", 3)
    book(db, profile, trip, day, "06:00", 2, status="pending")
    settings = db.query(GlobalSettings).one()
    assert transport_pricing.subscription_fee(settings, profile) == 0
    assert transport_pricing.commission_percent(settings, profile) == 8


def test_admin_report_and_collection(db: Session, monkeypatch) -> None:
    from types import SimpleNamespace

    from app.routes import admin_finance as route
    from app.schemas.finance import AdminSellerBillingRequest, TransportCommissionPaymentRequest

    monkeypatch.setattr(route, "_require_finance_pin", lambda *_a, **_k: None)
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(route, "append_audit_log", lambda *_a, **_k: None)
    monkeypatch.setattr(route, "_invalidate_public_marketplace_cache", lambda: None)
    request = SimpleNamespace(client=None, url=SimpleNamespace(path="/test"), cookies={})
    admin = SimpleNamespace(id="admin")
    day = date.today().replace(day=1) + timedelta(days=27)
    month = day.strftime("%Y-%m")
    trip = {"id": "t1", "name": "Niamey - Tahoua", "night_price": 12000, "capacity": 40, "departure_times": ["06:00"]}
    profile = company(db, "rimbo", [trip])

    switched = route.set_seller_billing(profile.id, AdminSellerBillingRequest(billing_mode="both", ticket_commission_percent=5), request, db, admin)
    assert switched.billing_mode == "both" and switched.effective_ticket_commission_percent == 5
    book(db, profile, trip, day, "06:00", 10)

    report = route.transport_commissions(request, db, admin, month)
    assert report.rows[0].sales == 120000 and report.rows[0].commission == 6000 and report.rows[0].to_collect == 6000
    after = route.record_transport_commission(
        profile.vendor_id, TransportCommissionPaymentRequest(month=month, amount=6000, reference="NITA-1"), request, db, admin
    )
    assert after.rows[0].to_collect == 0 and after.total_to_collect == 0
