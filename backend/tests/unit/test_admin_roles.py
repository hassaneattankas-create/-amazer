"""Roles en base : droits admin verifies cote serveur, compte principal protege."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.config import get_settings
from app.core.deps import get_admin_user
from app.core.exceptions import UnauthorizedError, ValidationDomainError
from app.core.permissions import is_admin, is_principal_admin
from app.routes import admin_finance as admin_route
from app.schemas.finance import AdminUserRoleUpdateRequest


def _user(user_id: str = "u-1", email: str = "membre@example.test", role: str = "user", active: bool = True):
    return SimpleNamespace(
        id=user_id,
        email=email,
        full_name="Membre",
        whatsapp_phone=None,
        is_active=active,
        role=role,
        created_at=datetime.now(UTC),
    )


def _principal():
    return _user("admin-0", get_settings().admin_email, role="admin")


def test_is_admin_reads_role_and_principal_email() -> None:
    assert is_admin(_user(role="admin"))
    assert not is_admin(_user(role="user"))
    assert not is_admin(None)
    # Compte principal reconnu meme avant la migration du role (compatibilite).
    assert is_admin(_user("admin-0", get_settings().admin_email.upper(), role="user"))
    assert is_principal_admin(_principal())
    assert not is_principal_admin(_user(role="admin"))


def test_admin_dependency_rejects_regular_user() -> None:
    with pytest.raises(UnauthorizedError):
        get_admin_user(_user(role="user"), Mock())
    promoted = _user(role="admin")
    assert get_admin_user(promoted, Mock()) is promoted


@pytest.fixture
def _route(monkeypatch):
    monkeypatch.setattr(admin_route, "enforce_csrf", lambda _request: None)
    monkeypatch.setattr(admin_route, "_require_finance_pin", lambda _request: None)
    audit: list[dict] = []
    monkeypatch.setattr(admin_route, "append_audit_log", lambda *a, **k: audit.append(k))
    return audit


def _request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/admin/users/x/role"))


def _db(target):
    db = Mock()
    db.get.return_value = target
    db.scalar.return_value = None
    return db


def test_admin_can_promote_user_and_it_is_audited(_route) -> None:
    target = _user()
    response = admin_route.update_user_role_admin(
        "u-1", AdminUserRoleUpdateRequest(role="admin"), _request(), _db(target), _principal()
    )
    assert target.role == "admin"
    assert response.is_admin is True
    assert _route[0]["details"] == {"email": target.email, "from": "user", "to": "admin"}


def test_admin_can_demote_another_admin(_route) -> None:
    target = _user(role="admin")
    admin_route.update_user_role_admin("u-1", AdminUserRoleUpdateRequest(role="user"), _request(), _db(target), _principal())
    assert target.role == "user"


@pytest.mark.parametrize(
    ("target", "actor", "message"),
    [
        (_principal(), _user("other-admin", role="admin"), "principal"),
        (_user("self", role="admin"), _user("self", role="admin"), "propre role"),
        (_user(active=False), _principal(), "Reactivez"),
    ],
)
def test_role_change_guards(_route, target, actor, message) -> None:
    before = target.role
    with pytest.raises(ValidationDomainError, match=message):
        admin_route.update_user_role_admin(
            target.id, AdminUserRoleUpdateRequest(role="user"), _request(), _db(target), actor
        )
    assert target.role == before
    assert _route == []


def test_role_payload_rejects_unknown_role() -> None:
    with pytest.raises(ValueError):
        AdminUserRoleUpdateRequest(role="superadmin")


def test_permanent_delete_anonymizes_and_frees_email(_route, monkeypatch) -> None:
    monkeypatch.setattr(admin_route, "_invalidate_public_marketplace_cache", lambda: None)
    target = _user("u-9", "client@example.test", role="courier")
    target.hashed_password = "old"
    db = Mock()
    db.get.return_value = target
    db.scalar.return_value = None
    admin_route.permanently_delete_user("u-9", _request(), db, _principal())
    assert target.email.endswith("@users.deleted.amazer.ne")
    assert target.full_name == "Compte supprime" and target.whatsapp_phone is None
    assert target.is_active is False and target.role == "user" and target.hashed_password != "old"
    assert _route[0]["details"] == {"email": "client@example.test"}
    db.commit.assert_called_once()


def test_permanent_delete_refuses_admin(_route) -> None:
    db = Mock()
    db.get.return_value = _user(role="admin")
    with pytest.raises(ValidationDomainError):
        admin_route.permanently_delete_user("u-1", _request(), db, _principal())


def test_admin_message_reaches_every_recipient(_route, monkeypatch) -> None:
    sent: list[str] = []

    class FakeNotifications:
        def __init__(self, _db):
            pass

        def send_to_user(self, *, user_id, payload):
            sent.append(user_id)
            assert payload.data["href"] == "/notifications"

    monkeypatch.setattr(admin_route, "NotificationService", FakeNotifications)
    db = Mock()
    db.scalars.return_value.all.return_value = [_user("u-1"), _user("u-2")]
    from app.schemas.finance import AdminBroadcastRequest

    result = admin_route.send_admin_message(
        AdminBroadcastRequest(audience="all", title="Nouveauté", body="La livraison express arrive."),
        _request(),
        db,
        _principal(),
    )
    assert result.recipients == 2 and sent == ["u-1", "u-2"]
    db.commit.assert_called_once()


def test_admin_message_to_unknown_user_is_refused(_route) -> None:
    db = Mock()
    db.scalars.return_value.all.return_value = []
    from app.schemas.finance import AdminBroadcastRequest

    with pytest.raises(ValidationDomainError):
        admin_route.send_admin_message(
            AdminBroadcastRequest(audience="user", user_email="inconnu@example.test", title="Bonjour", body="Test message"),
            _request(),
            db,
            _principal(),
        )
