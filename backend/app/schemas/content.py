from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DynamicSectionItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_type: str = Field(pattern="^(product|restaurant)$")
    product_id: str | None = Field(default=None, max_length=36)
    vendor_id: str | None = Field(default=None, max_length=36)
    sort_order: int = Field(default=0, ge=0, le=9999)


class DynamicSectionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=140, pattern="^[a-z0-9-]+$")
    section_type: str = Field(default="products", pattern="^(products|restaurants|mixed)$")
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0, le=9999)


class DynamicSectionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=2, max_length=120)
    section_type: str = Field(default="products", pattern="^(products|restaurants|mixed)$")
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0, le=9999)


class DynamicSectionItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    target_type: str
    product_id: str | None
    vendor_id: str | None
    sort_order: int


class DynamicSectionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    slug: str
    section_type: str
    is_active: bool
    sort_order: int
    created_at: datetime
    items: list[DynamicSectionItemResponse]


class HomeProductCard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    brand: str
    main_image_url: str | None
    is_sponsored: bool
    is_boosted: bool
    amount: float
    currency: str


class HomeRestaurantCard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    slug: str


class HomeSectionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    slug: str
    section_type: str
    products: list[HomeProductCard]
    restaurants: list[HomeRestaurantCard]


class HomeContentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    top_banner_url: str | None
    sections: list[HomeSectionResponse]


class AdClickRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1, max_length=36)
    section_slug: str | None = Field(default=None, max_length=140)


class AdClickProductStat(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str
    clicks: int


class AdClickStatsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_clicks: int
    clicks_last_7_days: int
    by_product: list[AdClickProductStat]
