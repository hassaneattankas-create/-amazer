"""Carburant vendu d'après les compteurs des pompes (base SQLite réelle)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateIndex

from app.core.exceptions import ValidationDomainError
from app.database import Base
from app.models.fuel_activity import FuelActivity, FuelMeterReading, FuelPump
from app.models.fuel_outlet import FuelOutlet
from app.models.user import User
from app.models.vendor import Vendor
from app.services import fuel_sales_service as sales


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


@compiles(CreateIndex, "sqlite")
def _skip_postgres_only_index(create, compiler, **kw) -> str:
    if create.element.name == "ix_products_search_tsv":
        return "SELECT 1"
    return compiler.visit_create_index(create, **kw)


# Lundi 16/11/2026, 20 h à Niamey (19 h UTC)
EVENING = datetime(2026, 11, 16, 19, 0, tzinfo=UTC)


@pytest.fixture
def setup():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[t.__table__ for t in (User, Vendor, FuelOutlet, FuelActivity, FuelPump, FuelMeterReading)])
    with Session(engine) as db:
        user = User(id="u1", email="awa@test.ne", full_name="Awa", hashed_password="x", is_active=True)
        db.add_all([user, Vendor(id="v1", name="Sahel", slug="sahel", is_active=True)])
        outlet = FuelOutlet(id="o1", vendor_id="v1", name="Plateau", city="Niamey")
        db.add(outlet)
        db.commit()
        yield db, outlet, user


def test_sold_is_difference_between_readings(setup) -> None:
    db, outlet, user = setup
    p1 = sales.add_pump(db, outlet=outlet, user=user, role="manager", fuel="super", name="Pompe 1")
    p2 = sales.add_pump(db, outlet=outlet, user=user, role="manager", fuel="gasoil", name="Pompe 2")
    # Dimanche soir : point de départ (rien de vendu compté)
    first = sales.record_readings(db, outlet=outlet, user=user, role="manager", readings=[(p1.id, 100_000, False), (p2.id, 50_000, False)], now=EVENING - timedelta(days=1))
    assert first == {}
    # Lundi soir : 1 250 L de super et 2 300 L de gasoil
    sold = sales.record_readings(db, outlet=outlet, user=user, role="manager", readings=[(p1.id, 101_250, False), (p2.id, 52_300, False)], now=EVENING)
    assert sold == {"super": 1250, "gasoil": 2300}
    days = sales.day_list(sales.daily_sales(db, ["o1"], 7, EVENING)["o1"], 7, EVENING)
    assert days[0] == {"day": EVENING.date(), "super": 1250, "gasoil": 2300}
    assert days[1]["super"] == 0


def test_lower_meter_is_refused_unless_reset(setup) -> None:
    db, outlet, user = setup
    pump = sales.add_pump(db, outlet=outlet, user=user, role="manager", fuel="super", name="Pompe 1")
    sales.record_readings(db, outlet=outlet, user=user, role="manager", readings=[(pump.id, 5_000, False)], now=EVENING - timedelta(days=1))
    with pytest.raises(ValidationDomainError, match="plus petit que le dernier relevé"):
        sales.record_readings(db, outlet=outlet, user=user, role="manager", readings=[(pump.id, 4_000, False)], now=EVENING)
    db.rollback()
    # Compteur changé : on repart de zéro, sans vente comptée
    assert sales.record_readings(db, outlet=outlet, user=user, role="manager", readings=[(pump.id, 10, True)], now=EVENING) == {}
    with pytest.raises(ValidationDomainError, match="c'est trop"):
        sales.record_readings(db, outlet=outlet, user=user, role="manager", readings=[(pump.id, 500_000, False)], now=EVENING + timedelta(hours=1))


def test_pump_fuels_and_duplicates(setup) -> None:
    db, outlet, user = setup
    with pytest.raises(ValidationDomainError):
        sales.add_pump(db, outlet=outlet, user=user, role="manager", fuel="gaz", name="Gaz")
    sales.add_pump(db, outlet=outlet, user=user, role="manager", fuel="super", name="Pompe 1")
    with pytest.raises(ValidationDomainError, match="existe déjà"):
        sales.add_pump(db, outlet=outlet, user=user, role="manager", fuel="gasoil", name="pompe 1")
