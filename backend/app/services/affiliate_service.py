"""Affiliation et ambassadeurs : code personnel, parrainage, registre des gains, anti-fraude, paiements.

Deux facons de gagner, sans jamais prendre sur les ventes des vendeurs ni payer au clic :
- vendeur ou revendeur amene : une part de chaque abonnement valide (argent deja encaisse), pendant N mois ;
  ambassadeur : prime sur le 1er mois, puis pourcentage par palier (nombre de boutiques payantes) ;
- nouveau client amene : un bonus fixe sur sa premiere commande, acquis a la livraison.

Securite : chaque gain attend un delai avant d'etre payable ; un signal de fraude le bloque (« review »)
jusqu'a la decision de l'admin ; l'auto-parrainage (meme personne, meme appareil, meme numero) est refuse.
Tous les taux et seuils se reglent dans Admin > Tarifs.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.phone import normalize_phone
from app.models.affiliate import (
    AffiliateAccount,
    AffiliateEarning,
    AffiliatePayout,
    AffiliateReferral,
)
from app.models.order import Order
from app.models.user import User
from app.services.seller_finance_service import get_or_create_global_settings

# Sans 0/O ni 1/I : un code facile a dicter au telephone.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CANCELLED = "annulee"
DELIVERED = ("recu", "CLAIMED")
NEW_ACCOUNT_DAYS = 90
PAYOUT_METHODS = ("nita", "amana", "airtel", "moov")
# Gains qui comptent dans les soldes (tout sauf annule).
LIVE_STATUSES = ("pending", "review", "available", "requested", "paid")


@dataclass(frozen=True)
class AffiliateTerms:
    seller_share_percent: float
    seller_share_months: int
    customer_bonus: float
    hold_days: int
    min_payout: float
    new_account_monthly_cap: float
    max_referrals_per_day: int
    ambassador_first_month_percent: float
    ambassador_tier2_shops: int
    ambassador_tier2_percent: float
    ambassador_tier3_shops: int
    ambassador_tier3_percent: float
    ambassador_monthly_top_bonus: float


def _num(settings: object, name: str, default: float, low: float = 0.0, high: float = 1e9) -> float:
    value = getattr(settings, name, default)
    return min(max(float(default if value is None else value), low), high)


def load_terms(db: Session) -> AffiliateTerms:
    s = get_or_create_global_settings(db)
    return AffiliateTerms(
        seller_share_percent=_num(s, "affiliate_seller_share_percent", 20, 0, 90),
        seller_share_months=int(_num(s, "affiliate_seller_share_months", 12, 1, 120)),
        customer_bonus=_num(s, "affiliate_customer_bonus", 250),
        hold_days=int(_num(s, "affiliate_hold_days", 30, 0, 180)),
        min_payout=_num(s, "affiliate_min_payout", 2000),
        new_account_monthly_cap=_num(s, "affiliate_new_account_monthly_cap", 25000),
        max_referrals_per_day=int(_num(s, "affiliate_max_referrals_per_day", 15, 1, 10000)),
        ambassador_first_month_percent=_num(s, "ambassador_first_month_percent", 50, 0, 100),
        ambassador_tier2_shops=int(_num(s, "ambassador_tier2_shops", 10, 1, 100000)),
        ambassador_tier2_percent=_num(s, "ambassador_tier2_percent", 25, 0, 90),
        ambassador_tier3_shops=int(_num(s, "ambassador_tier3_shops", 25, 1, 100000)),
        ambassador_tier3_percent=_num(s, "ambassador_tier3_percent", 30, 0, 90),
        ambassador_monthly_top_bonus=_num(s, "ambassador_monthly_top_bonus", 10000),
    )


def affiliate_terms(db: Session) -> tuple[float, int, float]:
    """(part des abonnements en %, duree en mois, bonus par nouveau client en XOF)."""
    terms = load_terms(db)
    return terms.seller_share_percent, terms.seller_share_months, terms.customer_bonus


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def fingerprint(value: str | None) -> str | None:
    """Empreinte non reversible d'une IP ou d'un identifiant d'appareil (on ne stocke jamais la valeur brute)."""
    raw = (value or "").strip()
    if not raw or len(raw) > 200:
        return None
    key = get_settings().jwt_secret_key.encode()
    return hmac.new(key, raw.encode(), hashlib.sha256).hexdigest()[:48]


def request_fingerprints(request: object) -> tuple[str | None, str | None]:
    """(empreinte IP, empreinte appareil) d'une requete HTTP. L'appareil vient de l'en-tete X-Device-Id."""
    from app.core.rate_limit import client_ip

    headers = getattr(request, "headers", {}) or {}
    return fingerprint(client_ip(request)), fingerprint(headers.get("x-device-id"))  # type: ignore[arg-type]


# ---------------------------------------------------------------- comptes

def _new_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(6))


def ensure_affiliate_account(db: Session, user_id: str) -> AffiliateAccount:
    account = db.get(AffiliateAccount, user_id)
    if account is not None:
        return account
    for _ in range(10):
        code = _new_code()
        if db.scalar(select(AffiliateAccount.user_id).where(AffiliateAccount.code == code)) is None:
            account = AffiliateAccount(user_id=user_id, code=code, tier="affiliate", status="active", click_count=0)
            db.add(account)
            db.flush()
            return account
    raise RuntimeError("Impossible de generer un code d'affiliation unique")


def remember_affiliate_device(account: AffiliateAccount, device_hash: str | None, ip_hash: str | None) -> None:
    """Retient l'appareil et la connexion de l'affilie (sert a reperer qu'il se parraine lui-meme)."""
    if device_hash:
        account.device_hash = device_hash
    if ip_hash:
        account.last_ip_hash = ip_hash


def resolve_affiliate(db: Session, code: str | None, user_id: str) -> str | None:
    """Affilie actif correspondant au code, ou None (code inconnu, compte suspendu, ou la personne elle-meme)."""
    if not code:
        return None
    account = db.scalar(select(AffiliateAccount).where(AffiliateAccount.code == code.strip().upper()))
    if account is None or account.user_id == user_id or getattr(account, "status", "active") != "active":
        return None
    return account.user_id


def _same_phone(db: Session, user_a: str, user_b: str) -> bool:
    a, b = db.get(User, user_a), db.get(User, user_b)
    phone_a = normalize_phone(getattr(a, "whatsapp_phone", None) or "") if a else ""
    phone_b = normalize_phone(getattr(b, "whatsapp_phone", None) or "") if b else ""
    return bool(phone_a) and phone_a == phone_b


# ---------------------------------------------------------------- parrainage

def record_referral(
    db: Session,
    referred_user_id: str,
    code: str | None,
    *,
    ip_hash: str | None = None,
    device_hash: str | None = None,
) -> bool:
    """A l'inscription : rattache le nouveau membre a l'affilie dont il a suivi le lien.

    Refuse : meme appareil que l'affilie (auto-parrainage). Signale (gains a verifier) :
    plusieurs inscriptions depuis la meme connexion, ou trop d'inscriptions dans la journee.
    """
    affiliate_id = resolve_affiliate(db, code, referred_user_id)
    if affiliate_id is None or db.get(AffiliateReferral, referred_user_id) is not None:
        return False
    account = db.get(AffiliateAccount, affiliate_id)
    if account is not None and device_hash and account.device_hash == device_hash:
        return False
    terms = load_terms(db)
    since = _now() - timedelta(hours=24)
    flags: list[str] = []
    if ip_hash:
        same_ip = db.scalar(
            select(func.count()).select_from(AffiliateReferral).where(
                AffiliateReferral.affiliate_user_id == affiliate_id,
                AffiliateReferral.ip_hash == ip_hash,
                AffiliateReferral.created_at >= since,
            )
        ) or 0
        if same_ip >= 2:
            flags.append("plusieurs inscriptions depuis la même connexion")
        if account is not None and account.last_ip_hash == ip_hash:
            flags.append("même connexion que l'affilié")
    today = db.scalar(
        select(func.count()).select_from(AffiliateReferral).where(
            AffiliateReferral.affiliate_user_id == affiliate_id, AffiliateReferral.created_at >= since
        )
    ) or 0
    if today >= terms.max_referrals_per_day:
        flags.append("trop d'inscriptions en 24 h")
    db.add(
        AffiliateReferral(
            referred_user_id=referred_user_id,
            affiliate_user_id=affiliate_id,
            ip_hash=ip_hash,
            device_hash=device_hash,
            flag="; ".join(flags) or None,
        )
    )
    return True


# ---------------------------------------------------------------- registre des gains

def _paying_shops(db: Session, affiliate_id: str) -> int:
    """Nombre de vendeurs/revendeurs amenes qui ont deja paye au moins un abonnement."""
    return int(
        db.scalar(
            select(func.count(func.distinct(AffiliateEarning.source_user_id))).where(
                AffiliateEarning.affiliate_user_id == affiliate_id,
                AffiliateEarning.kind == "seller_subscription",
                AffiliateEarning.status != "cancelled",
            )
        )
        or 0
    )


def ambassador_percent(terms: AffiliateTerms, paying_shops: int) -> float:
    """Palier de l'ambassadeur selon ses boutiques payantes."""
    if paying_shops >= terms.ambassador_tier3_shops:
        return terms.ambassador_tier3_percent
    if paying_shops >= terms.ambassador_tier2_shops:
        return terms.ambassador_tier2_percent
    return terms.seller_share_percent


def _month_total(db: Session, affiliate_id: str) -> float:
    start = _now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return float(
        db.scalar(
            select(func.coalesce(func.sum(AffiliateEarning.amount), 0)).where(
                AffiliateEarning.affiliate_user_id == affiliate_id,
                AffiliateEarning.status != "cancelled",
                AffiliateEarning.created_at >= start,
            )
        )
        or 0
    )


def _add_earning(
    db: Session,
    *,
    account: AffiliateAccount | None,
    affiliate_id: str,
    kind: str,
    reference: str,
    amount: float,
    source_user_id: str | None,
    percent: float | None = None,
    flags: list[str] | None = None,
) -> AffiliateEarning | None:
    """Ajoute un gain au registre avec le bon statut (delai, verification, annulation)."""
    if amount <= 0 or db.scalar(select(AffiliateEarning.id).where(AffiliateEarning.reference == reference)) is not None:
        return None
    terms = load_terms(db)
    reasons = list(flags or [])
    status = "pending"
    if account is not None and account.status != "active":
        status, reasons = "cancelled", ["compte affilié suspendu"]
    elif account is not None and account.created_at is not None:
        young = _now() - _aware(account.created_at) < timedelta(days=NEW_ACCOUNT_DAYS)
        if young and terms.new_account_monthly_cap > 0 and _month_total(db, affiliate_id) + amount > terms.new_account_monthly_cap:
            reasons.append("plafond mensuel des nouveaux comptes dépassé")
    if status != "cancelled" and reasons:
        status = "review"
    earning = AffiliateEarning(
        affiliate_user_id=affiliate_id,
        kind=kind,
        reference=reference,
        amount=round(amount, 2),
        status=status,
        source_user_id=source_user_id,
        percent=percent,
        note="; ".join(reasons) or None,
        available_at=_now() + timedelta(days=terms.hold_days),
    )
    db.add(earning)
    db.flush()
    return earning


def credit_subscription_share(
    db: Session, payer_user_id: str, amount: float, reference: str, months: int = 1
) -> AffiliateEarning | None:
    """Abonnement valide d'un vendeur/revendeur parraine : l'affilie recoit sa part (une seule fois par paiement)."""
    referral = db.get(AffiliateReferral, payer_user_id)
    if referral is None or amount <= 0:
        return None
    terms = load_terms(db)
    if datetime.now(UTC) > _aware(referral.created_at) + timedelta(days=30 * terms.seller_share_months):
        return None
    account = db.get(AffiliateAccount, referral.affiliate_user_id)
    months = max(int(months or 1), 1)
    if account is not None and account.tier == "ambassador":
        percent = ambassador_percent(terms, _paying_shops(db, referral.affiliate_user_id))
        first = db.scalar(
            select(AffiliateEarning.id).where(
                AffiliateEarning.source_user_id == payer_user_id,
                AffiliateEarning.kind == "seller_subscription",
                AffiliateEarning.status != "cancelled",
            ).limit(1)
        ) is None
        if first:
            # Prime de demarrage sur UN mois seulement ; les autres mois du meme paiement au taux du palier.
            one_month = amount / months
            share = one_month * terms.ambassador_first_month_percent / 100 + (amount - one_month) * percent / 100
            percent = round(share / amount * 100, 2)
        else:
            share = amount * percent / 100
    else:
        percent = terms.seller_share_percent
        share = amount * percent / 100
    if percent <= 0:
        return None
    flags = [referral.flag] if referral.flag else []
    if _same_phone(db, referral.affiliate_user_id, payer_user_id):
        flags.append("même numéro que l'affilié")
    return _add_earning(
        db,
        account=account,
        affiliate_id=referral.affiliate_user_id,
        kind="seller_subscription",
        reference=reference,
        amount=share,
        source_user_id=payer_user_id,
        percent=percent,
        flags=flags,
    )


def customer_bonus_for_order(
    db: Session, buyer_id: str, code: str | None, device_hash: str | None = None
) -> tuple[str | None, float]:
    """Bonus nouveau client : seulement pour la premiere commande du client (hors commandes annulees)."""
    _percent, _months, bonus = affiliate_terms(db)
    if bonus <= 0:
        return None, 0.0
    referral = db.get(AffiliateReferral, buyer_id)
    affiliate_id = resolve_affiliate(db, code, buyer_id) or (referral.affiliate_user_id if referral else None)
    if affiliate_id is None:
        return None, 0.0
    if device_hash:
        account = db.get(AffiliateAccount, affiliate_id)
        if account is not None and account.device_hash == device_hash:
            return None, 0.0  # l'affilie commande pour lui-meme depuis son telephone
    previous = db.scalar(select(Order.id).where(Order.user_id == buyer_id, Order.status != CANCELLED).limit(1))
    if previous is not None:
        return None, 0.0
    return affiliate_id, bonus


def credit_customer_bonus(db: Session, order: Order) -> AffiliateEarning | None:
    """A la livraison : le bonus reserve sur la commande entre au registre (avec delai et controles)."""
    affiliate_id = getattr(order, "affiliate_user_id", None)
    amount = float(getattr(order, "affiliate_commission", 0) or 0)
    if not affiliate_id or amount <= 0:
        return None
    account = db.get(AffiliateAccount, affiliate_id)
    flags: list[str] = []
    referral = db.get(AffiliateReferral, order.user_id)
    if referral is not None and referral.affiliate_user_id == affiliate_id and referral.flag:
        flags.append(referral.flag)
    affiliate = db.get(User, affiliate_id)
    affiliate_phone = normalize_phone(getattr(affiliate, "whatsapp_phone", None) or "") if affiliate else ""
    if affiliate_phone and normalize_phone(order.delivery_phone or "") == affiliate_phone:
        flags.append("livrée au numéro de l'affilié")
    if _same_phone(db, affiliate_id, order.user_id):
        flags.append("même numéro que l'affilié")
    return _add_earning(
        db,
        account=account,
        affiliate_id=affiliate_id,
        kind="customer_bonus",
        reference=f"order-bonus:{order.id}",
        amount=amount,
        source_user_id=order.user_id,
        flags=flags,
    )


def mature_earnings(db: Session, affiliate_id: str | None = None) -> int:
    """Delai ecoule : « pending » -> « available », apres un dernier controle (commande annulee, compte ferme)."""
    query = select(AffiliateEarning).where(AffiliateEarning.status == "pending", AffiliateEarning.available_at <= _now())
    if affiliate_id:
        query = query.where(AffiliateEarning.affiliate_user_id == affiliate_id)
    changed = 0
    for earning in db.scalars(query).all():
        account = db.get(AffiliateAccount, earning.affiliate_user_id)
        if account is not None and account.status != "active":
            earning.status, earning.note = "cancelled", "compte affilié suspendu"
        elif earning.kind == "customer_bonus" and earning.reference.startswith("order-bonus:"):
            order = db.get(Order, earning.reference.split(":", 1)[1])
            if order is None or order.status == CANCELLED:
                earning.status, earning.note = "cancelled", "commande annulée"
            else:
                earning.status = "available"
        elif earning.source_user_id:
            source = db.get(User, earning.source_user_id)
            if source is None or not source.is_active:
                earning.status, earning.note = "review", "compte parrainé fermé ou suspendu"
            else:
                earning.status = "available"
        else:
            earning.status = "available"
        changed += 1
    if changed:
        db.flush()
    return changed


# ---------------------------------------------------------------- soldes et paiements

@dataclass
class Balances:
    in_progress: float  # bonus clients reserves sur des commandes pas encore livrees
    on_hold: float  # delai de securite en cours
    review: float  # bloque, a verifier par AMAZER
    available: float
    requested: float
    paid: float
    from_sellers: float
    from_customers: float
    from_bonus: float
    orders_delivered: int
    orders_pending: int


def balances(db: Session, affiliate_id: str) -> Balances:
    rows = db.execute(
        select(AffiliateEarning.status, AffiliateEarning.kind, func.coalesce(func.sum(AffiliateEarning.amount), 0), func.count())
        .where(AffiliateEarning.affiliate_user_id == affiliate_id)
        .group_by(AffiliateEarning.status, AffiliateEarning.kind)
    ).all()
    by_status: dict[str, float] = {}
    by_kind: dict[str, float] = {}
    customer_count = 0
    for status, kind, total, count in rows:
        by_status[status] = by_status.get(status, 0.0) + float(total)
        if status != "cancelled":
            by_kind[kind] = by_kind.get(kind, 0.0) + float(total)
            if kind == "customer_bonus":
                customer_count += int(count)
    pending_orders = db.execute(
        select(func.coalesce(func.sum(Order.affiliate_commission), 0), func.count()).where(
            Order.affiliate_user_id == affiliate_id,
            Order.payment_status == "paid",
            Order.status != CANCELLED,
            Order.status.not_in(DELIVERED),
            Order.affiliate_commission > 0,
        )
    ).one()
    r = lambda key: round(by_status.get(key, 0.0), 2)  # noqa: E731
    return Balances(
        in_progress=round(float(pending_orders[0] or 0), 2),
        on_hold=r("pending"),
        review=r("review"),
        available=r("available"),
        requested=r("requested"),
        paid=r("paid"),
        from_sellers=round(by_kind.get("seller_subscription", 0.0), 2),
        from_customers=round(by_kind.get("customer_bonus", 0.0), 2),
        from_bonus=round(by_kind.get("bonus", 0.0), 2),
        orders_delivered=customer_count,
        orders_pending=int(pending_orders[1] or 0),
    )


class PayoutError(ValueError):
    """Demande de paiement refusee (message en francais pour l'utilisateur)."""


def request_payout(db: Session, affiliate_id: str, method: str, phone: str) -> AffiliatePayout:
    """Demande le versement de TOUT le solde disponible (une seule demande ouverte a la fois)."""
    account = db.get(AffiliateAccount, affiliate_id)
    if account is None or account.status != "active":
        raise PayoutError("Votre compte affilié est suspendu. Contactez AMAZER.")
    if method not in PAYOUT_METHODS:
        raise PayoutError("Choisissez Nita, Amana, Airtel Money ou Moov Money.")
    normalized = normalize_phone(phone)
    if not normalized:
        raise PayoutError("Numéro de téléphone invalide.")
    if db.scalar(
        select(AffiliatePayout.id).where(AffiliatePayout.affiliate_user_id == affiliate_id, AffiliatePayout.status == "requested")
    ):
        raise PayoutError("Vous avez déjà une demande de paiement en cours.")
    mature_earnings(db, affiliate_id)
    earnings = db.scalars(
        select(AffiliateEarning).where(AffiliateEarning.affiliate_user_id == affiliate_id, AffiliateEarning.status == "available")
    ).all()
    total = round(sum(float(e.amount) for e in earnings), 2)
    terms = load_terms(db)
    if total <= 0 or total < terms.min_payout:
        raise PayoutError(f"Le minimum pour demander un paiement est de {int(terms.min_payout)} F.")
    payout = AffiliatePayout(affiliate_user_id=affiliate_id, amount=total, method=method, phone=normalized, status="requested")
    db.add(payout)
    db.flush()
    for earning in earnings:
        earning.status, earning.payout_id = "requested", payout.id
    account.payout_method, account.payout_phone = method, normalized
    return payout


def settle_payout(db: Session, payout: AffiliatePayout, *, admin_id: str, paid: bool, reference: str | None, note: str | None,
                  cancel_earnings: bool = False) -> None:
    """Admin : versement effectue (reference obligatoire) ou refuse (gains rendus disponibles, ou annules si fraude)."""
    if payout.status != "requested":
        raise PayoutError("Cette demande a déjà été traitée.")
    now = _now()
    earnings = db.scalars(select(AffiliateEarning).where(AffiliateEarning.payout_id == payout.id)).all()
    if paid:
        if not (reference or "").strip():
            raise PayoutError("Indiquez la référence de la transaction.")
        payout.status, payout.transaction_reference = "paid", reference.strip()
        for earning in earnings:
            earning.status = "paid"
    else:
        payout.status = "rejected"
        for earning in earnings:
            earning.payout_id = None
            if cancel_earnings:
                earning.status, earning.note = "cancelled", (note or "annulé par AMAZER (fraude)")[:300]
                earning.decided_by_user_id, earning.decided_at = admin_id, now
            else:
                earning.status = "available"
    payout.admin_note = (note or None) and note[:300]
    payout.processed_by_user_id, payout.processed_at = admin_id, now


def decide_earning(db: Session, earning: AffiliateEarning, *, admin_id: str, approve: bool, note: str | None) -> None:
    """Admin : valider un gain bloque (« review ») ou annuler un gain non paye."""
    if earning.status in ("paid", "requested"):
        raise PayoutError("Ce gain est déjà payé ou en cours de paiement.")
    if approve:
        if earning.status not in ("review", "cancelled"):
            raise PayoutError("Seul un gain à vérifier ou annulé peut être validé.")
        due = earning.available_at is None or _aware(earning.available_at) <= _now()
        earning.status = "available" if due else "pending"
    else:
        earning.status = "cancelled"
    if note:
        earning.note = note[:300]
    earning.decided_by_user_id, earning.decided_at = admin_id, _now()


def add_manual_bonus(db: Session, affiliate_id: str, amount: float, reason: str, admin_id: str) -> AffiliateEarning:
    """Admin : prime (ex. meilleur ambassadeur du mois), disponible tout de suite."""
    earning = AffiliateEarning(
        affiliate_user_id=affiliate_id,
        kind="bonus",
        reference=f"bonus:{secrets.token_hex(8)}",
        amount=round(amount, 2),
        status="available",
        note=reason[:300],
        available_at=_now(),
        decided_by_user_id=admin_id,
        decided_at=_now(),
    )
    db.add(earning)
    return earning


def cancel_unpaid(db: Session, affiliate_id: str, reason: str, admin_id: str) -> int:
    """Admin (fraude) : annule tous les gains non payes et les demandes en cours."""
    now = _now()
    for payout in db.scalars(
        select(AffiliatePayout).where(AffiliatePayout.affiliate_user_id == affiliate_id, AffiliatePayout.status == "requested")
    ).all():
        payout.status, payout.admin_note, payout.processed_by_user_id, payout.processed_at = "rejected", reason[:300], admin_id, now
    count = 0
    for earning in db.scalars(
        select(AffiliateEarning).where(
            AffiliateEarning.affiliate_user_id == affiliate_id,
            AffiliateEarning.status.in_(("pending", "review", "available", "requested")),
        )
    ).all():
        earning.status, earning.note, earning.payout_id = "cancelled", reason[:300], None
        earning.decided_by_user_id, earning.decided_at = admin_id, now
        count += 1
    return count


def monthly_leaderboard(db: Session, limit: int = 10) -> list[tuple[str, int, float]]:
    """Ambassadeurs du mois : (user_id, nouvelles boutiques payantes, gains du mois)."""
    start = _now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = db.execute(
        select(
            AffiliateEarning.affiliate_user_id,
            func.count(func.distinct(AffiliateEarning.source_user_id)).filter(AffiliateEarning.kind == "seller_subscription"),
            func.coalesce(func.sum(AffiliateEarning.amount), 0),
        )
        .join(AffiliateAccount, AffiliateAccount.user_id == AffiliateEarning.affiliate_user_id)
        .where(
            AffiliateAccount.tier == "ambassador",
            AffiliateAccount.status == "active",
            AffiliateEarning.status != "cancelled",
            AffiliateEarning.kind != "bonus",
            AffiliateEarning.created_at >= start,
        )
        .group_by(AffiliateEarning.affiliate_user_id)
    ).all()
    ranked = sorted(((uid, int(shops or 0), float(total or 0)) for uid, shops, total in rows), key=lambda r: (-r[1], -r[2]))
    return ranked[:limit]


def backfill_delivered_bonuses(db: Session) -> int:
    """Reprise : bonus clients deja livres (ancien calcul) inscrits au registre, une seule fois."""
    orders = db.scalars(
        select(Order).where(Order.affiliate_user_id.is_not(None), Order.affiliate_commission > 0, Order.status.in_(DELIVERED))
    ).all()
    added = 0
    for order in orders:
        reference = f"order-bonus:{order.id}"
        if db.scalar(select(AffiliateEarning.id).where(AffiliateEarning.reference == reference)) is not None:
            continue
        db.add(
            AffiliateEarning(
                affiliate_user_id=order.affiliate_user_id,
                kind="customer_bonus",
                reference=reference,
                amount=float(order.affiliate_commission),
                status="available",
                source_user_id=order.user_id,
                note="repris de l'ancien calcul",
                available_at=_now(),
            )
        )
        added += 1
    return added
