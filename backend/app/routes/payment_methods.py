"""Liste publique des moyens de paiement et gestion par l'admin (PIN finance requis)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.csrf import enforce_csrf
from app.core.deps import get_admin_user
from app.core.exceptions import NotFoundError, ValidationDomainError
from app.database import get_db
from app.models.payment_method import PaymentMethod
from app.models.user import User
from app.routes.admin_finance import _require_finance_pin
from app.services import payment_methods as svc
from app.services.audit_log_service import append_audit_log

router = APIRouter(tags=["payment-methods"])


class PaymentMethodResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    name: str
    kind: str
    account_number: str | None
    account_name: str | None
    instructions: str | None


class AdminPaymentMethodResponse(PaymentMethodResponse):
    is_active: bool
    sort_order: int
    built_in: bool


class PaymentMethodWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=80)
    account_number: str | None = Field(default=None, max_length=60)
    account_name: str | None = Field(default=None, max_length=120)
    instructions: str | None = Field(default=None, max_length=1200)
    is_active: bool = True
    sort_order: int = Field(default=10, ge=0, le=999)


def _public(db: Session, method: PaymentMethod) -> PaymentMethodResponse:
    details = svc.intent_details(db, method.code)
    return PaymentMethodResponse(
        code=method.code,
        name=method.name,
        kind=method.kind,
        account_number=details["account_number"],
        account_name=details["account_name"],
        instructions=details["instructions"],
    )


def _admin(method: PaymentMethod) -> AdminPaymentMethodResponse:
    return AdminPaymentMethodResponse(
        code=method.code,
        name=method.name,
        kind=method.kind,
        account_number=method.account_number,
        account_name=method.account_name,
        instructions=method.instructions,
        is_active=bool(method.is_active),
        sort_order=method.sort_order,
        built_in=method.code in svc.BUILT_IN,
    )


def _audit(db: Session, request: Request, admin: User, event: str, method: PaymentMethod) -> None:
    append_audit_log(
        db,
        event_type=event,
        actor=admin,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="payment_method",
        entity_id=method.code,
        details={"name": method.name, "is_active": bool(method.is_active)},
    )


@router.get("/payment-methods", response_model=list[PaymentMethodResponse])
def list_payment_methods(db: Annotated[Session, Depends(get_db)]) -> list[PaymentMethodResponse]:
    return [_public(db, method) for method in svc.list_methods(db)]


@router.get("/admin/finance/payment-methods", response_model=list[AdminPaymentMethodResponse])
def admin_list_payment_methods(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> list[AdminPaymentMethodResponse]:
    _require_finance_pin(request, admin_user)
    return [_admin(method) for method in svc.list_methods(db, active_only=False)]


@router.post("/admin/finance/payment-methods", response_model=AdminPaymentMethodResponse, status_code=201)
def admin_create_payment_method(
    payload: PaymentMethodWrite,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminPaymentMethodResponse:
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    if not payload.account_number:
        raise ValidationDomainError("Indiquez le numéro sur lequel les clients doivent payer.")
    method = PaymentMethod(
        code=svc.new_code(db, payload.name),
        name=payload.name,
        kind="manual",
        account_number=payload.account_number,
        account_name=payload.account_name or None,
        instructions=payload.instructions or None,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(method)
    db.flush()
    _audit(db, request, admin_user, "admin_payment_method_created", method)
    db.commit()
    return _admin(method)


@router.put("/admin/finance/payment-methods/{code}", response_model=AdminPaymentMethodResponse)
def admin_update_payment_method(
    code: str,
    payload: PaymentMethodWrite,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminPaymentMethodResponse:
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    svc.ensure_defaults(db)
    method = db.get(PaymentMethod, code)
    if method is None:
        raise NotFoundError("Moyen de paiement introuvable.")
    method.name = payload.name
    method.account_number = payload.account_number or None
    method.account_name = payload.account_name or None
    method.instructions = payload.instructions or None
    method.is_active = payload.is_active
    method.sort_order = payload.sort_order
    if not svc.list_methods_after_change_has_active(db):
        raise ValidationDomainError("Gardez au moins un moyen de paiement actif.")
    _audit(db, request, admin_user, "admin_payment_method_updated", method)
    db.commit()
    return _admin(method)


@router.delete("/admin/finance/payment-methods/{code}", status_code=204, response_model=None)
def admin_delete_payment_method(
    code: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> None:
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    if code in svc.BUILT_IN:
        raise ValidationDomainError("Nita et Amana se désactivent, ils ne se suppriment pas.")
    method = db.get(PaymentMethod, code)
    if method is None:
        raise NotFoundError("Moyen de paiement introuvable.")
    _audit(db, request, admin_user, "admin_payment_method_deleted", method)
    db.delete(method)
    db.commit()
