"""Ajout du contact manquant (e-mail ou WhatsApp) et inscription avec les deux."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import ConflictError
from app.core.phone import normalize_phone
from app.routes import auth as route
from app.schemas.auth import ContactUpdateRequest, RegisterRequest


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(route, "enforce_rate_limit", lambda *a, **k: None)


def _service(email_owner=None, phone_owner=None):
    users = SimpleNamespace(get_by_email=lambda _e: email_owner, get_by_whatsapp_phone=lambda _p: phone_owner)
    return SimpleNamespace(db=Mock(), users=users)


def _user(**kw):
    base = {"id": "u-1", "email": "wa-22790000000@users.amazer.ne", "whatsapp_phone": "+22790000000"}
    return SimpleNamespace(**{**base, **kw})


def test_phone_account_can_add_its_email() -> None:
    user = _user()
    route.update_contact(ContactUpdateRequest(email="Awa@Example.test"), SimpleNamespace(), _service(), user)
    assert user.email == "awa@example.test"


def test_existing_real_email_is_never_replaced() -> None:
    with pytest.raises(ConflictError):
        route.update_contact(ContactUpdateRequest(email="new@example.test"), SimpleNamespace(), _service(), _user(email="old@example.test"))


def test_email_already_used_by_someone_else_is_refused() -> None:
    with pytest.raises(ConflictError):
        route.update_contact(ContactUpdateRequest(email="x@example.test"), SimpleNamespace(), _service(email_owner=object()), _user())


def test_email_account_can_add_international_whatsapp() -> None:
    user = _user(email="awa@example.test", whatsapp_phone=None)
    route.update_contact(ContactUpdateRequest(whatsapp_phone="+33 6 12 34 56 78"), SimpleNamespace(), _service(), user)
    assert user.whatsapp_phone == "+33612345678"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("90 00 00 00", "+22790000000"),
        ("+227 90000000", "+22790000000"),
        ("0022790000000", "+22790000000"),
        ("+221 77 123 45 67", "+221771234567"),
        ("+2279000000", None),  # Niger : 8 chiffres obligatoires
        ("0612345678", None),  # numero local etranger sans indicatif
        ("abc", None),
    ],
)
def test_normalize_phone(raw, expected) -> None:
    assert normalize_phone(raw) == expected


def test_register_accepts_email_and_whatsapp_together() -> None:
    req = RegisterRequest(email="awa@example.test", whatsapp_phone="+221771234567", full_name="Awa", password="Motdepasse1!")
    assert req.identifier == "awa@example.test" and req.whatsapp_phone == "+221771234567"
