"""Affiliation : code personnel, parrainage, part d'abonnement et bonus nouveau client.

Deux facons de gagner, sans jamais prendre sur les ventes des vendeurs :
- vendeur ou revendeur amene : une part de chaque abonnement valide (argent deja encaisse), pendant N mois ;
- nouveau client amene : un bonus fixe sur sa premiere commande, acquis a la livraison.
"""

import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.affiliate import AffiliateAccount, AffiliateEarning, AffiliateReferral
from app.models.order import Order
from app.services.seller_finance_service import get_or_create_global_settings

# Sans 0/O ni 1/I : un code facile a dicter au telephone.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CANCELLED = "annulee"


def affiliate_terms(db: Session) -> tuple[float, int, float]:
    """(part des abonnements en %, duree en mois, bonus par nouveau client en XOF)."""
    settings = get_or_create_global_settings(db)
    percent = min(max(float(getattr(settings, "affiliate_seller_share_percent", 20) or 0), 0.0), 90.0)
    months = max(int(getattr(settings, "affiliate_seller_share_months", 12) or 12), 1)
    bonus = max(float(getattr(settings, "affiliate_customer_bonus", 250) or 0), 0.0)
    return percent, months, bonus


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


def resolve_affiliate(db: Session, code: str | None, user_id: str) -> str | None:
    """Affilie correspondant au code, ou None (code inconnu, ou c'est la personne elle-meme)."""
    if not code:
        return None
    account = db.scalar(select(AffiliateAccount).where(AffiliateAccount.code == code.strip().upper()))
    if account is None or account.user_id == user_id:
        return None
    return account.user_id


def record_referral(db: Session, referred_user_id: str, code: str | None) -> bool:
    """A l'inscription : rattache le nouveau membre a l'affilie dont il a suivi le lien."""
    affiliate_id = resolve_affiliate(db, code, referred_user_id)
    if affiliate_id is None or db.get(AffiliateReferral, referred_user_id) is not None:
        return False
    db.add(AffiliateReferral(referred_user_id=referred_user_id, affiliate_user_id=affiliate_id))
    return True


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def credit_subscription_share(db: Session, payer_user_id: str, amount: float, reference: str) -> AffiliateEarning | None:
    """Abonnement valide d'un vendeur/revendeur parraine : l'affilie recoit sa part (une seule fois par paiement)."""
    referral = db.get(AffiliateReferral, payer_user_id)
    if referral is None or amount <= 0:
        return None
    percent, months, _bonus = affiliate_terms(db)
    if percent <= 0 or datetime.now(UTC) > _aware(referral.created_at) + timedelta(days=30 * months):
        return None
    if db.scalar(select(AffiliateEarning.id).where(AffiliateEarning.reference == reference)) is not None:
        return None
    earning = AffiliateEarning(
        affiliate_user_id=referral.affiliate_user_id,
        kind="seller_subscription",
        reference=reference,
        amount=round(amount * percent / 100, 2),
    )
    db.add(earning)
    return earning


def customer_bonus_for_order(db: Session, buyer_id: str, code: str | None) -> tuple[str | None, float]:
    """Bonus nouveau client : seulement pour la premiere commande du client (hors commandes annulees)."""
    _percent, _months, bonus = affiliate_terms(db)
    if bonus <= 0:
        return None, 0.0
    referral = db.get(AffiliateReferral, buyer_id)
    affiliate_id = resolve_affiliate(db, code, buyer_id) or (referral.affiliate_user_id if referral else None)
    if affiliate_id is None:
        return None, 0.0
    previous = db.scalar(select(Order.id).where(Order.user_id == buyer_id, Order.status != CANCELLED).limit(1))
    if previous is not None:
        return None, 0.0
    return affiliate_id, bonus
