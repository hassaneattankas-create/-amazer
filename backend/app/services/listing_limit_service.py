from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.global_settings import GlobalSettings
from app.models.product import Price
from app.models.restaurant import RestaurantMenuItem
from app.models.seller_profile import SellerProfile


def is_premium_profile(profile: SellerProfile) -> bool:
    return (profile.storefront_tier or "").strip().lower() == "premium"


def max_products_for_basic_tier(db: Session) -> int:
    row = db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))
    if row is None or row.max_products_basic_tier is None:
        value = 10
    else:
        value = int(row.max_products_basic_tier)
    return max(1, min(value, 5000))


def count_vendor_catalog_products(db: Session, vendor_id: str) -> int:
    return db.scalar(select(func.count()).select_from(Price).where(Price.vendor_id == vendor_id)) or 0


def count_vendor_menu_items(db: Session, vendor_id: str) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(RestaurantMenuItem)
            .where(RestaurantMenuItem.vendor_id == vendor_id)
        )
        or 0
    )
