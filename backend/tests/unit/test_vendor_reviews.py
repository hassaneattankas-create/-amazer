"""Avis verifies : seul un vrai client peut noter ; moyenne et nom public."""

from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.database import Base
from app.models.hospitality import HotelBooking
from app.models.order import Order, OrderItem
from app.models.restaurant import RestaurantOrder
from app.models.vendor_review import VendorReview
from app.services import vendor_review_service as svc


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    tables = [Order, OrderItem, RestaurantOrder, HotelBooking, VendorReview]
    Base.metadata.create_all(engine, tables=[t.__table__ for t in tables])
    with Session(engine) as session:
        yield session


def test_only_real_customers_can_review(db) -> None:
    assert not svc.can_review(db, "u1", "v1")
    db.add(RestaurantOrder(
        id="r1", vendor_id="v1", user_id="u1", customer_name="A", customer_phone="1", delivery_address="x",
        status="preparation", total_amount=1000, payment_status="paid", payment_mode="nita",
    ))
    db.flush()
    assert not svc.can_review(db, "u1", "v1")  # pas encore livree
    db.get(RestaurantOrder, "r1").status = "recu"
    db.flush()
    assert svc.can_review(db, "u1", "v1")
    assert not svc.can_review(db, "u2", "v1")


def test_summary_average_and_distribution(db) -> None:
    for i, rating in enumerate([5, 4, 4, 1]):
        db.add(VendorReview(id=f"x{i}", vendor_id="v1", user_id=f"u{i}", rating=rating))
    db.add(VendorReview(id="hidden", vendor_id="v1", user_id="troll", rating=1, is_hidden=True))
    db.flush()
    info = svc.summary(db, "v1")
    assert (info.average, info.count) == (3.5, 4)
    assert info.distribution == {1: 1, 2: 0, 3: 0, 4: 2, 5: 1}


def test_public_name_never_shows_full_name() -> None:
    assert svc.public_name(SimpleNamespace(full_name="Aïcha Mahamadou Issa")) == "Aïcha M."
    assert svc.public_name(None) == "Client"
