"""Alertes carburant (« Me prévenir ») et signalements des clients (« Vous y êtes ? »)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationDomainError
from app.database import Base
from app.models.fuel_alert import FuelAlert, FuelSignal
from app.models.fuel_outlet import FuelOutlet
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.services import fuel_alert_service as alerts

NOW = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[t.__table__ for t in (User, Vendor, SellerProfile, FuelOutlet, FuelAlert, FuelSignal)])
    with Session(engine) as session:
        for uid in ("awa", "moussa", "zara"):
            session.add(User(id=uid, email=f"{uid}@test.ne", full_name=uid.title(), hashed_password="x", is_active=True))
        session.add(Vendor(id="v-sahel", name="sahel", slug="sahel", is_active=True))
        session.add(SellerProfile(user_id="awa", vendor_id="v-sahel", business_name="Sahel Énergie", city="Niamey", service_kind="fuel_station"))
        session.add(FuelOutlet(id="o-plateau", vendor_id="v-sahel", name="Plateau", city="Niamey"))
        session.add(FuelOutlet(id="o-maradi", vendor_id="v-sahel", name="Centre-ville", city="Maradi"))
        session.commit()
        yield session


def test_only_a_real_return_of_fuel_triggers_an_alert() -> None:
    assert alerts.became_available("out", "available")
    assert alerts.became_available(None, "low")
    assert not alerts.became_available("low", "available")  # il y en avait déjà
    assert not alerts.became_available("available", "out")


def test_station_brand_and_city_subscribers_match_but_not_other_cities(db: Session) -> None:
    alerts.subscribe(db, "moussa", "super", outlet_id="o-plateau", vendor_id=None, city=None)
    alerts.subscribe(db, "zara", "any", outlet_id=None, vendor_id=None, city="Niamey")
    alerts.subscribe(db, "awa", "super", outlet_id=None, vendor_id=None, city="Maradi")
    db.commit()
    opening = alerts.Opening("v-sahel", "o-plateau", "super")
    users = sorted(a.user_id for a in alerts.matching_alerts(db, opening, "Niamey", NOW))
    assert users == ["moussa", "zara"]
    # Gasoil au Plateau : seul l'abonné « n'importe quel carburant » de Niamey est concerné.
    gasoil = alerts.Opening("v-sahel", "o-plateau", "gasoil")
    assert [a.user_id for a in alerts.matching_alerts(db, gasoil, "Niamey", NOW)] == ["zara"]


def test_at_most_one_alert_every_two_hours(db: Session) -> None:
    alert = alerts.subscribe(db, "moussa", "super", outlet_id="o-plateau", vendor_id=None, city=None)
    alert.last_sent_at = NOW - timedelta(minutes=30)
    db.commit()
    opening = alerts.Opening("v-sahel", "o-plateau", "super")
    assert alerts.matching_alerts(db, opening, "Niamey", NOW) == []
    assert len(alerts.matching_alerts(db, opening, "Niamey", NOW + timedelta(hours=2))) == 1


def test_subscribe_twice_returns_the_same_and_caps_at_ten(db: Session) -> None:
    first = alerts.subscribe(db, "moussa", "super", outlet_id="o-plateau", vendor_id=None, city=None)
    again = alerts.subscribe(db, "moussa", "super", outlet_id="o-plateau", vendor_id=None, city=None)
    assert first.id == again.id
    for i in range(9):
        alerts.subscribe(db, "moussa", "gaz", outlet_id=None, vendor_id=None, city=f"Ville {i}")
    with pytest.raises(ValidationDomainError):
        alerts.subscribe(db, "moussa", "gasoil", outlet_id=None, vendor_id=None, city="Zinder")


def test_crowd_keeps_the_latest_word_per_fuel_for_two_hours(db: Session) -> None:
    db.add_all([
        FuelSignal(vendor_id="v-sahel", outlet_id="o-plateau", kind="found", fuel="super", created_at=NOW - timedelta(minutes=50)),
        FuelSignal(vendor_id="v-sahel", outlet_id="o-plateau", kind="out", fuel="super", created_at=NOW - timedelta(minutes=10)),
        FuelSignal(vendor_id="v-sahel", outlet_id="o-plateau", kind="found", fuel="gasoil", created_at=NOW - timedelta(minutes=20)),
        FuelSignal(vendor_id="v-sahel", outlet_id="o-plateau", kind="queue", created_at=NOW - timedelta(minutes=5)),
        FuelSignal(vendor_id="v-sahel", outlet_id="o-plateau", kind="found", fuel="gaz", created_at=NOW - timedelta(hours=3)),
    ])
    db.commit()
    seen = alerts.crowd(db, NOW)[("v-sahel", "o-plateau")]
    assert seen.found == {"gasoil"} and seen.out == {"super"} and seen.queue == 1


def test_queue_changes_keeps_only_returns_until_commit(db: Session) -> None:
    alerts.queue_changes(db, "v-sahel", "o-plateau", [("super", "out", "available"), ("gasoil", "available", "out")])
    assert db.info["fuel_alerts_pending"] == [alerts.Opening("v-sahel", "o-plateau", "super")]
    db.commit()  # en test, rien ne part en arrière-plan ; la file est vidée
    assert "fuel_alerts_pending" not in db.info
