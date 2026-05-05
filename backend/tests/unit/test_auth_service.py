from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.core.security import create_refresh_token, hash_password
from app.services.auth_service import AuthService


def _build_service() -> tuple[AuthService, Mock]:
    db = Mock()
    service = AuthService(db=db)
    service.users = Mock()
    service.refresh_tokens = Mock()
    return service, db


def test_register_success_creates_active_account_without_verification_payload() -> None:
    service, db = _build_service()
    user = SimpleNamespace(id="u1", email="user@example.com", full_name="Jane Doe", whatsapp_phone="+22790000000")

    service.users.get_by_whatsapp_phone.return_value = None
    service.users.create.return_value = user

    result = service.register("+22790000000", "Jane Doe", "StrongP@ssw0rd!")

    assert result["success"] is True
    assert result["verification_channel"] == "none"
    assert result["verification_code_preview"] is None
    assert service.users.create.call_args.kwargs["is_active"] is True
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(user)


def test_register_with_seller_profile_creates_storefront() -> None:
    service, db = _build_service()
    user = SimpleNamespace(id="u1", email="user@example.com", full_name="Jane Doe", whatsapp_phone=None)

    service.users.get_by_email.return_value = None
    service.users.create.return_value = user

    result = service.register(
        "user@example.com",
        "Jane Doe",
        "StrongP@ssw0rd!",
        seller_profile={"business_name": "Hotel Amazer", "activity_type": "hotel"},
    )

    assert result["success"] is True
    db.add.assert_called()
    db.commit.assert_called_once()


def test_register_duplicate_email_raises() -> None:
    service, _ = _build_service()
    service.users.get_by_email.return_value = SimpleNamespace(id="u1")

    with pytest.raises(ConflictError) as exc:
        service.register("user@example.com", "Jane Doe", "StrongP@ssw0rd!")

    assert exc.value.status_code == 409


def test_verify_account_activates_user() -> None:
    service, db = _build_service()
    user = SimpleNamespace(id="u1", is_active=False)
    code = "123456"
    record = SimpleNamespace(
        user_id="u1",
        expires_at=datetime.now(UTC) + timedelta(minutes=10),
        attempt_count=0,
        code_hash=service._hash_verification_code("u1", code),  # type: ignore[attr-defined]
        consumed_at=None,
    )
    service.users.get_by_email.return_value = user
    db.scalar.side_effect = [record, None]

    result = service.verify_account("user@example.com", code)

    assert result["success"] is True
    assert user.is_active is True
    db.commit.assert_called_once()


def test_login_success_issues_tokens_and_commits() -> None:
    service, db = _build_service()
    user = SimpleNamespace(
        id="u1",
        email="user@example.com",
        is_active=True,
        hashed_password=hash_password("StrongP@ssw0rd!"),
    )
    service.users.get_by_email.return_value = user
    service._ensure_default_preferences = Mock()  # type: ignore[attr-defined]

    tokens = service.login("user@example.com", "StrongP@ssw0rd!")

    assert tokens["token_type"] == "bearer"
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    service.refresh_tokens.create.assert_called_once()
    db.commit.assert_called_once()


def test_login_with_whatsapp_identifier_uses_phone_lookup() -> None:
    service, _ = _build_service()
    user = SimpleNamespace(
        id="u1",
        is_active=True,
        hashed_password=hash_password("StrongP@ssw0rd!"),
    )
    service.users.get_by_whatsapp_phone.return_value = user
    service._ensure_default_preferences = Mock()  # type: ignore[attr-defined]

    tokens = service.login("+22790000000", "StrongP@ssw0rd!")

    assert tokens["token_type"] == "bearer"
    service.users.get_by_whatsapp_phone.assert_called_once_with("+22790000000")


def test_login_inactive_user_requires_verification() -> None:
    service, _ = _build_service()
    service.users.get_by_email.return_value = SimpleNamespace(
        id="u1",
        email="user@example.com",
        is_active=False,
        hashed_password=hash_password("StrongP@ssw0rd!"),
    )

    with pytest.raises(ForbiddenError) as exc:
        service.login("user@example.com", "StrongP@ssw0rd!")

    assert exc.value.status_code == 403


def test_login_inactive_demo_domain_auto_activates() -> None:
    service, db = _build_service()
    user = SimpleNamespace(
        id="u1",
        email="demo.amazer.market@amazer.demo",
        is_active=False,
        hashed_password=hash_password("StrongP@ssw0rd!"),
    )
    service.users.get_by_email.return_value = user
    service._ensure_default_preferences = Mock()  # type: ignore[attr-defined]

    tokens = service.login("demo.amazer.market@amazer.demo", "StrongP@ssw0rd!")

    assert user.is_active is True
    assert tokens["token_type"] == "bearer"
    db.execute.assert_called_once()
    db.commit.assert_called_once()


def test_register_blocks_amazer_demo_domain_in_production() -> None:
    service, db = _build_service()
    service.users.get_by_email.return_value = None
    prod = Mock()
    prod.is_production = Mock(return_value=True)
    with patch("app.services.auth_service.get_settings", return_value=prod):
        with pytest.raises(ConflictError) as exc:
            service.register("demo.amazer.market@amazer.demo", "Demo", "StrongP@ssw0rd!")
    assert exc.value.status_code == 409
    service.users.create.assert_not_called()


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
