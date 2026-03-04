from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    name: str
    slug: str


class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    name: str
    slug: str
    is_active: bool
    is_verified: bool = False


class ProductImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    image_url: str
    sort_order: int


class RankingBreakdownResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_competitiveness: float
    stock_signal: float
    text_relevance: float
    vendor_signal: float
    score_total: float


class OfferResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_id: str
    vendor: VendorResponse
    currency: str
    amount: float
    stock_quantity: int
    is_active: bool
    ranking: RankingBreakdownResponse


class ProductSearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    brand: str
    description: str | None
    main_image_url: str | None
    is_sponsored: bool
    is_boosted: bool
    ad_banner_url: str | None
    specs: dict[str, Any]
    category: CategoryResponse | None
    created_at: datetime
    images: list[ProductImageResponse] = Field(default_factory=list)
    best_offer: OfferResponse


class ProductSearchMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    limit: int
    offset: int
    returned: int


class ProductSearchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ProductSearchResponse]
    meta: ProductSearchMeta


class PriceHistoryPointResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    changed_at: datetime
    amount: float


class ProductDetailResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product: ProductSearchResponse
    offers: list[OfferResponse]
    price_history: list[PriceHistoryPointResponse] = Field(default_factory=list)


SearchSort = Literal["relevance", "price_asc", "price_desc", "newest"]
