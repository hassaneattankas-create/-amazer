from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SellerProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    business_name: str = Field(min_length=2, max_length=140)
    phone: str | None = Field(default=None, max_length=40)
    city: str = Field(default="Niamey", min_length=2, max_length=80)
    address: str | None = Field(default=None, max_length=220)


class SellerProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    user_id: str
    vendor_id: str
    business_name: str
    phone: str | None
    city: str
    address: str | None
    is_verified: bool
    created_at: datetime


class SellerProductCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=200)
    brand: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    main_image_url: str | None = Field(default=None, max_length=1024)
    category_id: str | None = Field(default=None, max_length=36)
    amount: float = Field(gt=0)
    currency: str = Field(default="XOF", min_length=3, max_length=3)
    stock_quantity: int = Field(default=0, ge=0)
    is_sponsored: bool = False


class SellerProductCreateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str
    price_id: str
    vendor_id: str


class SellerInventoryItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_id: str
    product_id: str
    product_name: str
    brand: str
    amount: float
    currency: str
    stock_quantity: int
    is_active: bool
    is_boosted: bool
    promo_price: float | None = None
    promo_until: datetime | None = None
    boost_until: datetime | None = None


class SellerInventoryUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: float | None = Field(default=None, gt=0)
    stock_quantity: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    promo_amount: float | None = Field(default=None, gt=0)
    boost_duration_hours: int | None = Field(default=None, ge=24, le=168)
