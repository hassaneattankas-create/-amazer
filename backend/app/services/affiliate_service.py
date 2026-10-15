"""Affiliation : code personnel, attribution de la vente et commission."""

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.affiliate import AffiliateAccount
from app.services.seller_finance_service import get_or_create_global_settings

# Sans 0/O ni 1/I : un code facile a dicter au telephone.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def affiliate_percent(db: Session) -> float:
    value = float(getattr(get_or_create_global_settings(db), "affiliate_commission_percent", 3) or 0)
    return min(max(value, 0.0), 50.0)


def _new_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(6))


def ensure_affiliate_account(db: Session, user_id: str) -> AffiliateAccount:
    account = db.get(AffiliateAccount, user_id)
    if account is not None:
        return account
    for _ in range(10):
        code = _new_code()
        if db.scalar(select(AffiliateAccount.user_id).where(AffiliateAccount.code == code)) is None:
            account = AffiliateAccount(user_id=user_id, code=code)
            db.add(account)
            db.flush()
            return account
    raise RuntimeError("Impossible de generer un code d'affiliation unique")


def resolve_affiliate(db: Session, code: str | None, buyer_id: str) -> str | None:
    """Affilie a remunerer pour cette commande, ou None (code inconnu, ou achat pour soi-meme)."""
    if not code:
        return None
    account = db.scalar(select(AffiliateAccount).where(AffiliateAccount.code == code.strip().upper()))
    if account is None or account.user_id == buyer_id:
        return None
    return account.user_id


def affiliate_commission(base_amount: float, percent: float) -> float:
    return round(max(base_amount, 0.0) * percent / 100, 2)
