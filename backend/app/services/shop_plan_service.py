"""Formule gratuite des boutiques (decision du proprietaire, 2026-11-13).

- Boutique (activity_type « shop », hors Premium) sans abonnement en cours : elle RESTE visible et peut
  vendre, mais au plus `free_plan_max_products` produits visibles (5 par defaut). AMAZER retient
  `free_plan_commission_rate` (5 %) sur chaque vente, avant de reverser le commercant.
- Abonnement Boutique en cours (y compris les 14 jours d'essai) : produits illimites (limite habituelle
  des comptes hors Premium), 0 % de commission.
- Restaurants et Premium : abonnement obligatoire, fonctionnement inchange (hors ligne a l'echeance).

Les produits en trop ne sont jamais supprimes : ils sont desactives sans etre marques « en pause »
par le vendeur, et `reactivate_vendor_listings` les remet en ligne des que l'abonnement est paye.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ValidationDomainError
from app.models.global_settings import GlobalSettings
from app.models.product import Price
from app.models.seller_profile import SellerProfile
from app.models.vendor import Vendor

DEFAULT_MAX_PRODUCTS = 5
DEFAULT_COMMISSION_RATE = 0.05


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def is_shop(profile: SellerProfile | None) -> bool:
    """Boutique classique : seule formule qui a une version gratuite."""
    if profile is None:
        return False
    return (profile.activity_type or "shop") == "shop" and (profile.storefront_tier or "").strip().lower() != "premium"


def has_paid_access(profile: SellerProfile | None, now: datetime | None = None) -> bool:
    """Abonnement (ou essai) en cours."""
    if profile is None or profile.onboarding_fee_paid_at is None:
        return False
    until = _aware(profile.subscription_paid_until)
    return until is not None and until > (now or datetime.now(UTC))


def is_free_plan(profile: SellerProfile | None, now: datetime | None = None) -> bool:
    """Boutique inscrite, sans abonnement en cours : visible, limitee, commission retenue."""
    return is_shop(profile) and profile is not None and profile.onboarding_fee_paid_at is not None and not has_paid_access(profile, now)


def can_operate(profile: SellerProfile | None, now: datetime | None = None) -> bool:
    """Le vendeur peut gerer sa boutique et vendre : abonne, ou boutique en formule gratuite."""
    return has_paid_access(profile, now) or is_free_plan(profile, now)


def free_plan_clause():
    """SQL : boutique inscrite (hors Premium et restaurants), visible meme sans abonnement en cours."""
    return and_(
        SellerProfile.onboarding_fee_paid_at.isnot(None),
        or_(SellerProfile.activity_type.is_(None), SellerProfile.activity_type == "shop"),
        or_(SellerProfile.storefront_tier.is_(None), func.lower(SellerProfile.storefront_tier) != "premium"),
    )


def _settings(db: Session) -> GlobalSettings | None:
    return db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))


def max_free_products(db: Session) -> int:
    value = getattr(_settings(db), "free_plan_max_products", None)
    return max(1, min(int(value), 500)) if value is not None else DEFAULT_MAX_PRODUCTS


def free_commission_rate(db: Session) -> float:
    value = getattr(_settings(db), "free_plan_commission_rate", None)
    rate = float(value) if value is not None else DEFAULT_COMMISSION_RATE
    return max(0.0, min(rate, 0.5))


def commission_rate_for(db: Session, profile: SellerProfile | None, now: datetime | None = None) -> float:
    """Commission retenue au vendeur sur une vente (figee a la commande) : seulement en formule gratuite."""
    return free_commission_rate(db) if is_free_plan(profile, now) else 0.0


def visible_count(db: Session, vendor_id: str) -> int:
    return int(
        db.scalar(select(func.count()).select_from(Price).where(Price.vendor_id == vendor_id, Price.is_active.is_(True)))
        or 0
    )


def ensure_free_slot(db: Session, profile: SellerProfile, now: datetime | None = None) -> None:
    """Avant de mettre un produit en ligne : en formule gratuite, pas plus de N produits visibles."""
    if not is_free_plan(profile, now):
        return
    limit = max_free_products(db)
    if visible_count(db, profile.vendor_id) >= limit:
        raise ValidationDomainError(
            f"Formule gratuite : {limit} produits visibles au maximum. Masquez un produit pour en afficher un autre, "
            "ou prenez l'abonnement Boutique pour publier sans limite et sans commission."
        )


def _is_seller_choice(price: Price) -> bool:
    specs = (price.product.specs if price.product is not None else None) or {}
    return bool(specs.get("seller_paused") or specs.get("seller_deleted"))


def apply_free_plan(db: Session, profile: SellerProfile) -> tuple[int, int]:
    """Boutique passee en formule gratuite : reste en ligne avec au plus N produits visibles.

    Garde les plus recemment modifies ; complete jusqu'a N avec ceux que la formule avait mis de cote
    (jamais ceux que le vendeur a mis en pause ou supprimes, ni ceux masques par AMAZER).
    Renvoie (produits mis de cote, produits remis en ligne). Le commit est fait par l'appelant.
    """
    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None and not vendor.is_active:
        vendor.is_active = True
    limit = max_free_products(db)
    prices = db.scalars(
        select(Price)
        .options(selectinload(Price.product))
        .where(Price.vendor_id == profile.vendor_id)
        .order_by(Price.updated_at.desc().nullslast(), Price.created_at.desc())
    ).all()
    visible = [p for p in prices if p.is_active]
    hidden = 0
    for price in visible[limit:]:
        price.is_active = False
        hidden += 1
    restored = 0
    room = limit - min(len(visible), limit)
    for price in prices:
        if room <= 0:
            break
        if price.is_active or price.hidden_by_admin or _is_seller_choice(price):
            continue
        price.is_active = True
        room -= 1
        restored += 1
    return hidden, restored


def plan_summary(db: Session, profile: SellerProfile, now: datetime | None = None) -> dict[str, object]:
    """Ce que le vendeur doit savoir de sa formule (espace vendeur)."""
    free = is_free_plan(profile, now)
    return {
        "plan": "free" if free else ("subscribed" if has_paid_access(profile, now) else "inactive"),
        "eligible_free_plan": is_shop(profile),
        "max_visible_products": max_free_products(db) if free else None,
        "visible_products": visible_count(db, profile.vendor_id),
        "commission_rate": free_commission_rate(db) if free else 0.0,
        "free_plan_commission_rate": free_commission_rate(db),
        "free_plan_max_products": max_free_products(db),
    }


def price_fulfillments(db: Session, order: object, now: datetime | None = None) -> None:
    """A la creation d'une commande : part de chaque boutique (prix boutique x quantite) et commission figee.

    La marge d'un revendeur n'entre pas dans la part de la boutique (elle est suivie a part).
    """
    totals: dict[str, float] = {}
    for item in getattr(order, "items", []) or []:
        totals[item.vendor_id] = totals.get(item.vendor_id, 0.0) + float(item.unit_price or 0) * int(item.quantity or 0)
    if not totals:
        return
    profiles = {
        p.vendor_id: p for p in db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_(list(totals)))).all()
    }
    for row in getattr(order, "fulfillments", []) or []:
        amount = round(totals.get(row.vendor_id, 0.0), 2)
        rate = commission_rate_for(db, profiles.get(row.vendor_id), now)
        row.vendor_amount = amount
        row.commission_rate = rate
        row.commission_amount = round(amount * rate, 2)
        row.payout_status = "pending"
