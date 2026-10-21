"""Rappel admin des paiements Nita en attente depuis plus d'une heure (base SQLite reelle)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.database import Base
from app.models.app_notification import AppNotification
from app.models.order import Order
from app.models.restaurant import RestaurantOrder
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.notification import NotificationToken
from app.models.vendor import Vendor
from app.services import payment_wait_alerts as alerts


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


@pytest.fixture
def db(monkeypatch):
    engine = create_engine("sqlite://")
    tables = [User, Vendor, Order, RestaurantOrder, AppNotification, UserPreferences, NotificationToken]
    Base.metadata.create_all(engine, tables=[t.__table__ for t in tables], checkfirst=True)
    monkeypatch.setattr("app.services.notification_service.relay_notification", lambda **_k: None)
    with Session(engine) as session:
        session.add_all([
            User(id="admin", email="boss@test.ne", full_name="Admin", hashed_password="x", is_active=True, role="admin"),
            User(id="client", email="c@test.ne", full_name="Client", hashed_password="x", is_active=True),
        ])
        session.commit()
        yield session


def _order(db: Session, oid: str, minutes: int, **kw) -> None:
    values = dict(id=oid, user_id="client", status="commande", payment_mode="nita", payment_status="pending", total_amount=20500,
                  transaction_code="enc", tracking_code=f"AMZ-{oid}", created_at=datetime.now(UTC) - timedelta(minutes=minutes))
    values.update(kw)
    db.add(Order(**values))
    db.commit()


def test_admin_is_alerted_once_for_a_payment_waiting_over_an_hour(db: Session) -> None:
    _order(db, "late", 90)
    _order(db, "fresh", 20)
    _order(db, "no-ref", 90, transaction_code=None)
    _order(db, "amana", 90, payment_mode="amana")
    _order(db, "paid", 90, payment_status="paid")
    assert alerts.alert_waiting_payments(db) == 1
    db.commit()
    tags = [n.tag for n in db.query(AppNotification).all()]
    assert tags == ["admin-payment-wait-late"]
    assert alerts.alert_waiting_payments(db) == 0  # une seule alerte par commande
