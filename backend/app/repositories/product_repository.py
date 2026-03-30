from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.category import Category
from app.models.product import Price, Product
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor


@dataclass(frozen=True)
class SearchOfferRow:
    product: Product
    price: Price
    text_rank: float


class ProductRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, product_id: str) -> Product | None:
        stmt = (
            select(Product)
            .where(Product.id == product_id)
            .options(
                selectinload(Product.images),
                selectinload(Product.prices)
                .selectinload(Price.vendor)
                .selectinload(Vendor.seller_profile)
                .selectinload(SellerProfile.user),
                selectinload(Product.prices).selectinload(Price.history_entries),
                selectinload(Product.category),
            )
        )
        return self.db.scalar(stmt)

    def search_offers(
        self,
        *,
        query: str | None,
        barcode: str | None,
        brand: str | None,
        category_id: str | None,
        category_slug: str | None,
        spec_key: str | None,
        spec_value: str | None,
        min_price: float | None,
        max_price: float | None,
        in_stock_only: bool,
        raw_limit: int,
        raw_offset: int,
    ) -> list[SearchOfferRow]:
        text_rank_expr = func.ts_rank_cd(
            func.to_tsvector(
                "simple",
                func.concat_ws(" ", Product.name, Product.brand),
            ),
            func.plainto_tsquery("simple", query if query else ""),
        )

        stmt = (
            select(Product, Price, text_rank_expr.label("text_rank"))
            .join(Price, Price.product_id == Product.id)
            .join(Vendor, Vendor.id == Price.vendor_id)
            .outerjoin(SellerProfile, SellerProfile.vendor_id == Vendor.id)
            .outerjoin(User, User.id == SellerProfile.user_id)
            .outerjoin(Category, Category.id == Product.category_id)
            .where(Price.is_active.is_(True))
            .where(Vendor.is_active.is_(True))
            .where(or_(SellerProfile.user_id.is_(None), User.is_active.is_(True)))
            .options(
                selectinload(Product.images),
                selectinload(Product.category),
                selectinload(Product.prices)
                .selectinload(Price.vendor)
                .selectinload(Vendor.seller_profile)
                .selectinload(SellerProfile.user),
            )
        )

        if in_stock_only:
            stmt = stmt.where(Price.stock_quantity > 0)
        if brand:
            stmt = stmt.where(Product.brand.ilike(f"%{brand}%"))
        if category_id:
            stmt = stmt.where(Product.category_id == category_id)
        if category_slug:
            stmt = stmt.where(Category.slug == category_slug)
        if min_price is not None:
            stmt = stmt.where(Price.amount >= min_price)
        if max_price is not None:
            stmt = stmt.where(Price.amount <= max_price)
        if query:
            stmt = stmt.where(
                or_(
                    text_rank_expr > 0,
                    Product.name.ilike(f"%{query}%"),
                    Product.brand.ilike(f"%{query}%"),
                )
            )
        if barcode:
            stmt = stmt.where(func.lower(Product.specs["barcode"].astext) == barcode.lower())
        if spec_key and spec_value:
            stmt = stmt.where(func.lower(Product.specs[spec_key].astext) == spec_value.lower())

        stmt = stmt.order_by(Product.created_at.desc()).offset(raw_offset).limit(raw_limit)
        rows = self.db.execute(stmt).all()

        return [
            SearchOfferRow(
                product=row[0],
                price=row[1],
                text_rank=float(row[2]) if row[2] is not None else 0.0,
            )
            for row in rows
        ]
