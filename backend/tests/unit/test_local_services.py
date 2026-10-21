"""Pharmacies de garde et stations-essence : regles metier et parcours complet (base SQLite reelle)."""

from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, ValidationDomainError
from app.database import Base
from app.models.global_settings import GlobalSettings
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.routes import local_services as route
from app.schemas.local_services import FuelStatusSchema, ServiceStatusUpdate
from app.services import local_services as svc


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


def _p(**kw):
    base = dict(service_kind="pharmacy", on_duty=False, duty_start=None, duty_end=None, fuel_status=None,
                fuel_updated_at=None, latitude=None, longitude=None, business_name="Pharmacie du Fleuve",
                address="Rue du marché", city="Niamey")
    return SimpleNamespace(**{**base, **kw})


# ---------------------------------------------------------------- regles

def test_manual_switch_puts_a_pharmacy_on_duty() -> None:
    assert svc.is_on_duty(_p(on_duty=True))
    assert not svc.is_on_duty(_p())
    assert not svc.is_on_duty(_p(service_kind="fuel_station", on_duty=True))


def test_scheduled_period_uses_niamey_time_and_ends_by_itself() -> None:
    profile = _p(duty_start=date(2026, 10, 20), duty_end=date(2026, 10, 27))
    # 23:30 UTC le 27 = 00:30 a Niamey le 28 : la garde est terminee.
    assert svc.is_on_duty(profile, datetime(2026, 10, 27, 22, 30, tzinfo=UTC))
    assert not svc.is_on_duty(profile, datetime(2026, 10, 27, 23, 30, tzinfo=UTC))
    assert not svc.is_on_duty(profile, datetime(2026, 10, 19, 12, 0, tzinfo=UTC))
    assert svc.duty_label(profile, datetime(2026, 10, 21, 12, 0, tzinfo=UTC)) == "De garde jusqu'au 27 oct."


def test_fuel_information_older_than_six_hours_is_not_trusted() -> None:
    now = datetime(2026, 10, 21, 12, 0, tzinfo=UTC)
    fresh = _p(service_kind="fuel_station", fuel_status={"super": "available", "gaz": "out"}, fuel_updated_at=now - timedelta(hours=2))
    stale = _p(service_kind="fuel_station", fuel_status={"super": "available"}, fuel_updated_at=now - timedelta(hours=7))
    assert svc.has_fuel(fresh, "super", now) and not svc.has_fuel(fresh, "gaz", now)
    assert not svc.has_fuel(stale, None, now)
    assert svc.clean_fuel_status({"super": "available", "kerosene": "available", "gaz": "peut-etre"}) == {"super": "available"}


def test_itinerary_opens_google_maps_on_the_exact_position_or_searches_the_address() -> None:
    assert svc.maps_url(_p(latitude=13.5137, longitude=2.1098)) == "https://www.google.com/maps/dir/?api=1&destination=13.513700,2.109800"
    url = svc.maps_url(_p())
    assert url.startswith("https://www.google.com/maps/search/?api=1&query=")
    assert "Pharmacie%20du%20Fleuve" in url and "Niger" in url


def test_delivery_number_only_in_served_cities_and_per_service() -> None:
    settings = SimpleNamespace(pharmacy_delivery_phone="+227 90 00 00 01", fuel_delivery_phone="+227 90 00 00 02")
    assert svc.delivery_phone(_p(city=" NIAMEY "), settings) == "+227 90 00 00 01"
    assert svc.delivery_phone(_p(service_kind="fuel_station"), settings) == "+227 90 00 00 02"
    assert svc.delivery_phone(_p(city="Maradi"), settings) is None
    assert svc.delivery_phone(_p(), SimpleNamespace(pharmacy_delivery_phone="  ", fuel_delivery_phone=None)) is None


def test_position_must_be_in_niger() -> None:
    assert svc.valid_position(13.51, 2.11)  # Niamey
    assert svc.valid_position(16.97, 7.99)  # Agadez
    assert not svc.valid_position(48.85, 2.35)  # Paris
    assert not svc.valid_position(None, 2.1)


# ---------------------------------------------------------------- parcours

@pytest.fixture
def db(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[t.__table__ for t in (User, Vendor, SellerProfile, GlobalSettings)])
    monkeypatch.setattr(route, "cache_get_json", lambda _key: None)
    monkeypatch.setattr(route, "cache_set_json", lambda *_a, **_k: None)
    monkeypatch.setattr(route, "invalidate_services_cache", lambda: None)
    monkeypatch.setattr(route, "enforce_csrf", lambda _request: None)
    monkeypatch.setattr(route, "enforce_rate_limit", lambda *_a, **_k: None)
    with Session(engine) as session:
        session.add(GlobalSettings(pharmacy_delivery_phone="+227 90 00 00 01", fuel_delivery_phone="+227 90 00 00 02"))
        session.commit()
        yield session


def shop(db: Session, uid: str, kind: str | None, city: str = "Niamey", paid: bool = True) -> tuple[User, SellerProfile]:
    user = User(id=uid, email=f"{uid}@test.ne", full_name=uid, hashed_password="x", is_active=True)
    vendor = Vendor(id=f"v-{uid}", name=uid, slug=f"slug-{uid}", is_active=True)
    now = datetime.now(UTC)
    profile = SellerProfile(
        user_id=uid, vendor_id=vendor.id, business_name=f"Commerce {uid}", city=city, service_kind=kind,
        storefront_tier="premium", activity_type="enterprise",
        onboarding_fee_paid_at=now if paid else None, subscription_paid_until=now + timedelta(days=30) if paid else None,
    )
    db.add_all([user, vendor, profile])
    db.commit()
    return user, profile


def test_pharmacy_manager_goes_on_duty_and_appears_first_with_delivery_in_niamey(db: Session) -> None:
    user, _ = shop(db, "pharma-a", "pharmacy")
    shop(db, "pharma-b", "pharmacy", city="Zinder")
    shop(db, "pharma-unpaid", "pharmacy", paid=False)
    shop(db, "boutique", None)

    status = route.update_service_status(ServiceStatusUpdate(on_duty=True), None, db, user)
    assert status.on_duty_now and status.delivery_phone == "+227 90 00 00 01"

    listing = route.list_pharmacies(db, city=None, on_duty=False)
    assert [i.business_name for i in listing.items] == ["Commerce pharma-a", "Commerce pharma-b"]  # garde d'abord, abonnement expire masque
    assert listing.items[0].on_duty and listing.items[1].delivery_phone is None  # Zinder : pas encore de livraison
    assert {c.city for c in listing.cities} == {"Niamey", "Zinder"}
    assert [i.business_name for i in route.list_pharmacies(db, city="niamey", on_duty=True).items] == ["Commerce pharma-a"]


def test_scheduled_duty_validation(db: Session) -> None:
    user, _ = shop(db, "pharma", "pharmacy")
    today = svc.niamey_today()
    with pytest.raises(ValidationDomainError):
        route.update_service_status(ServiceStatusUpdate(duty_start=today, duty_end=today - timedelta(days=1)), None, db, user)
    with pytest.raises(ValidationDomainError):
        route.update_service_status(ServiceStatusUpdate(duty_start=today, duty_end=today + timedelta(days=40)), None, db, user)
    ok = route.update_service_status(ServiceStatusUpdate(duty_start=today, duty_end=today + timedelta(days=6)), None, db, user)
    assert ok.on_duty_now and ok.duty_label and ok.duty_label.startswith("De garde jusqu'au")
    cleared = route.update_service_status(ServiceStatusUpdate(clear_duty_period=True), None, db, user)
    assert not cleared.on_duty_now and cleared.duty_end is None


def test_station_updates_fuel_and_only_fresh_available_stations_are_listed(db: Session) -> None:
    user, profile = shop(db, "station-a", "fuel_station")
    _, other = shop(db, "station-b", "fuel_station")
    other.fuel_status, other.fuel_updated_at = {"super": "available"}, datetime.now(UTC) - timedelta(hours=8)
    db.commit()

    status = route.update_service_status(ServiceStatusUpdate(fuel=FuelStatusSchema(super="available", gaz="out")), None, db, user)
    assert status.fuel.super == "available" and status.fuel.gaz == "out" and status.fuel_fresh
    # Mise a jour partielle : le gaz reste en rupture.
    status = route.update_service_status(ServiceStatusUpdate(fuel=FuelStatusSchema(gasoil="available")), None, db, user)
    assert (status.fuel.super, status.fuel.gasoil, status.fuel.gaz) == ("available", "available", "out")

    available = route.list_stations(db, city=None, fuel="super", available=True)
    assert [i.business_name for i in available.items] == ["Commerce station-a"]  # station-b : information trop ancienne
    assert route.list_stations(db, city=None, fuel="gaz", available=True).items == []
    everything = route.list_stations(db, city=None, fuel=None, available=False)
    assert [i.business_name for i in everything.items] == ["Commerce station-a", "Commerce station-b"]
    assert everything.items[0].delivery_phone == "+227 90 00 00 02"


def test_wrong_service_or_position_is_refused(db: Session) -> None:
    pharma, _ = shop(db, "pharma", "pharmacy")
    station, _ = shop(db, "station", "fuel_station")
    plain, _ = shop(db, "boutique", None)
    with pytest.raises(ForbiddenError):
        route.update_service_status(ServiceStatusUpdate(on_duty=True), None, db, plain)
    with pytest.raises(ValidationDomainError):
        route.update_service_status(ServiceStatusUpdate(fuel=FuelStatusSchema(super="out")), None, db, pharma)
    with pytest.raises(ValidationDomainError):
        route.update_service_status(ServiceStatusUpdate(on_duty=True), None, db, station)
    with pytest.raises(ValidationDomainError):
        route.update_service_status(ServiceStatusUpdate(latitude=48.85, longitude=2.35), None, db, station)
    placed = route.update_service_status(ServiceStatusUpdate(latitude=13.5137, longitude=2.1098), None, db, station)
    assert placed.maps_url.endswith("destination=13.513700,2.109800")
