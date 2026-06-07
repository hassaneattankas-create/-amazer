from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Price, Product
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor


def active_subscription_clause():
    """Condition SQL: un vendeur n'est visible au public que si son abonnement est paye et
    non expire. Des qu'un abonnement arrive a echeance (peu importe le type), la boutique
    disparait du public et ne revient qu'apres reabonnement. Les vendeurs catalogue sans
    profil vendeur (crees par l'admin) restent toujours visibles."""
    return or_(
        SellerProfile.user_id.is_(None),
        and_(
            SellerProfile.onboarding_fee_paid_at.isnot(None),
            SellerProfile.subscription_paid_until.isnot(None),
            SellerProfile.subscription_paid_until > datetime.now(UTC),
        ),
    )


class CatalogRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_active_categories(self, *, limit: int, offset: int) -> list[Category]:
        stmt = (
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.name.asc())
            .offset(offset)
            .limit(limit)
        )
        return list(self.db.scalars(stmt))

    def list_active_vendors(self, *, limit: int, offset: int, query: str | None = None) -> list[Vendor]:
        stmt = (
            select(Vendor)
            .outerjoin(SellerProfile, SellerProfile.vendor_id == Vendor.id)
            .outerjoin(User, User.id == SellerProfile.user_id)
            .where(Vendor.is_active.is_(True))
            .where(or_(SellerProfile.user_id.is_(None), User.is_active.is_(True)))
            .where(active_subscription_clause())
            .order_by(Vendor.name.asc())
            .offset(offset)
            .limit(limit)
        )
        if query:
            safe = query.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            term = f"%{safe}%"
            stmt = stmt.where(
                or_(
                    Vendor.name.ilike(term, escape="\\"),
                    Vendor.slug.ilike(term, escape="\\"),
                    SellerProfile.business_name.ilike(term, escape="\\"),
                    SellerProfile.city.ilike(term, escape="\\"),
                    SellerProfile.activity_type.ilike(term, escape="\\"),
                )
            )
        return list(self.db.scalars(stmt))

    def list_vendor_storefronts(
        self,
        *,
        limit: int,
        offset: int,
        query: str | None = None,
        activity_type: str | None = None,
        storefront_tier: str | None = None,
    ) -> list[Vendor]:
        stmt = (
            select(Vendor)
            .join(SellerProfile, SellerProfile.vendor_id == Vendor.id)
            .join(User, User.id == SellerProfile.user_id)
            .options(selectinload(Vendor.seller_profile))
            .where(Vendor.is_active.is_(True), User.is_active.is_(True))
            .where(active_subscription_clause())
            .order_by(Vendor.updated_at.desc(), Vendor.name.asc())
            .offset(offset)
            .limit(limit)
        )
        if query:
            safe = query.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            term = f"%{safe}%"
            stmt = stmt.where(
                or_(
                    Vendor.name.ilike(term, escape="\\"),
                    Vendor.slug.ilike(term, escape="\\"),
                    SellerProfile.business_name.ilike(term, escape="\\"),
                    SellerProfile.city.ilike(term, escape="\\"),
                    SellerProfile.activity_type.ilike(term, escape="\\"),
                    SellerProfile.description.ilike(term, escape="\\"),
                )
            )
        if activity_type:
            # Comparaison insensible à la casse/espaces pour supporter les anciennes données.
            stmt = stmt.where(func.lower(func.trim(SellerProfile.activity_type)) == activity_type.lower())
        if storefront_tier:
            # Comparaison insensible à la casse/espaces pour supporter les anciennes données.
            stmt = stmt.where(
                func.lower(func.trim(SellerProfile.storefront_tier)) == storefront_tier.lower()
            )
        return list(self.db.scalars(stmt))

    def list_vendor_prices(self, *, vendor_ids: list[str]) -> list[Price]:
        if not vendor_ids:
            return []
        stmt = (
            select(Price)
            .join(Vendor, Vendor.id == Price.vendor_id)
            .outerjoin(SellerProfile, SellerProfile.vendor_id == Vendor.id)
            .outerjoin(User, User.id == SellerProfile.user_id)
            .where(Price.vendor_id.in_(vendor_ids))
            .where(Price.is_active.is_(True))
            .where(Vendor.is_active.is_(True))
            .where(or_(SellerProfile.user_id.is_(None), User.is_active.is_(True)))
            .where(active_subscription_clause())
            .options(
                selectinload(Price.product).selectinload(Product.category),
                selectinload(Price.vendor).selectinload(Vendor.seller_profile),
            )
        )
        return list(self.db.scalars(stmt))
