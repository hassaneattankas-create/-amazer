"""Mot de passe oublie et envoi d'e-mails : aucun envoi pretendu, codes a usage unique et dedies."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock

import pytest
from pydantic import ValidationError

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import verify_password
from app.schemas.auth import PasswordResetRequest
from app.services import auth_service as auth_module
from app.services import email_delivery_service as email_module
from app.services.auth_service import RESET_CHANNEL, AuthService


def _user(**overrides):
    values = {
        "id": "user-1",
        "email": "client@example.test",
        "whatsapp_phone": None,
        "is_active": True,
        "hashed_password": "ancien-hash",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _service(user, *, record=None) -> AuthService:
    db = Mock()
    db.scalar.return_value = record
    service = AuthService(db)
    service._get_user_by_identifier = lambda _identifier: user  # type: ignore[method-assign]
    service.refresh_tokens = Mock()
    return service


# --- Demande de code ---------------------------------------------------------------

def test_forgot_password_unknown_account_reveals_nothing() -> None:
    service = _service(None)
    assert service.request_password_reset("inconnu@example.test") == {"code_preview": None}
    service.db.add.assert_not_called()


def test_forgot_password_creates_dedicated_reset_code_and_sends_email(monkeypatch) -> None:
    sent: list[tuple] = []
    monkeypatch.setattr(auth_module, "send_verification_code_email", lambda *a, **k: sent.append((a, k)) or True)
    service = _service(_user())

    result = service.request_password_reset("client@example.test")

    record = service.db.add.call_args.args[0]
    assert record.channel == RESET_CHANNEL
    assert sent and sent[0][0][0] == "client@example.test" and sent[0][1] == {"purpose": "reset"}
    # Hors production, le code est renvoye pour les tests manuels ; jamais en production.
    assert result["code_preview"] is not None and len(result["code_preview"]) == 6


def test_forgot_password_uses_whatsapp_when_account_has_phone(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(auth_module, "send_verification_code_via_whatsapp", lambda phone, _code: calls.append(phone) or True)
    monkeypatch.setattr(auth_module, "send_verification_code_email", lambda *a, **k: pytest.fail("pas d'e-mail"))
    _service(_user(whatsapp_phone="+22790000000")).request_password_reset("+22790000000")
    assert calls == ["+22790000000"]


# --- Reinitialisation -----------------------------------------------------------------

def _record(service: AuthService, user, code: str, **overrides):
    values = {
        "code_hash": service._hash_verification_code(user.id, code),
        "expires_at": datetime.now(UTC) + timedelta(minutes=5),
        "attempt_count": 0,
        "consumed_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_reset_password_with_valid_code_changes_password_and_closes_sessions() -> None:
    user = _user()
    service = _service(user)
    record = _record(service, user, "123456")
    service.db.scalar.return_value = record

    service.reset_password("client@example.test", "123456", "Nouveau#Pass2026")

    assert verify_password("Nouveau#Pass2026", user.hashed_password)
    assert record.consumed_at is not None
    service.refresh_tokens.revoke_all_for_user.assert_called_once_with("user-1")


def test_reset_password_wrong_code_counts_attempt() -> None:
    user = _user()
    service = _service(user)
    record = _record(service, user, "123456")
    service.db.scalar.return_value = record

    with pytest.raises(UnauthorizedError):
        service.reset_password("client@example.test", "000000", "Nouveau#Pass2026")
    assert record.attempt_count == 1
    assert user.hashed_password == "ancien-hash"


def test_reset_password_expired_code_rejected() -> None:
    user = _user()
    service = _service(user)
    service.db.scalar.return_value = _record(service, user, "123456", expires_at=datetime.now(UTC) - timedelta(seconds=1))
    with pytest.raises(UnauthorizedError):
        service.reset_password("client@example.test", "123456", "Nouveau#Pass2026")


def test_reset_password_blocked_after_max_attempts() -> None:
    user = _user()
    service = _service(user)
    service.db.scalar.return_value = _record(service, user, "123456", attempt_count=99)
    with pytest.raises(ForbiddenError):
        service.reset_password("client@example.test", "123456", "Nouveau#Pass2026")
    assert user.hashed_password == "ancien-hash"


def test_reset_password_unknown_account_rejected() -> None:
    with pytest.raises(UnauthorizedError):
        _service(None).reset_password("x@example.test", "123456", "Nouveau#Pass2026")


def test_account_verification_never_uses_reset_code() -> None:
    user = _user(is_active=False)
    service = _service(user)
    service.db.scalar.return_value = None
    with pytest.raises(UnauthorizedError):
        service.verify_account("client@example.test", "123456")
    query = str(service.db.scalar.call_args.args[0])
    assert "login_verification_codes.channel !=" in query


def test_reset_schema_enforces_code_format_and_password_strength() -> None:
    with pytest.raises(ValidationError):
        PasswordResetRequest(identifier="client@example.test", code="12345", new_password="Nouveau#Pass2026")
    with pytest.raises(ValidationError):
        PasswordResetRequest(identifier="client@example.test", code="123456", new_password="faible")


# --- Envoi SMTP ------------------------------------------------------------------------

def _settings(**overrides):
    values = {
        "smtp_host": None,
        "smtp_port": 587,
        "smtp_username": None,
        "smtp_password": None,
        "smtp_from": None,
        "smtp_use_ssl": False,
        "smtp_timeout_seconds": 5,
        "verification_code_ttl_minutes": 10,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_email_not_sent_and_reported_false_when_smtp_missing(monkeypatch) -> None:
    monkeypatch.setattr(email_module, "get_settings", lambda: _settings())
    smtp = MagicMock()
    monkeypatch.setattr(email_module.smtplib, "SMTP", smtp)
    assert email_module.send_email("a@example.test", "Sujet", "Corps") is False
    smtp.assert_not_called()


def test_email_sent_through_smtp_with_starttls(monkeypatch) -> None:
    monkeypatch.setattr(
        email_module,
        "get_settings",
        lambda: _settings(smtp_host="smtp.example.test", smtp_from="AMAZER <no-reply@amazer.store>", smtp_username="u", smtp_password="p"),
    )
    smtp = MagicMock()
    monkeypatch.setattr(email_module.smtplib, "SMTP", smtp)

    assert email_module.send_verification_code_email("a@example.test", "654321", purpose="reset") is True

    server = smtp.return_value.__enter__.return_value
    server.starttls.assert_called_once()
    server.login.assert_called_once_with("u", "p")
    message = server.send_message.call_args.args[0]
    assert message["To"] == "a@example.test"
    assert "654321" in message.get_content()


def test_email_failure_is_reported_false(monkeypatch) -> None:
    monkeypatch.setattr(email_module, "get_settings", lambda: _settings(smtp_host="smtp.example.test", smtp_from="x@amazer.store"))
    smtp = MagicMock(side_effect=OSError("reseau"))
    monkeypatch.setattr(email_module.smtplib, "SMTP", smtp)
    assert email_module.send_email("a@example.test", "Sujet", "Corps") is False
