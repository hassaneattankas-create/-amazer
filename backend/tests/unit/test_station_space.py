"""Espace station : chaine proprietaire -> responsable de ville -> gerant (base SQLite reelle)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError, ValidationDomainError
from app.database import Base
from app.models.fuel_activity import FuelActivity, FuelDelivery
from app.models.fuel_history import FuelStatusChange, StationReport
from app.models.fuel_outlet import FuelOutlet, FuelOutletManager, FuelRegionManager
from app.models.fuel_outlet_stat import FuelOutletDailyStat
from app.models.global_settings import GlobalSettings
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.routes import local_services as route
from app.routes import station_space as space
from app.schemas.local_services import (
    FuelManagerCreate,
    FuelOutletCreate,
    FuelOutletsBulkUpdate,
    FuelOutletUpdate,
    FuelStatusSchema,
    ManagedFuelUpdate,
    RegionManagerCreate,
    ReportResolve,
    ServiceStatusUpdate,
    StationInfoUpdate,
    StationReportCreate,
)
from app.schemas.station_space import DeliveryCreate, RegionOutletCreate, RegionOutletUpdate
from app.services import station_access as sa
from app.services import station_tasks


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


TABLES = (
    User, Vendor, SellerProfile, GlobalSettings, FuelOutlet, FuelOutletDailyStat, FuelStatusChange, StationReport,
    FuelOutletManager, FuelRegionManager, FuelActivity, FuelDelivery,
)


@pytest.fixture
def db(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[t.__table__ for t in TABLES])
    for module in (route, space):
        monkeypatch.setattr(module, "invalidate_services_cache", lambda: None)
        monkeypatch.setattr(module, "enforce_csrf", lambda _request: None)
        monkeypatch.setattr(module, "enforce_rate_limit", lambda *_a, **_k: None)
    monkeypatch.setattr(route, "cache_get_json", lambda _key: None)
    monkeypatch.setattr(route, "cache_set_json", lambda *_a, **_k: None)
    with Session(engine) as session:
        session.add(GlobalSettings(fuel_delivery_phone="+227 90 00 00 02"))
        session.commit()
        yield session


@pytest.fixture
def sent(monkeypatch):
    calls: list[tuple[str, str, str]] = []
    monkeypatch.setattr(station_tasks, "_notify", lambda _db, user_id, title, body, _tag, href: calls.append((user_id, title, body + " " + href)))
    return calls


def brand(db: Session, uid: str, paid: bool = True) -> tuple[User, SellerProfile]:
    user = User(id=uid, email=f"{uid}@test.ne", full_name=uid.title(), hashed_password="x", is_active=True)
    vendor = Vendor(id=f"v-{uid}", name=uid, slug=f"slug-{uid}", is_active=True)
    now = datetime.now(UTC)
    profile = SellerProfile(
        user_id=uid, vendor_id=vendor.id, business_name=uid.title(), city="Niamey", service_kind="fuel_station",
        storefront_tier="premium", activity_type="enterprise",
        onboarding_fee_paid_at=now, subscription_paid_until=now + timedelta(days=30) if paid else now - timedelta(days=1),
    )
    db.add_all([user, vendor, profile])
    db.commit()
    return user, profile


def person(db: Session, uid: str) -> User:
    user = User(id=uid, email=f"{uid}@test.ne", full_name=uid.title(), hashed_password="x", is_active=True)
    db.add(user)
    db.commit()
    return user


def outlet_of(db: Session, outlet_id: str) -> FuelOutlet:
    outlet = db.get(FuelOutlet, outlet_id)
    assert outlet is not None
    return outlet


@pytest.fixture
def chain(db: Session, sent):
    """Oriba : responsable de Niamey (chef), gerant de Plateau (ali), une station a Maradi ; une autre marque."""
    owner, profile = brand(db, "oriba")
    plateau = route.create_outlet(FuelOutletCreate(name="Plateau", city="Niamey"), None, db, owner)
    koira = route.create_outlet(FuelOutletCreate(name="Koira", city="Niamey"), None, db, owner)
    maradi = route.create_outlet(FuelOutletCreate(name="Centre", city="Maradi"), None, db, owner)
    chef, ali = person(db, "chef"), person(db, "ali")
    route.add_region_manager(RegionManagerCreate(city="NIAMEY", email="chef@test.ne"), None, db, owner)
    route.add_fuel_manager(FuelManagerCreate(outlet_id=plateau.id, email="ali@test.ne"), None, db, owner)
    rival, _ = brand(db, "rival")
    foreign = route.create_outlet(FuelOutletCreate(name="Ailleurs", city="Niamey"), None, db, rival)
    sent.clear()
    return dict(owner=owner, profile=profile, plateau=plateau, koira=koira, maradi=maradi, chef=chef, ali=ali, rival=rival, foreign=foreign)


# ---------------------------------------------------------------- roles

def test_role_resolution_and_cross_brand_isolation(db: Session, chain) -> None:
    owner, chef, ali, rival = chain["owner"], chain["chef"], chain["ali"], chain["rival"]
    plateau, koira, maradi, foreign = (outlet_of(db, chain[k].id) for k in ("plateau", "koira", "maradi", "foreign"))
    assert sa.station_access(db, owner, plateau) == "owner"
    assert sa.station_access(db, chef, plateau) == "city" and sa.station_access(db, chef, koira) == "city"
    assert sa.station_access(db, chef, maradi) is None
    assert sa.station_access(db, ali, plateau) == "manager" and sa.station_access(db, ali, koira) is None
    assert sa.station_access(db, rival, plateau) is None and sa.station_access(db, owner, foreign) is None
    # Responsable ET gerant de la meme station : le role le plus eleve l'emporte.
    db.add(FuelOutletManager(vendor_id=plateau.vendor_id, outlet_id=plateau.id, user_id=chef.id))
    db.commit()
    assert sa.station_access(db, chef, plateau) == "city"
    # Une station d'une autre marque est « introuvable » partout.
    with pytest.raises(NotFoundError):
        space.update_station_info(foreign.id, StationInfoUpdate(opening_hours="24 h/24"), None, db, owner)
    with pytest.raises(NotFoundError):
        space.station_activity(foreign.id, db, chef)
    with pytest.raises(NotFoundError):
        route.update_managed_outlet(koira.id, ManagedFuelUpdate(confirm=True), None, db, ali)

    me = space.station_space_me(db, chef)
    assert (me.is_owner, me.cities, me.stations) == (False, 1, 1)
    assert space.station_space_me(db, owner).owner_brand == "Oriba"
    listed = {o.name: o.role for o in route.my_managed_outlets(db, ali)}
    assert listed == {"Plateau": "manager"}
    assert {o.name: o.role for o in route.my_managed_outlets(db, chef)} == {"Plateau": "city", "Koira": "city"}


def test_owner_designates_city_managers_before_any_station_and_at_every_tier(db: Session, sent) -> None:
    owner, profile = brand(db, "solo")
    person(db, "awa")
    person(db, "moussa")
    rows = route.add_region_manager(RegionManagerCreate(city="  tillaberi ", email="awa@test.ne"), None, db, owner)
    assert [(r.city, r.stations, r.last_activity_at) for r in rows] == [("Tillabéri", 0, None)]
    assert sent and sent[0][0] == "awa" and "/gerant-station" in sent[0][2]
    rows = route.add_region_manager(RegionManagerCreate(city="birni n'konni", email="moussa@test.ne"), None, db, owner)
    assert {r.city for r in rows} == {"Tillabéri", "Birni N'Konni"}
    with pytest.raises(ValidationDomainError):
        route.add_region_manager(RegionManagerCreate(city="Tillabéri", email="awa@test.ne"), None, db, owner)
    actions = db.scalars(select(FuelActivity.action).where(FuelActivity.vendor_id == profile.vendor_id)).all()
    assert sorted(actions) == ["city_added", "city_added"]
    # La responsable cree la premiere station de sa ville (orthographe de sa ville).
    created = space.region_create_outlet(RegionOutletCreate(vendor_id=profile.vendor_id, city="TILLABERI", name="Route de Niamey"), None, db, db.get(User, "awa"))
    assert created.city == "Tillabéri"
    managers = {r.email: r for r in route.list_region_managers(db, owner)}
    assert managers["awa@test.ne"].last_activity_at is not None and managers["awa@test.ne"].stations == 1
    assert managers["moussa@test.ne"].last_activity_at is None


# ---------------------------------------------------------------- responsable de ville

def test_city_manager_creates_stations_and_names_managers_only_in_their_city(db: Session, chain, sent) -> None:
    owner, chef, profile = chain["owner"], chain["chef"], chain["profile"]
    cities = space.my_region_cities(db, chef)
    assert [(c.brand_name, c.city, c.totals.stations, c.totals.without_manager) for c in cities] == [("Oriba", "Niamey", 2, 1)]
    assert [s.name for s in cities[0].stations] == ["Koira", "Plateau"]
    assert [m.email for m in cities[0].stations[1].managers] == ["ali@test.ne"]

    with pytest.raises(NotFoundError):
        space.region_create_outlet(RegionOutletCreate(vendor_id=profile.vendor_id, city="Maradi", name="Hors zone"), None, db, chef)
    with pytest.raises(NotFoundError):
        space.region_create_outlet(RegionOutletCreate(vendor_id="v-rival", city="Niamey", name="Autre marque"), None, db, chef)
    station = space.region_create_outlet(RegionOutletCreate(vendor_id=profile.vendor_id, city="niamey", name="Yantala", address="Route de Ouallam"), None, db, chef)
    assert (station.city, station.info.address) == ("Niamey", "Route de Ouallam")
    assert sent[-1][0] == owner.id and "Chef a ajouté la station « Yantala » à Niamey." in sent[-1][2]

    person(db, "binta")
    refs = space.region_add_manager(FuelManagerCreate(outlet_id=station.id, email="binta@test.ne"), None, db, chef)
    assert [r.email for r in refs] == ["binta@test.ne"]
    row = db.scalars(select(FuelOutletManager).where(FuelOutletManager.user_id == "binta")).one()
    assert row.assigned_by == chef.id
    assert sent[-1][0] == "binta" and "/gerant-station" in sent[-1][2]
    with pytest.raises(NotFoundError):
        space.region_add_manager(FuelManagerCreate(outlet_id=chain["maradi"].id, email="binta@test.ne"), None, db, chef)
    maradi_manager = route.add_fuel_manager(FuelManagerCreate(outlet_id=chain["maradi"].id, email="binta@test.ne"), None, db, owner)
    other_row = next(m for m in maradi_manager if m.outlet_name == "Centre")
    with pytest.raises(NotFoundError):
        space.region_remove_manager(other_row.id, None, db, chef)
    space.region_remove_manager(row.id, None, db, chef)

    renamed = space.region_update_outlet(station.id, RegionOutletUpdate(name="Yantala Haut", is_active=False), None, db, chef)
    assert (renamed.name, renamed.is_active) == ("Yantala Haut", False)
    with pytest.raises(NotFoundError):
        space.region_update_outlet(chain["maradi"].id, RegionOutletUpdate(is_active=False), None, db, chef)
    space.region_delete_outlet(station.id, None, db, chef)
    assert db.get(FuelOutlet, station.id) is None
    actions = [a.action for a in space.region_activity(db, chef, vendor_id=profile.vendor_id, city="Niamey")]
    for expected in ("outlet_created", "manager_added", "manager_removed", "info", "outlet_closed", "outlet_deleted", "city_added"):
        assert expected in actions
    deleted = next(a for a in space.region_activity(db, chef, vendor_id=profile.vendor_id, city="niamey") if a.action == "outlet_deleted")
    assert (deleted.outlet_id, deleted.outlet_name, deleted.role) == (None, "Yantala Haut", "city")
    with pytest.raises(NotFoundError):
        space.region_activity(db, chef, vendor_id=profile.vendor_id, city="Maradi")


# ---------------------------------------------------------------- gerant

def test_manager_keeps_station_info_position_deliveries_and_reports(db: Session, chain) -> None:
    ali, plateau, koira, profile = chain["ali"], chain["plateau"], chain["koira"], chain["profile"]
    view = space.update_station_info(
        plateau.id,
        StationInfoUpdate(address="Avenue de la Mairie", phone="+227 90 11 22 33", opening_hours="24 h/24", services=["lavage", "gonflage", "lavage"]),
        None, db, ali,
    )
    assert (view.info.opening_hours, view.info.services, view.role) == ("24 h/24", ["lavage", "gonflage"], "manager")
    assert view.info.info_updated_at is not None
    link = "https://www.google.com/maps/place/Station/@13.5,2.1,17z/data=!3m1!4b1!4m6!3m5!8m2!3d13.5137!4d2.1098"
    placed = space.update_station_info(plateau.id, StationInfoUpdate(maps_link=link), None, db, ali)
    assert (placed.info.latitude, placed.info.longitude) == (13.5137, 2.1098)
    assert placed.info.maps_url.endswith("destination=13.513700,2.109800")
    assert sa.parse_maps_link("https://maps.google.com/?q=13.6,2.2") == (13.6, 2.2)
    assert sa.parse_maps_link("13.5137, 2.1098") == (13.5137, 2.1098)
    with pytest.raises(ValidationDomainError, match="Lien sans coordonnées"):
        space.update_station_info(plateau.id, StationInfoUpdate(maps_link="https://maps.app.goo.gl/AbCd123"), None, db, ali)
    with pytest.raises(ValidationDomainError, match="Position introuvable"):
        space.update_station_info(plateau.id, StationInfoUpdate(address="Rue changee", maps_link="48.85, 2.35"), None, db, ali)
    assert outlet_of(db, plateau.id).address == "Avenue de la Mairie"  # rien n'a ete change a moitie
    cleared = space.update_station_info(plateau.id, StationInfoUpdate(phone=""), None, db, ali)
    assert cleared.info.phone is None
    # Le public voit horaires et services.
    item = next(i for i in route.list_stations(db, city=None, fuel=None, available=False).items if i.outlet_id == plateau.id)
    assert (item.opening_hours, item.services) == ("24 h/24", ["lavage", "gonflage"])

    delivery = space.record_station_delivery(plateau.id, DeliveryCreate(fuel="gasoil", liters=15000, reference="123"), None, db, ali)
    assert (delivery.outlet_name, delivery.liters, delivery.recorded_by) == ("Plateau", 15000, "Ali")
    with pytest.raises(ValidationDomainError):
        space.record_station_delivery(plateau.id, DeliveryCreate(fuel="super", liters=10, delivered_at=datetime.now(UTC) + timedelta(hours=2)), None, db, ali)
    with pytest.raises(ValidationDomainError):
        space.record_station_delivery(plateau.id, DeliveryCreate(fuel="super", liters=10, delivered_at=datetime.now(UTC) - timedelta(days=40)), None, db, ali)
    assert [d.id for d in space.station_deliveries(plateau.id, db, ali)] == [delivery.id]
    assert [d.fuel for d in space.my_fuel_deliveries(db, chain["owner"], city="niamey")] == ["gasoil"]
    assert route.my_fuel_dashboard(db, chain["owner"]).deliveries_30d == 1

    route.report_station(StationReportCreate(vendor_id=profile.vendor_id, outlet_id=plateau.id, kind="wrong_status"), None, db)
    route.report_station(StationReportCreate(vendor_id=profile.vendor_id, outlet_id=koira.id, kind="closed"), None, db)
    route.report_station(StationReportCreate(vendor_id=profile.vendor_id, kind="other"), None, db)
    mine = space.station_reports(plateau.id, db, ali)
    assert len(mine) == 1 and route.my_managed_outlets(db, ali)[0].open_reports == 1
    done = space.resolve_station_report(mine[0].id, ReportResolve(resolution="Stock corrige"), None, db, ali)
    assert (done.resolution, done.resolved_by_name) == ("Stock corrige", "Ali") and done.resolved_at
    others = {r.outlet_id: r.id for r in route.my_station_reports(db, chain["owner"])}
    with pytest.raises(NotFoundError):
        space.resolve_station_report(others[koira.id], ReportResolve(), None, db, ali)
    with pytest.raises(NotFoundError):  # retour sur la marque entiere : proprietaire seulement
        space.resolve_station_report(others[None], ReportResolve(), None, db, chain["chef"])
    assert space.owner_resolve_report(others[None], ReportResolve(resolution="Vu"), None, db, chain["owner"]).resolution == "Vu"
    # Station fermee : le responsable de ville peut encore traiter ses retours (rien n'est publie).
    space.region_update_outlet(koira.id, RegionOutletUpdate(is_active=False), None, db, chain["chef"])
    assert space.resolve_station_report(others[koira.id], ReportResolve(resolution="Fermee"), None, db, chain["chef"]).resolution == "Fermee"
    # Une autre station : refusee.
    with pytest.raises(NotFoundError):
        space.update_station_info(koira.id, StationInfoUpdate(opening_hours="6 h - 22 h"), None, db, ali)
    with pytest.raises(NotFoundError):
        space.record_station_delivery(koira.id, DeliveryCreate(fuel="gaz", liters=20), None, db, ali)
    # Mises a jour de disponibilite journalisees.
    route.update_managed_outlet(plateau.id, ManagedFuelUpdate(fuel=FuelStatusSchema(super="out", gaz="available")), None, db, ali)
    route.update_managed_outlet(plateau.id, ManagedFuelUpdate(confirm=True), None, db, ali)
    journal = space.station_activity(plateau.id, db, ali)
    assert journal[0].action in {"fuel", "confirm"}
    fuel_row = next(a for a in journal if a.action == "fuel" and a.role == "manager")
    assert fuel_row.detail == "Super : rupture · Gaz : disponible" and fuel_row.actor_name == "Ali"
    assert {"info", "position", "delivery", "report_resolved", "confirm"} <= {a.action for a in journal}
    assert next(a for a in journal if a.action == "delivery").detail == "Livraison Gasoil 15 000 L (bon 123)"


def test_activity_journal_visibility_per_level(db: Session, chain) -> None:
    owner, chef, ali, profile = chain["owner"], chain["chef"], chain["ali"], chain["profile"]
    plateau, koira, maradi = chain["plateau"], chain["koira"], chain["maradi"]
    route.update_outlet(maradi.id, FuelOutletUpdate(fuel=FuelStatusSchema(gaz="out"), opening_hours="6 h - 23 h"), None, db, owner)
    space.update_station_info(koira.id, StationInfoUpdate(services=["boutique"]), None, db, chef)
    route.update_managed_outlet(plateau.id, ManagedFuelUpdate(fuel=FuelStatusSchema(super="available")), None, db, ali)
    route.bulk_update_outlets(FuelOutletsBulkUpdate(confirm=True, city="Niamey"), None, db, owner)

    everything = space.my_fuel_activity(db, owner, city=None, outlet_id=None, role=None, limit=200)
    assert {a.outlet_name for a in everything if a.outlet_name} >= {"Plateau", "Koira", "Centre"}
    assert {a.role for a in everything} == {"owner", "city", "manager"}
    assert {a.city for a in space.my_fuel_activity(db, owner, city="maradi", outlet_id=None, role=None, limit=200)} == {"Maradi"}
    assert {a.role for a in space.my_fuel_activity(db, owner, city=None, outlet_id=None, role="manager", limit=200)} == {"manager"}
    # Orthographe differente de la meme ville : retrouvee par le filtre SQL.
    db.add(FuelActivity(vendor_id=profile.vendor_id, outlet_name="Plateau", city="NIAMEY ", role="owner", action="info", detail="Ancienne ligne"))
    db.commit()
    city_view = space.region_activity(db, chef, vendor_id=profile.vendor_id, city="Niamey")
    assert "Ancienne ligne" in {a.detail for a in city_view}
    assert all(a.detail != "Ancienne ligne" for a in space.my_fuel_activity(db, owner, city="Maradi", outlet_id=None, role=None, limit=200))
    assert "Centre" not in {a.outlet_name for a in city_view} and {"Plateau", "Koira"} <= {a.outlet_name for a in city_view}
    station_view = space.station_activity(plateau.id, db, ali)
    assert {a.outlet_name for a in station_view} == {"Plateau"}
    # Le journal d'une autre marque n'apparait jamais.
    assert all(a.outlet_name != "Ailleurs" for a in everything)
    board = route.my_fuel_dashboard(db, owner)
    niamey = next(c for c in board.cities if c.city == "Niamey")
    # Koira n'a pas de gerant : comptee « sans gerant » meme si Niamey a un responsable (comme la vue ville).
    assert (niamey.city_managers, niamey.without_manager, board.without_manager) == (["Chef"], 1, 2)
    owner_rows = route.list_my_outlets(db, owner)
    by_name = {o.name: o for o in owner_rows}
    assert [m.email for m in by_name["Plateau"].managers] == ["ali@test.ne"] and by_name["Koira"].info.services == ["boutique"]
    assert by_name["Centre"].info.opening_hours == "6 h - 23 h"


def test_deleting_the_last_station_resets_the_brand_fuel_status(db: Session, sent) -> None:
    owner, profile = brand(db, "seule")
    route.update_service_status(ServiceStatusUpdate(fuel=FuelStatusSchema(super="available")), None, db, owner)
    first = route.create_outlet(FuelOutletCreate(name="Unique", city="Niamey"), None, db, owner)
    second = route.create_outlet(FuelOutletCreate(name="Deuxieme", city="Niamey"), None, db, owner)
    route.delete_outlet(second.id, None, db, owner)
    db.refresh(profile)
    assert profile.fuel_status == {"super": "available"}  # il reste une station
    route.delete_outlet(first.id, None, db, owner)
    db.refresh(profile)
    assert profile.fuel_status is None and profile.fuel_updated_at is None
    assert route.get_service_status(db, owner).fuel.super is None
    names = sorted(a.outlet_name for a in space.my_fuel_activity(db, owner, city=None, outlet_id=None, role=None, limit=200) if a.action == "outlet_deleted")
    assert names == ["Deuxieme", "Unique"]


def test_expired_subscription_suspends_city_and_manager_writes(db: Session, chain) -> None:
    profile, chef, ali, plateau = chain["profile"], chain["chef"], chain["ali"], chain["plateau"]
    # Station fermee : le gerant ne peut plus rien changer, le responsable peut la rouvrir.
    space.region_update_outlet(plateau.id, RegionOutletUpdate(is_active=False), None, db, chef)
    with pytest.raises(ForbiddenError):
        space.update_station_info(plateau.id, StationInfoUpdate(opening_hours="24 h/24"), None, db, ali)
    assert space.region_update_outlet(plateau.id, RegionOutletUpdate(is_active=True), None, db, chef).is_active

    profile.subscription_paid_until = datetime.now(UTC) - timedelta(days=1)
    db.commit()
    assert space.my_region_cities(db, chef)[0].can_update is False
    with pytest.raises(ForbiddenError):
        space.update_station_info(plateau.id, StationInfoUpdate(opening_hours="24 h/24"), None, db, ali)
    with pytest.raises(ForbiddenError):
        space.record_station_delivery(plateau.id, DeliveryCreate(fuel="gaz", liters=50), None, db, ali)
    with pytest.raises(ForbiddenError):
        route.update_managed_outlet(plateau.id, ManagedFuelUpdate(confirm=True), None, db, chef)
    with pytest.raises(ForbiddenError):
        space.region_create_outlet(RegionOutletCreate(vendor_id=profile.vendor_id, city="Niamey", name="Nouvelle"), None, db, chef)
    with pytest.raises(ForbiddenError):
        space.region_update_outlet(plateau.id, RegionOutletUpdate(name="Renommee"), None, db, chef)
    person(db, "neo")
    with pytest.raises(ForbiddenError):
        space.region_add_manager(FuelManagerCreate(outlet_id=plateau.id, email="neo@test.ne"), None, db, chef)
    # Lecture toujours possible.
    assert space.station_deliveries(plateau.id, db, ali) == []


def test_customer_report_notifies_the_manager_then_the_city_then_the_owner(db: Session, sent) -> None:
    owner, profile = brand(db, "alerte")
    plateau = route.create_outlet(FuelOutletCreate(name="Plateau", city="Niamey"), None, db, owner)
    person(db, "ali")
    route.add_fuel_manager(FuelManagerCreate(outlet_id=plateau.id, email="ali@test.ne"), None, db, owner)
    sent.clear()
    route.report_station(StationReportCreate(vendor_id=profile.vendor_id, outlet_id=plateau.id, kind="closed"), None, db)
    assert [(user_id, title) for user_id, title, _body in sent] == [("ali", "Nouveau retour client")]

    koira = route.create_outlet(FuelOutletCreate(name="Koira", city="Maradi"), None, db, owner)
    sent.clear()
    route.report_station(StationReportCreate(vendor_id=profile.vendor_id, outlet_id=koira.id, kind="other"), None, db)
    assert [user_id for user_id, _t, body in sent] == ["alerte"] and "/seller/dashboard" in sent[0][2]


def test_closed_station_refuses_writes_for_everyone_until_reopened(db: Session, sent) -> None:
    owner, _profile = brand(db, "ferme")
    plateau = route.create_outlet(FuelOutletCreate(name="Plateau", city="Niamey"), None, db, owner)
    route.update_outlet(plateau.id, FuelOutletUpdate(is_active=False), None, db, owner)
    with pytest.raises(ForbiddenError):
        space.update_station_info(plateau.id, StationInfoUpdate(opening_hours="24 h/24"), None, db, owner)


# ---------------------------------------------------------------- garde

def test_station_duty_set_by_manager_owner_and_shown_to_public(db: Session, chain) -> None:
    from datetime import date

    from app.services import local_services as svc

    ali, owner, plateau, koira = chain["ali"], chain["owner"], chain["plateau"], chain["koira"]
    today = svc.niamey_today()

    def public(outlet_id: str, on_duty: bool = False):
        items = route.list_stations(db, city=None, fuel=None, available=False, on_duty=on_duty).items
        return next((i for i in items if i.outlet_id == outlet_id), None)

    # Par defaut : pas de garde.
    assert public(plateau.id).on_duty is False
    assert public(plateau.id, on_duty=True) is None

    # Le gerant met sa station de garde sans date de fin.
    view = space.update_station_info(plateau.id, StationInfoUpdate(on_duty=True), None, db, ali)
    assert (view.info.on_duty, view.info.on_duty_now, view.info.duty_until) == (True, True, None)
    item = public(plateau.id, on_duty=True)
    assert item is not None and (item.on_duty, item.duty_label) == (True, "De garde")
    assert public(koira.id, on_duty=True) is None  # filtre : seulement les stations de garde

    # Jusqu'a une date : libelle avec la date.
    until = today + timedelta(days=2)
    view = space.update_station_info(plateau.id, StationInfoUpdate(on_duty=True, duty_until=until), None, db, ali)
    assert view.info.duty_until == until.isoformat()
    assert public(plateau.id).duty_label.startswith("De garde jusqu'au ")

    # Date passee refusee, rien ne change.
    with pytest.raises(ValidationDomainError, match="déjà passée"):
        space.update_station_info(plateau.id, StationInfoUpdate(on_duty=True, duty_until=today - timedelta(days=1)), None, db, ali)
    assert outlet_of(db, plateau.id).duty_until == until
    # Une date sans activer la garde est refusee des la saisie.
    with pytest.raises(ValueError):
        StationInfoUpdate(duty_until=until)

    # Garde finie hier : plus de garde pour le public, meme si on_duty reste enregistre.
    outlet = outlet_of(db, plateau.id)
    outlet.duty_until = date.fromordinal(today.toordinal() - 1)
    db.commit()
    assert public(plateau.id).on_duty is False

    # Le proprietaire arrete la garde depuis son espace ; le journal le note.
    route.update_outlet(plateau.id, FuelOutletUpdate(on_duty=False), None, db, owner)
    assert (outlet_of(db, plateau.id).on_duty, outlet_of(db, plateau.id).duty_until) == (False, None)
    details = [a.detail for a in db.scalars(select(FuelActivity).where(FuelActivity.outlet_id == plateau.id)).all()]
    assert any("de garde" in (d or "") for d in details) and any("garde arrêtée" in (d or "") for d in details)
