from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import create_refresh_token, hash_password
from app.services.auth_service import AuthService


def _build_service() -> tuple[AuthService, Mock]:
    db = Mock()
    service = AuthService(db=db)
    service.users = Mock()
    service.refresh_tokens = Mock()
    return service, db


def test_register_success_commits_and_refreshes() -> None:
    service, db = _build_service()
    user = SimpleNamespace(id="u1", email="user@example.com")

    service.users.get_by_email.return_value = None
    service.users.create.return_value = user

    result = service.register("user@example.com", "Jane Doe", "StrongP@ssw0rd!")

    assert result is user
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(user)


def test_register_duplicate_email_raises() -> None:
    service, _ = _build_service()
    service.users.get_by_email.return_value = SimpleNamespace(id="u1")

    with pytest.raises(ConflictError) as exc:
        service.register("user@example.com", "Jane Doe", "StrongP@ssw0rd!")

    assert exc.value.status_code == 409


def test_login_success_issues_tokens_and_commits() -> None:
    service, db = _build_service()
    user = SimpleNamespace(
        id="u1",
        is_active=True,
        hashed_password=hash_password("StrongP@ssw0rd!"),
    )
    service.users.get_by_email.return_value = user

    tokens = service.login("user@example.com", "StrongP@ssw0rd!")

    assert tokens["token_type"] == "bearer"
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    service.refresh_tokens.create.assert_called_once()
    db.commit.assert_called_once()


def test_login_invalid_credentials_raises() -> None:
    service, _ = _build_service()
    service.users.get_by_email.return_value = None

    with pytest.raises(UnauthorizedError) as exc:
        service.login("user@example.com", "StrongP@ssw0rd!")

    assert exc.value.status_code == 401


def test_refresh_success_revokes_old_token_and_rotates() -> None:
    service, db = _build_service()
    user = SimpleNamespace(id="u1", is_active=True)
    refresh_token, jti, _ = create_refresh_token("u1")
    record = SimpleNamespace(jti=jti, revoked=False)

    def revoke(token: SimpleNamespace) -> None:
        token.revoked = True

    service.refresh_tokens.get_valid_by_jti.return_value = record
    service.refresh_tokens.revoke.side_effect = revoke
    service.users.get_by_id.return_value = user

    tokens = service.refresh(refresh_token)

    assert tokens["token_type"] == "bearer"
    assert record.revoked is True
    service.refresh_tokens.create.assert_called_once()
    db.commit.assert_called_once()


def test_get_current_user_rejects_wrong_token_type() -> None:
    service, _ = _build_service()
    refresh_token, _, _ = create_refresh_token("u1")

    with pytest.raises(UnauthorizedError) as exc:
        service.get_current_user(refresh_token)

    assert exc.value.status_code == 401
