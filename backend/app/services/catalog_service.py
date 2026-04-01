from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.crypto import decrypt_phone_value
from app.repositories.catalog_repository import CatalogRepository
from app.schemas.catalog import (
    CategoryListResponse,
    PromotionItemResponse,
    PromotionListResponse,
    VendorListResponse,
    VendorStorefrontListResponse,
    VendorStorefrontResponse,
)
from app.schemas.product import CategoryResponse, VendorResponse
from app.services.public_catalog_policy import (
    is_allowed_public_product_offer,
    is_allowed_public_storefront,
)


class CatalogService:
    def __init__(self, db: Session) -> None:
        self.catalog = CatalogRepository(db)

    @staticmethod
    def _norm_optional_str(value: object) -> str | None:
        if not isinstance(value, str):
            return None
        normalized = value.strip().lower()
        return normalized or None

    def list_categories(self, *, limit: int, offset: int) -> CategoryListResponse:
        categories = self.catalog.list_active_categories(limit=limit, offset=offset)
        return CategoryListResponse(
            items=[
                CategoryResponse(id=category.id, name=category.name, slug=category.slug)
                for category in categories
            ]
        )

    def list_vendors(self, *, limit: int, offset: int, query: str | None = None) -> VendorListResponse:
        vendors = self.catalog.list_active_vendors(limit=limit, offset=offset, query=query)
        return VendorListResponse(
            items=[
                VendorResponse(
                    id=vendor.id,
                    name=vendor.name,
                    slug=vendor.slug,
                    is_active=vendor.is_active,
                    is_verified=bool(getattr(getattr(vendor, "seller_profile", None), "is_verified", False)),
                )
                for vendor in vendors
            ]
        )

    def list_vendor_storefronts(
        self,
        *,
        limit: int,
        offset: int,
        query: str | None = None,
        activity_type: str | None = None,
        storefront_tier: str | None = None,
    ) -> VendorStorefrontListResponse:
        vendors = self.catalog.list_vendor_storefronts(
            limit=limit,
            offset=offset,
            query=query,
            activity_type=activity_type,
            storefront_tier=storefront_tier,
        )
        prices = self.catalog.list_vendor_prices(vendor_ids=[vendor.id for vendor in vendors])

        product_counter: dict[str, set[str]] = {}
        promo_counter: dict[str, int] = {}
        product_names: dict[str, list[str]] = {}
        min_product_price: dict[str, float] = {}
        for price in prices:
            if price.stock_quantity <= 0 or price.product is None:
                continue
            product_counter.setdefault(price.vendor_id, set()).add(price.product_id)
            names = product_names.setdefault(price.vendor_id, [])
            if price.product.name not in names and len(names) < 4:
                names.append(price.product.name)
            current_min = min_product_price.get(price.vendor_id)
            if current_min is None or float(price.amount) < current_min:
                min_product_price[price.vendor_id] = float(price.amount)
            if self._is_promo_active(price.product):
                promo_counter[price.vendor_id] = promo_counter.get(price.vendor_id, 0) + 1

        return VendorStorefrontListResponse(
            items=[
                VendorStorefrontResponse(
                    id=vendor.id,
                    name=vendor.name,
                    slug=vendor.slug,
                    is_active=vendor.is_active,
                    is_verified=bool(getattr(getattr(vendor, "seller_profile", None), "is_verified", False)),
                    business_name=getattr(getattr(vendor, "seller_profile", None), "business_name", None),
                    activity_type=self._norm_optional_str(
                        getattr(getattr(vendor, "seller_profile", None), "activity_type", None)
                    ),
                    storefront_tier=self._norm_optional_str(
                        getattr(getattr(vendor, "seller_profile", None), "storefront_tier", None)
                    ),
                    city=getattr(getattr(vendor, "seller_profile", None), "city", None),
                    phone=decrypt_phone_value(getattr(getattr(vendor, "seller_profile", None), "phone", None)),
                    address=getattr(getattr(vendor, "seller_profile", None), "address", None),
                    description=getattr(getattr(vendor, "seller_profile", None), "description", None),
                    logo_url=getattr(getattr(vendor, "seller_profile", None), "logo_url", None),
                    cover_image_url=getattr(getattr(vendor, "seller_profile", None), "cover_image_url", None),
                    badge_label=self._build_badge_label(getattr(vendor, "seller_profile", None)),
                    starting_price=self._build_starting_price(
                        getattr(vendor, "seller_profile", None),
                        min_product_price.get(vendor.id),
                    ),
                    price_suffix=self._build_price_suffix(getattr(vendor, "seller_profile", None)),
                    highlight_items=self._build_highlights(
                        getattr(vendor, "seller_profile", None),
                        product_names.get(vendor.id, []),
                    ),
                    product_count=len(product_counter.get(vendor.id, set())),
                    promotion_count=promo_counter.get(vendor.id, 0),
                    service_count=len(getattr(getattr(vendor, "seller_profile", None), "service_offerings", []) or []),
                    room_type_count=len(getattr(getattr(vendor, "seller_profile", None), "room_types", []) or []),
                )
                for vendor in vendors
                if self._has_public_storefront_content(
                    getattr(vendor, "seller_profile", None),
                    product_count=len(product_counter.get(vendor.id, set())),
                )
                and is_allowed_public_storefront(
                    activity_type=getattr(getattr(vendor, "seller_profile", None), "activity_type", None),
                    vendor_name=vendor.name,
                    business_name=getattr(getattr(vendor, "seller_profile", None), "business_name", None),
                )
            ]
        )

    def _build_badge_label(self, profile) -> str | None:
        if profile is None:
            return None
        activity_type = self._norm_optional_str(getattr(profile, "activity_type", None))
        tier = self._norm_optional_str(getattr(profile, "storefront_tier", None))
        if activity_type == "hotel" and tier == "premium":
            return "Luxe"
        if tier == "premium":
            return "Premium"
        return None

    def _has_public_storefront_content(self, profile, *, product_count: int) -> bool:
        if profile is None:
            return product_count > 0
        activity_type = self._norm_optional_str(getattr(profile, "activity_type", None))
        storefront_tier = self._norm_optional_str(getattr(profile, "storefront_tier", None))
        service_count = len(list(getattr(profile, "service_offerings", []) or []))
        room_type_count = len(list(getattr(profile, "room_types", []) or []))

        if activity_type == "shop":
            return product_count > 0
        if storefront_tier == "premium" or activity_type in {"hotel", "enterprise"}:
            return product_count > 0 or service_count > 0 or room_type_count > 0
        return product_count > 0

    def _build_price_suffix(self, profile) -> str | None:
        if profile is None:
            return None
        activity_type = self._norm_optional_str(getattr(profile, "activity_type", None))
        if activity_type == "hotel":
            return "par nuit"
        if activity_type == "restaurant":
            return "menu"
        if activity_type == "shop":
            return "selection"
        return None

    def _build_starting_price(self, profile, default_product_price: float | None) -> float | None:
        if profile is None:
            return default_product_price
        activity_type = self._norm_optional_str(getattr(profile, "activity_type", None))
        room_types = list(getattr(profile, "room_types", []) or [])
        if activity_type == "hotel":
            nightly_prices = [
                float(room.get("night_price"))
                for room in room_types
                if isinstance(room, dict) and isinstance(room.get("night_price"), (int, float))
            ]
            if nightly_prices:
                return min(nightly_prices)
        return default_product_price

    def _build_highlights(self, profile, product_names: list[str]) -> list[str]:
        if profile is None:
            return product_names[:3]
        service_offerings = list(getattr(profile, "service_offerings", []) or [])
        room_types = list(getattr(profile, "room_types", []) or [])
        highlights: list[str] = []
        for item in service_offerings:
            if isinstance(item, dict):
                title = str(item.get("title", "")).strip()
                if title and title not in highlights:
                    highlights.append(title)
            if len(highlights) >= 4:
                return highlights[:4]
        for room in room_types:
            if not isinstance(room, dict):
                continue
            for amenity in room.get("amenities", []) or []:
                amenity_label = str(amenity).strip()
                if amenity_label and amenity_label not in highlights:
                    highlights.append(amenity_label)
                if len(highlights) >= 4:
                    return highlights[:4]
        for name in product_names:
            if name and name not in highlights:
                highlights.append(name)
            if len(highlights) >= 4:
                break
        return highlights[:4]

    def list_promotions(
        self,
        *,
        limit: int,
        offset: int,
        query: str | None = None,
    ) -> PromotionListResponse:
        prices = self.catalog.list_vendor_prices(
            vendor_ids=[
                vendor.id for vendor in self.catalog.list_active_vendors(limit=1000, offset=0, query=None)
            ]
        )
        needle = query.strip().lower() if query else ""
        promos: list[PromotionItemResponse] = []
        for price in prices:
            product = price.product
            vendor = price.vendor
            if product is None or vendor is None or not self._is_promo_active(product):
                continue
            if not is_allowed_public_product_offer(vendor.name):
                continue
            if needle and needle not in product.name.lower() and needle not in product.brand.lower() and needle not in vendor.name.lower():
                continue
            promo_amount = self._get_promo_amount(product)
            if promo_amount is None:
                continue
            promos.append(
                PromotionItemResponse(
                    product_id=product.id,
                    product_name=product.name,
                    brand=product.brand,
                    main_image_url=product.main_image_url,
                    category_slug=product.category.slug if product.category else None,
                    vendor=VendorResponse(
                        id=vendor.id,
                        name=vendor.name,
                        slug=vendor.slug,
                        is_active=vendor.is_active,
                        is_verified=bool(getattr(getattr(vendor, "seller_profile", None), "is_verified", False)),
                    ),
                    original_amount=float(max(price.amount, promo_amount)),
                    promo_amount=float(promo_amount),
                    currency=price.currency,
                    promo_until=self._promo_until(product),
                    is_boosted=bool(product.is_boosted),
                )
            )
        promos.sort(key=lambda row: (0 if row.is_boosted else 1, row.promo_amount, row.product_name.lower()))
        sliced = promos[offset : offset + limit]
        return PromotionListResponse(items=sliced)

    def _promo_until(self, product) -> str | None:
        specs = getattr(product, "specs", {}) or {}
        raw = specs.get("promo_until")
        return raw if isinstance(raw, str) else None

    def _get_promo_amount(self, product) -> float | None:
        specs = getattr(product, "specs", {}) or {}
        raw = specs.get("promo_price")
        if isinstance(raw, (int, float)):
            return float(raw)
        return None

    def _is_promo_active(self, product) -> bool:
        specs = getattr(product, "specs", {}) or {}
        if not isinstance(specs.get("promo_price"), (int, float)):
            return False
        raw_until = specs.get("promo_until")
        if not isinstance(raw_until, str):
            return False
        try:
            until = datetime.fromisoformat(raw_until.replace("Z", "+00:00"))
        except ValueError:
            return False
        if until.tzinfo is None:
            until = until.replace(tzinfo=UTC)
        return until.astimezone(UTC) > datetime.now(UTC)
