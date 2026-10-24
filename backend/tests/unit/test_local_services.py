"""Pharmacies de garde et stations-essence : regles metier et parcours complet (base SQLite reelle)."""

from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError, ValidationDomainError
from app.database import Base
from app.models.fuel_history import FuelStatusChange, StationReport
from app.models.fuel_outlet import FuelOutlet, FuelOutletManager
from app.models.fuel_outlet_stat import FuelOutletDailyStat
from app.models.global_settings import GlobalSettings
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.routes import local_services as route
from app.schemas.local_services import FuelManagerCreate, ManagedFuelUpdate, StationReportCreate, FuelOutletCreate, FuelOutletsBulkUpdate, FuelOutletUpdate, FuelStatusSchema, OutletEvent, ServiceStatusUpdate
from app.services import local_services as svc
from app.services import station_tasks


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


def test_fuel_information_older_than_the_freshness_delay_is_not_trusted() -> None:
    now = datetime(2026, 10, 21, 12, 0, tzinfo=UTC)
    fresh = _p(service_kind="fuel_station", fuel_status={"super": "available", "gaz": "out"}, fuel_updated_at=now - timedelta(hours=2))
    stale = _p(service_kind="fuel_station", fuel_status={"super": "available"}, fuel_updated_at=now - timedelta(hours=5))
    assert svc.has_fuel(fresh, "super", now) and not svc.has_fuel(fresh, "gaz", now)
    assert not svc.has_fuel(stale, None, now)
    # Delai regle par l'admin (6 h) : la meme information reste valable.
    assert svc.has_fuel(stale, None, now, svc.fresh_hours(SimpleNamespace(fuel_fresh_hours=6)))
    assert svc.fresh_hours(None) == 4 and svc.fresh_hours(SimpleNamespace(fuel_fresh_hours=0)) == 4
    # Stock faible : il en reste, la station est utile.
    low = _p(service_kind="fuel_station", fuel_status={"gasoil": "low"}, fuel_updated_at=now)
    assert svc.has_fuel(low, "gasoil", now)


def test_history_keeps_only_real_changes() -> None:
    assert svc.fuel_changes({"super": "available", "gaz": "out"}, {"super": "available", "gaz": "low", "gasoil": "out"}) == [
        ("gasoil", None, "out"),
        ("gaz", "out", "low"),
    ]
    assert svc.fuel_changes({"super": "out"}, {"super": "out"}) == []
    assert svc.clean_fuel_status({"super": "available", "kerosene": "available", "gaz": "peut-etre"}) == {"super": "available"}


def test_itinerary_opens_google_maps_on_the_exact_position_or_searches_the_address() -> None:
    assert svc.maps_url(_p(latitude=13.5137, longitude=2.1098)) == "https://www.google.com/maps/dir/?api=1&destination=13.513700,2.109800"
    url = svc.maps_url(_p())
    assert url.startswith("https://www.google.com/maps/search/?api=1&query=")
    assert "Pharmacie%20du%20Fleuve" in url and "Niger" in url


def test_delivery_number_only_in_served_cities_and_per_service() -> None:
    settings = SimpleNamespace(pharmacy_delivery_phone="+227 90 00 00 01", fuel_delivery_phone="+227 90 00 00 02")
    assert svc.delivery_phone(_p(city=" NIAMEY "), settings) == "+227 90 00 00 01"
    gas = _p(service_kind="fuel_station", fuel_status={"gaz": "available"}, fuel_updated_at=datetime.now(UTC))
    assert svc.delivery_phone(gas, settings) == "+227 90 00 00 02"
    # Stations : seul le gaz se livre (pas de numero sans gaz disponible et recent).
    assert svc.delivery_phone(_p(service_kind="fuel_station", fuel_status={"gaz": "out", "super": "available"}, fuel_updated_at=datetime.now(UTC)), settings) is None
    assert svc.delivery_phone(_p(service_kind="fuel_station", fuel_status={"gaz": "available"}, fuel_updated_at=datetime.now(UTC) - timedelta(hours=8)), settings) is None
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
    Base.metadata.create_all(engine, tables=[t.__table__ for t in (User, Vendor, SellerProfile, GlobalSettings, FuelOutlet, FuelOutletDailyStat, FuelStatusChange, StationReport, FuelOutletManager)])
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
    assert everything.items[0].delivery_phone is None  # gaz en rupture : pas de livraison
    route.update_service_status(ServiceStatusUpdate(fuel=FuelStatusSchema(gaz="available")), None, db, user)
    assert route.list_stations(db, city=None, fuel="gaz", available=True).items[0].delivery_phone == "+227 90 00 00 02"


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


def test_admin_chooses_the_delivered_cities() -> None:
    assert svc.parse_cities(" Niamey, maradi ;Zinder,, niamey ") == ["Niamey", "maradi", "Zinder"]
    settings = SimpleNamespace(pharmacy_delivery_phone="+227 90 00 00 01", fuel_delivery_phone=None, local_delivery_cities="Niamey, Maradi")
    assert svc.delivery_phone(_p(city="MARADI"), settings) == "+227 90 00 00 01"
    assert svc.delivery_phone(_p(city="Tahoua"), settings) is None
    assert svc.delivery_cities(SimpleNamespace(local_delivery_cities="  ")) == ["Niamey"]



def test_brand_lists_each_outlet_with_its_own_city_fuel_and_gas_delivery(db: Session) -> None:
    user, _ = shop(db, "oriba", "fuel_station")
    plateau = route.create_outlet(FuelOutletCreate(name="Plateau", city="Niamey", address="Avenue de la Mairie"), None, db, user)
    maradi = route.create_outlet(FuelOutletCreate(name="Route de Zinder", city="Maradi"), None, db, user)
    route.update_outlet(plateau.id, FuelOutletUpdate(fuel=FuelStatusSchema(super="available", gaz="available")), None, db, user)
    route.update_outlet(maradi.id, FuelOutletUpdate(fuel=FuelStatusSchema(gaz="available")), None, db, user)

    listing = route.list_stations(db, city=None, fuel=None, available=False)
    names = sorted(i.business_name for i in listing.items)
    assert names == ["Commerce oriba · Plateau", "Commerce oriba · Route de Zinder"]
    by_name = {i.business_name: i for i in listing.items}
    assert by_name["Commerce oriba · Plateau"].delivery_phone == "+227 90 00 00 02"  # Niamey + gaz
    assert by_name["Commerce oriba · Route de Zinder"].delivery_phone is None  # Maradi pas encore livree
    assert {c.city for c in listing.cities} == {"Niamey", "Maradi"}
    assert [i.city for i in route.list_stations(db, city="maradi", fuel=None, available=False).items] == ["Maradi"]

    # Un point de vente ferme disparait de la liste publique.
    route.update_outlet(maradi.id, FuelOutletUpdate(is_active=False), None, db, user)
    assert len(route.list_stations(db, city=None, fuel=None, available=False).items) == 1


def test_only_the_brand_manages_its_outlets(db: Session) -> None:
    owner, _ = shop(db, "oriba", "fuel_station")
    other, _ = shop(db, "autre", "fuel_station")
    pharma, _ = shop(db, "pharma", "pharmacy")
    outlet = route.create_outlet(FuelOutletCreate(name="Plateau", city="Niamey"), None, db, owner)
    with pytest.raises(NotFoundError):
        route.update_outlet(outlet.id, FuelOutletUpdate(fuel=FuelStatusSchema(gaz="out")), None, db, other)
    with pytest.raises(ForbiddenError):
        route.create_outlet(FuelOutletCreate(name="Kouara", city="Niamey"), None, db, pharma)
    with pytest.raises(ValidationDomainError):
        route.update_outlet(outlet.id, FuelOutletUpdate(latitude=48.8, longitude=2.3), None, db, owner)
    route.delete_outlet(outlet.id, None, db, owner)
    assert route.list_my_outlets(db, owner) == []


# ---------------------------------------------------------------- prix du reseau

def test_network_price_includes_three_stations_then_degressive_and_capped_by_the_national_flat() -> None:
    from app.services.fuel_network_pricing import price_for

    settings = SimpleNamespace(fuel_included_outlets=3, fuel_tier1_price=2000, fuel_tier2_price=1500, fuel_tier3_price=1000, fuel_network_flat=50000)
    assert price_for(settings, 15000, 3).total == 15000  # 3 stations incluses
    p5 = price_for(settings, 15000, 5)
    assert (p5.extra, p5.total, p5.next_station_price) == (4000, 19000, 2000)
    p12 = price_for(settings, 15000, 12)  # 7 x 2000 + 2 x 1500
    assert p12.total == 15000 + 14000 + 3000
    big = price_for(settings, 15000, 60)
    assert big.capped and big.total == 50000 and big.next_station_price == 0  # forfait national : stations illimitees
    no_cap = price_for(SimpleNamespace(**{**settings.__dict__, "fuel_network_flat": 0}), 15000, 40)
    assert not no_cap.capped and no_cap.total == 15000 + 7 * 2000 + 20 * 1500 + 10 * 1000


def test_brand_subscription_follows_its_stations_unless_a_price_was_negotiated(db: Session) -> None:
    from app.services.seller_finance_service import build_effective_seller_finance_settings

    user, profile = shop(db, "oriba", "fuel_station")
    settings = db.query(GlobalSettings).first()
    settings.seller_subscription_fee_premium = 15000
    db.commit()
    for name in ("A", "B", "C", "D", "E"):
        route.create_outlet(FuelOutletCreate(name=f"Station {name}", city="Niamey"), None, db, user)
    assert build_effective_seller_finance_settings(settings, profile).seller_subscription_fee == 19000
    network = route.my_fuel_network(db, user)
    assert (network.stations, network.total, network.next_station_price, network.negotiated) == (5, 19000, 2000, None)
    profile.seller_subscription_fee_override = 12000  # prix negocie
    db.commit()
    assert build_effective_seller_finance_settings(settings, profile).seller_subscription_fee == 12000
    assert route.my_fuel_network(db, user).negotiated == 12000


def test_bulk_update_by_city_and_station_stats(db: Session) -> None:
    user, _ = shop(db, "oriba", "fuel_station")
    a = route.create_outlet(FuelOutletCreate(name="Plateau", city="Niamey"), None, db, user)
    b = route.create_outlet(FuelOutletCreate(name="Centre", city="Maradi"), None, db, user)
    rows = route.bulk_update_outlets(FuelOutletsBulkUpdate(fuel=FuelStatusSchema(gaz="available"), city="niamey"), None, db, user)
    by_id = {r.id: r for r in rows}
    assert by_id[a.id].fuel.gaz == "available" and by_id[b.id].fuel.gaz is None
    with pytest.raises(ValidationDomainError):
        route.bulk_update_outlets(FuelOutletsBulkUpdate(), None, db, user)
    for kind in ("call", "route", "route", "gas"):
        route.record_outlet_event(a.id, OutletEvent(kind=kind), None, db)
    stats = {r.id: (r.calls_30d, r.routes_30d, r.gas_orders_30d) for r in route.list_my_outlets(db, user)}
    assert stats[a.id] == (1, 2, 1) and stats[b.id] == (0, 0, 0)
    assert route.my_fuel_network(db, user).with_gas == 1


def test_station_pricing_follows_admin_settings() -> None:
    """Abonnement des stations et paliers reglables par l'admin."""
    from app.services.fuel_network_pricing import fuel_base_fee, price_for

    settings = SimpleNamespace(
        fuel_included_outlets=2, fuel_tier1_price=1000, fuel_tier2_price=500, fuel_tier3_price=100,
        fuel_network_flat=0, fuel_base_subscription=8000, fuel_tier1_until=4, fuel_tier2_until=6,
    )
    base = fuel_base_fee(settings, 15000)
    assert base == 8000  # prix « stations » regle, pas le Premium
    # 8 stations : 2 incluses, 3e-4e a 1000, 5e-6e a 500, 7e-8e a 100.
    assert price_for(settings, base, 8).total == 8000 + 2 * 1000 + 2 * 500 + 2 * 100
    settings.fuel_base_subscription = 0
    assert fuel_base_fee(settings, 15000) == 15000  # 0 = meme prix que Premium
    # Paliers incoherents : remis dans l'ordre (palier 1 jamais avant les stations incluses).
    settings.fuel_tier1_until, settings.fuel_tier2_until = 1, 1
    # inclus = 2 -> palier 1 = 2 (vide), palier 2 = 3e station, palier 3 au-dela.
    assert price_for(settings, 0, 4).extra == 500 + 100


def test_history_records_changes_and_customers_can_report_a_station(db: Session) -> None:
    user, profile = shop(db, "station-h", "fuel_station")
    route.update_service_status(ServiceStatusUpdate(fuel=FuelStatusSchema(super="available")), None, db, user)
    route.update_service_status(ServiceStatusUpdate(fuel=FuelStatusSchema(super="available")), None, db, user)  # confirmation seule
    route.update_service_status(ServiceStatusUpdate(fuel=FuelStatusSchema(super="low")), None, db, user)
    history = route.my_fuel_history(db, user)
    assert [(h.fuel, h.old_state, h.new_state) for h in history] == [("super", "available", "low"), ("super", None, "available")]
    route.report_station(StationReportCreate(vendor_id=profile.vendor_id, kind="wrong_status", comment="Plus de super"), None, db)
    with pytest.raises(NotFoundError):
        route.report_station(StationReportCreate(vendor_id="inconnu", kind="closed"), None, db)
    reports = route.my_station_reports(db, user)
    assert [(r.kind, r.comment) for r in reports] == [("wrong_status", "Plus de super")]


@pytest.fixture
def sent(monkeypatch):
    calls: list[tuple[str, str, str]] = []
    monkeypatch.setattr(station_tasks, "_notify", lambda _db, user_id, title, body, _tag, href: calls.append((user_id, title, body + " " + href)))
    return calls


def _gerant(db: Session, uid: str) -> User:
    user = User(id=uid, email=f"{uid}@test.ne", full_name=uid.title(), hashed_password="x", is_active=True)
    db.add(user)
    db.commit()
    return user


def test_owner_entrusts_a_station_and_the_manager_only_updates_it(db: Session, sent) -> None:
    owner, profile = shop(db, "brand", "fuel_station")
    plateau = route.create_outlet(FuelOutletCreate(name="Plateau", city="Niamey"), None, db, owner)
    port = route.create_outlet(FuelOutletCreate(name="Port", city="Niamey"), None, db, owner)
    gerant = _gerant(db, "ali")

    with pytest.raises(ValidationDomainError):
        route.add_fuel_manager(FuelManagerCreate(outlet_id=plateau.id, email="inconnu@test.ne"), None, db, owner)
    with pytest.raises(ValidationDomainError):
        route.add_fuel_manager(FuelManagerCreate(outlet_id=plateau.id, email="brand@test.ne"), None, db, owner)
    managers = route.add_fuel_manager(FuelManagerCreate(outlet_id=plateau.id, email="ALI@test.ne"), None, db, owner)
    assert [(m.outlet_name, m.email) for m in managers] == [("Plateau", "ali@test.ne")]
    assert sent and sent[0][0] == "ali" and "/gerant-station" in sent[0][2]

    mine = route.my_managed_outlets(db, gerant)
    assert [(o.name, o.brand_name, o.can_update) for o in mine] == [("Plateau", "Commerce brand", True)]
    updated = route.update_managed_outlet(plateau.id, ManagedFuelUpdate(fuel=FuelStatusSchema(super="low")), None, db, gerant)
    assert updated.fuel.super == "low" and updated.fuel_fresh
    assert db.scalars(select(FuelStatusChange.user_id)).all() == ["ali"]
    # Une autre station de la meme marque : refusee.
    with pytest.raises(NotFoundError):
        route.update_managed_outlet(port.id, ManagedFuelUpdate(fuel=FuelStatusSchema(super="out")), None, db, gerant)
    # Abonnement de la marque expire : mises a jour suspendues.
    profile.subscription_paid_until = datetime.now(UTC) - timedelta(days=1)
    db.commit()
    with pytest.raises(ForbiddenError):
        route.update_managed_outlet(plateau.id, ManagedFuelUpdate(confirm=True), None, db, gerant)
    assert not route.my_managed_outlets(db, gerant)[0].can_update
    # Retire : plus aucun acces.
    route.remove_fuel_manager(managers[0].id, None, db, owner)
    with pytest.raises(NotFoundError):
        route.update_managed_outlet(plateau.id, ManagedFuelUpdate(confirm=True), None, db, gerant)


def test_stale_stations_remind_their_manager_once_then_the_owner(db: Session, sent) -> None:
    owner, _ = shop(db, "brand2", "fuel_station")
    a = route.create_outlet(FuelOutletCreate(name="Liberté", city="Niamey"), None, db, owner)
    b = route.create_outlet(FuelOutletCreate(name="Fleuve", city="Niamey"), None, db, owner)
    _gerant(db, "awa")
    route.add_fuel_manager(FuelManagerCreate(outlet_id=a.id, email="awa@test.ne"), None, db, owner)
    sent.clear()
    now = datetime.now(UTC)
    for outlet in db.scalars(select(FuelOutlet)).all():
        outlet.fuel_status, outlet.fuel_updated_at = {"super": "available"}, now - timedelta(hours=5)
    db.commit()

    assert station_tasks.send_station_reminders(db, now) == 2
    targets = {user_id: body for user_id, _t, body in sent}
    assert "Liberté" in targets["awa"] and "/gerant-station" in targets["awa"]
    assert "Fleuve" in targets["brand2"] and "/seller/dashboard" in targets["brand2"]
    sent.clear()
    assert station_tasks.send_station_reminders(db, now + timedelta(hours=1)) == 0  # deja relancees
    # Nouvelle declaration puis de nouveau perimee : nouvelle relance.
    outlet = db.get(FuelOutlet, a.id)
    outlet.fuel_updated_at = now + timedelta(hours=2)
    db.commit()
    assert station_tasks.send_station_reminders(db, now + timedelta(hours=7)) == 1


def test_monthly_report_counts_last_month_once(db: Session, sent) -> None:
    owner, _ = shop(db, "brand3", "fuel_station")
    outlet = route.create_outlet(FuelOutletCreate(name="Koira", city="Niamey"), None, db, owner)
    db.add_all([
        FuelOutletDailyStat(outlet_id=outlet.id, day=date(2026, 10, 3), calls=4, routes=10, gas_orders=1),
        FuelOutletDailyStat(outlet_id=outlet.id, day=date(2026, 10, 30), calls=1, routes=2, gas_orders=0),
        FuelOutletDailyStat(outlet_id=outlet.id, day=date(2026, 11, 1), calls=9, routes=9, gas_orders=9),
    ])
    db.commit()
    now = datetime(2026, 11, 2, 9, 0, tzinfo=UTC)
    assert station_tasks.send_monthly_reports(db, now) == 1
    _user, title, body = sent[0]
    assert title == "Votre rapport de octobre 2026" and "12 itinéraire(s), 5 appel(s) et 1 commande(s)" in body and "Koira" in body
    assert station_tasks.send_monthly_reports(db, now) == 0
    assert station_tasks.send_monthly_reports(db, datetime(2026, 11, 10, 9, 0, tzinfo=UTC)) == 0
