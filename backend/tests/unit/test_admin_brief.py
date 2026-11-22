"""Résumé du matin de l'admin : texte clair, une seule fois par jour, jamais avant 7 h à Niamey."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models.app_notification import AppNotification
from app.models.user import User
from app.services import admin_brief

NUMBERS = {
    "order_payments": 2, "registrations": 1, "subscriptions": 0, "ambassadors": 1,
    "affiliate_payouts": 0, "refunds": 0, "orders_yesterday": 5, "sales_yesterday": 42500.0, "new_sellers_yesterday": 3,
}


def test_compose_lists_only_what_waits_and_yesterday() -> None:
    title, body = admin_brief.compose(NUMBERS)
    assert title == "Bonjour ! 4 chose(s) vous attendent sur AMAZER"
    assert "• 2 paiement(s) de commande à valider" in body and "• 1 candidature(s) d'ambassadeur" in body
    assert "abonnement" not in body and "remboursement" not in body
    assert "Hier : 5 commande(s), 42 500 F encaissés, 3 nouveau(x) vendeur(s)." in body


def test_compose_when_nothing_waits() -> None:
    title, _ = admin_brief.compose({**NUMBERS, "order_payments": 0, "registrations": 0, "ambassadors": 0})
    assert title == "Bonjour ! Rien en attente sur AMAZER"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[User.__table__, AppNotification.__table__])
    with Session(engine) as session:
        session.add_all([
            User(id="boss", email="boss@test.ne", full_name="Boss", hashed_password="x", is_active=True, role="admin"),
            User(id="client", email="client@test.ne", full_name="Client", hashed_password="x", is_active=True, role="user"),
        ])
        session.commit()
        yield session


def test_sent_once_per_day_to_admins_only_after_seven(db: Session, monkeypatch) -> None:
    sent: list[str] = []

    def fake_send(self, *, user_id, payload):
        sent.append(user_id)
        db.add(AppNotification(user_id=user_id, title=payload.title, body=payload.body, tag=payload.data["tag"]))
        db.flush()

    monkeypatch.setattr(admin_brief, "collect", lambda _db, _now: NUMBERS)
    monkeypatch.setattr("app.services.notification_service.NotificationService.send_to_user", fake_send)
    assert admin_brief.maybe_send(db, datetime(2026, 11, 23, 5, 30, tzinfo=UTC)) == 0  # 6 h 30 à Niamey
    assert admin_brief.maybe_send(db, datetime(2026, 11, 23, 6, 5, tzinfo=UTC)) == 1  # 7 h 05
    assert admin_brief.maybe_send(db, datetime(2026, 11, 23, 9, 0, tzinfo=UTC)) == 0  # déjà reçu aujourd'hui
    assert admin_brief.maybe_send(db, datetime(2026, 11, 24, 6, 5, tzinfo=UTC)) == 1  # lendemain
    assert sent == ["boss", "boss"]


def test_collect_counts_real_tables() -> None:
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.compiler import compiles

    from app.models.affiliate import AffiliateAccount, AffiliatePayout
    from app.models.order import Order
    from app.models.refund import Refund
    from app.models.seller_pending_registration import SellerPendingRegistration
    from app.models.seller_profile import SellerProfile
    from app.models.seller_subscription_payment import SellerSubscriptionPayment
    from app.models.vendor import Vendor

    @compiles(JSONB, "sqlite")
    def _jsonb(_type, _compiler, **_kw) -> str:
        return "JSON"

    engine = create_engine("sqlite://")
    tables = (User, Vendor, SellerProfile, Order, Refund, SellerPendingRegistration, SellerSubscriptionPayment, AffiliateAccount, AffiliatePayout)
    Base.metadata.create_all(engine, tables=[t.__table__ for t in tables])
    with Session(engine) as session:
        numbers = admin_brief.collect(session, datetime(2026, 11, 23, 7, tzinfo=UTC))
    assert set(numbers) == set(NUMBERS) and all(value == 0 for value in numbers.values())
