from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Price, Product
from app.models.seller_profile import SellerProfile
from app.models.vendor import Vendor


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
            .where(Vendor.is_active.is_(True))
            .order_by(Vendor.name.asc())
            .offset(offset)
            .limit(limit)
        )
        if query:
            term = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    Vendor.name.ilike(term),
                    Vendor.slug.ilike(term),
                    SellerProfile.business_name.ilike(term),
                    SellerProfile.city.ilike(term),
                    SellerProfile.activity_type.ilike(term),
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
            .outerjoin(SellerProfile, SellerProfile.vendor_id == Vendor.id)
            .options(selectinload(Vendor.seller_profile))
            .order_by(Vendor.updated_at.desc(), Vendor.name.asc())
            .offset(offset)
            .limit(limit)
        )
        if query:
            term = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    Vendor.name.ilike(term),
                    Vendor.slug.ilike(term),
                    SellerProfile.business_name.ilike(term),
                    SellerProfile.city.ilike(term),
                    SellerProfile.activity_type.ilike(term),
                    SellerProfile.description.ilike(term),
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
            .where(Price.vendor_id.in_(vendor_ids))
            .where(Price.is_active.is_(True))
            .options(
                selectinload(Price.product).selectinload(Product.category),
                selectinload(Price.vendor).selectinload(Vendor.seller_profile),
            )
        )
        return list(self.db.scalars(stmt))
