"""Remise en ligne d'une boutique : seuls les produits que le vendeur avait en vente reviennent.

Une boutique hors ligne (abonnement expire, compte retire) voit tous ses produits desactives.
A la reactivation, on ne rallume pas ceux que l'equipe AMAZER a masques, ni ceux que le vendeur
a supprimes ou mis en pause lui-meme.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.product import Price


def reactivate_vendor_listings(db: Session, vendor_id: str) -> int:
    prices = db.scalars(
        select(Price)
        .options(selectinload(Price.product))
        .where(Price.vendor_id == vendor_id, Price.is_active.is_(False), Price.hidden_by_admin.is_(False))
    ).all()
    restored = 0
    for price in prices:
        specs = (price.product.specs if price.product is not None else None) or {}
        if specs.get("seller_deleted") or specs.get("seller_paused"):
            continue
        price.is_active = True
        restored += 1
    return restored
