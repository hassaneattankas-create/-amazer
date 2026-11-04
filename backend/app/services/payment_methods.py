"""Moyens de paiement : Nita et Amana d'origine, plus ceux ajoutes par l'admin."""

from __future__ import annotations

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationDomainError
from app.models.global_settings import GlobalSettings
from app.models.payment_method import PaymentMethod

BUILT_IN = ("nita", "amana")
CODE_PATTERN = r"^[a-z0-9-]{2,30}$"
UNAVAILABLE = "Ce moyen de paiement n'est plus disponible. Choisissez-en un autre."


def wallet_phone(db: Session) -> str | None:
    """Numero AMAZER general (reglage historique), utilise si le moyen n'a pas son propre numero."""
    row = db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))
    if row is None:
        return None
    return (row.platform_wallet_phone or "").strip() or (row.support_phone or "").strip() or None


def ensure_defaults(db: Session) -> None:
    """Cree Nita et Amana au premier usage : ils restent modifiables, mais pas supprimables."""
    existing = set(db.scalars(select(PaymentMethod.code)).all())
    if "nita" not in existing:
        db.add(PaymentMethod(code="nita", name="Nita Transfert", kind="manual", sort_order=0))
    if "amana" not in existing:
        db.add(PaymentMethod(code="amana", name="Amana Transfert", kind="amana", sort_order=1))
    if not {"nita", "amana"} <= existing:
        db.commit()


def list_methods(db: Session, *, active_only: bool = True) -> list[PaymentMethod]:
    ensure_defaults(db)
    stmt = select(PaymentMethod).order_by(PaymentMethod.sort_order, PaymentMethod.created_at)
    if active_only:
        stmt = stmt.where(PaymentMethod.is_active.is_(True))
    return list(db.scalars(stmt).all())


def list_methods_after_change_has_active(db: Session) -> bool:
    db.flush()
    return bool(db.scalar(select(PaymentMethod.code).where(PaymentMethod.is_active.is_(True)).limit(1)))


def require_active_method(db: Session, code: str) -> PaymentMethod:
    """Refuse un moyen inconnu ou desactive au moment de payer."""
    ensure_defaults(db)
    method = db.get(PaymentMethod, (code or "").strip().lower())
    if method is None or not method.is_active:
        raise ValidationDomainError(UNAVAILABLE)
    return method


def new_code(db: Session, name: str) -> str:
    """Code stable tire du nom : « Moov Money » donne « moov-money »."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    base = re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")[:24] or "moyen"
    if len(base) < 2:
        base = f"moyen-{base}"
    code, rank = base, 2
    while db.get(PaymentMethod, code) is not None:
        code, rank = f"{base}-{rank}", rank + 1
    return code


def intent_details(db: Session, code: str) -> dict[str, str | None]:
    """Ce que le client doit voir pour payer. Fonctionne aussi pour un moyen desactive depuis la commande."""
    ensure_defaults(db)
    method = db.get(PaymentMethod, code)
    fallback = wallet_phone(db)
    if method is None:
        return {"method_name": (code or "").upper() or None, "method_kind": "manual", "account_number": fallback, "account_name": None, "instructions": None}
    return {
        "method_name": method.name,
        "method_kind": method.kind,
        "account_number": (method.account_number or "").strip() or fallback,
        "account_name": (method.account_name or "").strip() or None,
        "instructions": (method.instructions or "").strip() or None,
    }
