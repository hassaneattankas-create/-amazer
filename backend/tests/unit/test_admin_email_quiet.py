"""Admin : un seul e-mail par jour (résumé du matin) ; les autres notifications restent sur le site."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models.app_notification import AppNotification
from app.models.notification import NotificationToken
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.services import notification_service as ns


@pytest.fixture
def db(monkeypatch):
    sent: list[tuple[str, str | None]] = []
    monkeypatch.setattr(ns, "relay_notification", lambda **kw: sent.append((kw["tag"], kw["email"])) or True)
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[t.__table__ for t in (User, AppNotification, NotificationToken, UserPreferences)])
    with Session(engine) as session:
        session.add_all([
            User(id="boss", email="boss@test.ne", full_name="Boss", hashed_password="x", is_active=True, role="admin"),
            User(id="shop", email="shop@test.ne", full_name="Shop", hashed_password="x", is_active=True, role="user"),
        ])
        session.commit()
        session.info["sent"] = sent
        yield session


def notify(db: Session, user_id: str, tag: str) -> None:
    ns.NotificationService(db).send_to_user(user_id=user_id, payload=ns.NotificationPayload(title="T", body="B", data={"tag": tag}))


def test_admin_gets_only_the_morning_brief_by_email(db: Session) -> None:
    notify(db, "boss", "order-paid-123")
    notify(db, "boss", "admin-brief-2026-11-25")
    assert db.info["sent"] == [("admin-brief-2026-11-25", "boss@test.ne")]
    # Les deux notifications restent visibles sur le site.
    assert db.query(AppNotification).filter_by(user_id="boss").count() == 2


def test_other_users_still_get_their_emails(db: Session) -> None:
    notify(db, "shop", "order-paid-123")
    assert db.info["sent"] == [("order-paid-123", "shop@test.ne")]
