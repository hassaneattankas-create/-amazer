from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

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


class CatalogService:
    def __init__(self, db: Session) -> None:
        self.catalog = CatalogRepository(db)

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
    ) -> VendorStorefrontListResponse:
        vendors = self.catalog.list_vendor_storefronts(limit=limit, offset=offset, query=query)
        prices = self.catalog.list_vendor_prices(vendor_ids=[vendor.id for vendor in vendors])

        product_counter: dict[str, set[str]] = {}
        promo_counter: dict[str, int] = {}
        for price in prices:
            if price.stock_quantity <= 0 or price.product is None:
                continue
            product_counter.setdefault(price.vendor_id, set()).add(price.product_id)
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
                    city=getattr(getattr(vendor, "seller_profile", None), "city", None),
                    phone=getattr(getattr(vendor, "seller_profile", None), "phone", None),
                    address=getattr(getattr(vendor, "seller_profile", None), "address", None),
                    product_count=len(product_counter.get(vendor.id, set())),
                    promotion_count=promo_counter.get(vendor.id, 0),
                )
                for vendor in vendors
            ]
        )

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
