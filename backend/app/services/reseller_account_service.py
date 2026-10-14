"""Abonnement et commission des revendeurs (revente sans stock)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.reseller import ResellerAccount
from app.services.seller_finance_service import get_or_create_global_settings


def reseller_terms(db: Session) -> tuple[float, float]:
    """(abonnement mensuel en XOF, commission AMAZER en % de la marge), regles par l'admin."""
    settings = get_or_create_global_settings(db)
    fee = float(getattr(settings, "reseller_subscription_fee", 500) or 0)
    percent = float(getattr(settings, "reseller_commission_percent", 10) or 0)
    return fee, min(max(percent, 0.0), 90.0)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def subscription_active(db: Session, user_id: str | None, now: datetime | None = None) -> bool:
    """Actif si l'abonnement est paye (ou en essai) jusqu'a une date future, ou si l'admin l'a rendu gratuit (0 XOF)."""
    if not user_id:
        return False
    fee, _percent = reseller_terms(db)
    if fee <= 0:
        return True
    account = db.get(ResellerAccount, user_id)
    paid_until = _aware(account.paid_until) if account else None
    return paid_until is not None and paid_until > (now or datetime.now(UTC))


def ensure_account(db: Session, user_id: str) -> ResellerAccount:
    """Cree le compte revendeur au premier usage, avec l'essai gratuit vendeur s'il est active."""
    account = db.get(ResellerAccount, user_id)
    if account is not None:
        return account
    settings = get_or_create_global_settings(db)
    trial_days = int(getattr(settings, "seller_trial_days", 0) or 0)
    account = ResellerAccount(
        user_id=user_id,
        paid_until=datetime.now(UTC) + timedelta(days=trial_days) if trial_days > 0 else None,
    )
    db.add(account)
    db.flush()
    return account


def extend_subscription(account: ResellerAccount, months: int, now: datetime | None = None) -> None:
    """Prolonge de 30 jours par mois paye, a partir d'aujourd'hui ou de la fin d'abonnement en cours."""
    current = now or datetime.now(UTC)
    start = max(_aware(account.paid_until) or current, current)
    account.paid_until = start + timedelta(days=30 * max(1, months))


def split_margin(margin: float, percent: float) -> tuple[float, float]:
    """(part AMAZER, part revendeur) arrondies au franc pres."""
    commission = round(max(margin, 0.0) * percent / 100, 2)
    return commission, round(max(margin, 0.0) - commission, 2)
