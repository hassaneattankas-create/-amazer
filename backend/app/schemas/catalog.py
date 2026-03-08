from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from app.schemas.product import CategoryResponse, VendorResponse


class CategoryListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CategoryResponse]


class VendorListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[VendorResponse]


class VendorStorefrontResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    slug: str
    is_active: bool
    is_verified: bool
    business_name: str | None
    activity_type: str | None
    storefront_tier: str | None
    city: str | None
    phone: str | None
    address: str | None
    description: str | None
    logo_url: str | None
    cover_image_url: str | None
    badge_label: str | None
    starting_price: float | None
    price_suffix: str | None
    highlight_items: list[str]
    product_count: int
    promotion_count: int
    service_count: int
    room_type_count: int


class VendorStorefrontListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[VendorStorefrontResponse]


class PromotionItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str
    product_name: str
    brand: str
    main_image_url: str | None
    category_slug: str | None
    vendor: VendorResponse
    original_amount: float
    promo_amount: float
    currency: str
    promo_until: str | None
    is_boosted: bool


class PromotionListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[PromotionItemResponse]
