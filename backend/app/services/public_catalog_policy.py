from __future__ import annotations

from typing import Any

from app.config import get_settings

settings = get_settings()

ALLOWED_PUBLIC_SHOP_NAMES = {"amazer", "fragrance"}
ALLOWED_PUBLIC_RESTAURANT_NAMES = {"le sahel rooftop"}
ALLOWED_PUBLIC_HOME_BRANDS = {"amazer market", "fragrance"}


def normalize_public_value(value: str | None) -> str:
    return (value or "").strip().lower()


def is_public_catalog_restricted() -> bool:
    return settings.is_production() and settings.curated_public_catalog_mode


def is_allowed_public_shop_name(name: str | None) -> bool:
    return normalize_public_value(name) in ALLOWED_PUBLIC_SHOP_NAMES


def is_allowed_public_restaurant_name(name: str | None) -> bool:
    return normalize_public_value(name) in ALLOWED_PUBLIC_RESTAURANT_NAMES


def is_allowed_public_home_brand(name: str | None) -> bool:
    return normalize_public_value(name) in ALLOWED_PUBLIC_HOME_BRANDS


def is_allowed_public_storefront(
    *,
    activity_type: str | None,
    vendor_name: str | None,
    business_name: str | None,
) -> bool:
    if not is_public_catalog_restricted():
        return True

    normalized_activity = normalize_public_value(activity_type)
    preferred_name = business_name or vendor_name
    if normalized_activity == "shop":
        return is_allowed_public_shop_name(preferred_name)
    if normalized_activity == "restaurant":
        return is_allowed_public_restaurant_name(preferred_name)
    return True


def is_allowed_public_product_offer(vendor_name: str | None) -> bool:
    if not is_public_catalog_restricted():
        return True
    return is_allowed_public_shop_name(vendor_name)


def is_allowed_public_home_product(brand: str | None) -> bool:
    if not is_public_catalog_restricted():
        return True
    return is_allowed_public_home_brand(brand)


def product_seed_source(specs: Any) -> str | None:
    if not isinstance(specs, dict):
        return None
    raw = specs.get("seed_source")
    return raw.strip().lower() if isinstance(raw, str) and raw.strip() else None
