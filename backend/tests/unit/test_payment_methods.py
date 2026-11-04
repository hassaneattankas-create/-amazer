from __future__ import annotations

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationDomainError
from app.database import Base
from app.models.global_settings import GlobalSettings
from app.models.payment_method import PaymentMethod
from app.models.user import User
from app.routes import payment_methods as route
from app.schemas.order import CheckoutRequest
from app.services import payment_methods as svc


@pytest.fixture
def db(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[PaymentMethod.__table__, GlobalSettings.__table__, User.__table__])
    monkeypatch.setattr(route, "enforce_csrf", lambda _request: None)
    monkeypatch.setattr(route, "_require_finance_pin", lambda _request, _admin: None)
    monkeypatch.setattr(route, "append_audit_log", lambda *_a, **_k: None)
    with Session(engine) as session:
        session.add(GlobalSettings(platform_wallet_phone="+227 90 00 00 09"))
        session.commit()
        yield session


class _Req:
    client = None

    class url:
        path = "/test"


ADMIN = User(id="admin", email="a@test.ne", hashed_password="x")


def test_nita_and_amana_exist_by_default_and_use_the_general_number(db: Session) -> None:
    methods = route.list_payment_methods(db)
    assert [(m.code, m.kind) for m in methods] == [("nita", "manual"), ("amana", "amana")]
    assert methods[0].account_number == "+227 90 00 00 09"


def test_admin_adds_a_method_that_customers_then_see(db: Session) -> None:
    created = route.admin_create_payment_method(
        route.PaymentMethodWrite(name="Moov Money", account_number="+227 91 11 11 11", account_name="AMAZER SARL", instructions="Composez *555#."),
        _Req, db, ADMIN,
    )
    assert (created.code, created.kind, created.built_in) == ("moov-money", "manual", False)
    public = {m.code: m for m in route.list_payment_methods(db)}
    assert public["moov-money"].account_number == "+227 91 11 11 11"
    assert svc.intent_details(db, "moov-money")["instructions"] == "Composez *555#."
    assert svc.require_active_method(db, "moov-money").name == "Moov Money"


def test_new_method_requires_a_number_and_names_stay_unique(db: Session) -> None:
    with pytest.raises(ValidationDomainError):
        route.admin_create_payment_method(route.PaymentMethodWrite(name="Sans numéro"), _Req, db, ADMIN)
    first = route.admin_create_payment_method(route.PaymentMethodWrite(name="Zamani Cash", account_number="1"), _Req, db, ADMIN)
    second = route.admin_create_payment_method(route.PaymentMethodWrite(name="Zamani Cash", account_number="2"), _Req, db, ADMIN)
    assert (first.code, second.code) == ("zamani-cash", "zamani-cash-2")


def test_disabled_method_is_hidden_and_refused_but_old_orders_still_display(db: Session) -> None:
    created = route.admin_create_payment_method(route.PaymentMethodWrite(name="Airtel", account_number="1"), _Req, db, ADMIN)
    route.admin_update_payment_method(created.code, route.PaymentMethodWrite(name="Airtel", account_number="1", is_active=False), _Req, db, ADMIN)
    assert created.code not in {m.code for m in route.list_payment_methods(db)}
    with pytest.raises(ValidationDomainError):
        svc.require_active_method(db, created.code)
    assert svc.intent_details(db, created.code)["method_name"] == "Airtel"


def test_built_in_methods_cannot_be_deleted_and_one_method_must_stay_active(db: Session) -> None:
    route.list_payment_methods(db)
    with pytest.raises(ValidationDomainError):
        route.admin_delete_payment_method("amana", _Req, db, ADMIN)
    route.admin_update_payment_method("amana", route.PaymentMethodWrite(name="Amana", is_active=False), _Req, db, ADMIN)
    with pytest.raises(ValidationDomainError):
        route.admin_update_payment_method("nita", route.PaymentMethodWrite(name="Nita", is_active=False), _Req, db, ADMIN)
    db.rollback()
    with pytest.raises(NotFoundError):
        route.admin_delete_payment_method("inconnu", _Req, db, ADMIN)


def test_unknown_method_is_refused(db: Session) -> None:
    with pytest.raises(ValidationDomainError):
        svc.require_active_method(db, "inconnu")


def test_order_payload_rejects_a_malformed_code() -> None:
    with pytest.raises(ValidationError):
        CheckoutRequest.model_validate({"items": [], "payment_mode": "NITA; DROP"})
