"""Statistiques des vitrines : compteurs par jour (heure de Niamey), semaine contre semaine."""

from datetime import UTC, date, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.database import Base
from app.models.hospitality import HotelBooking
from app.models.order import Order, OrderItem
from app.models.restaurant import RestaurantOrder
from app.models.storefront_stat import StorefrontDailyStat
from app.services import storefront_stats_service as svc


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    tables = [StorefrontDailyStat, Order, OrderItem, RestaurantOrder, HotelBooking]
    Base.metadata.create_all(engine, tables=[t.__table__ for t in tables])
    with Session(engine) as session:
        yield session


def test_views_and_contacts_are_counted_per_niamey_day(db) -> None:
    late_evening_utc = datetime(2026, 10, 15, 23, 30, tzinfo=UTC)  # deja le 16 a Niamey
    svc.record(db, "v1", "view", late_evening_utc)
    svc.record(db, "v1", "view", late_evening_utc)
    svc.record(db, "v1", "contact", late_evening_utc)
    db.flush()
    row = db.get(StorefrontDailyStat, ("v1", date(2026, 10, 16)))
    assert (row.views, row.contacts) == (2, 1)


def test_daily_series_fills_empty_days(db) -> None:
    now = datetime(2026, 10, 16, 10, tzinfo=UTC)
    svc.record(db, "v1", "view", now)
    db.flush()
    series = svc.daily(db, "v1", 7, now)
    assert len(series) == 7 and series[-1] == (date(2026, 10, 16), 1, 0) and series[0][1] == 0


def test_week_totals_compare_this_week_and_last_week(db) -> None:
    now = datetime(2026, 10, 16, 10, tzinfo=UTC)
    svc.record(db, "v1", "view", now)
    svc.record(db, "v1", "view", datetime(2026, 10, 5, 10, tzinfo=UTC))
    db.flush()
    assert svc.week_totals(db, "v1", 0, now).views == 1
    assert svc.week_totals(db, "v1", 1, now).views == 1
