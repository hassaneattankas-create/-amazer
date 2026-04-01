from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MenuOptionSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    price: float = Field(ge=0)


class RestaurantMenuCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=1200)
    image_url: str | None = Field(default=None, max_length=1024)
    base_price: float = Field(gt=0)
    currency: str = Field(default="XOF", min_length=3, max_length=3)
    tags: list[str] = Field(default_factory=list, max_length=5)
    options: list[MenuOptionSchema] = Field(default_factory=list, max_length=12)
    estimated_prep_minutes: int = Field(default=20, ge=5, le=120)


class RestaurantMenuItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    vendor_id: str
    vendor_name: str
    name: str
    description: str | None
    image_url: str | None
    base_price: float
    currency: str
    tags: list[str]
    options: list[dict[str, Any]]
    estimated_prep_minutes: int
    is_available: bool


class RestaurantMenuAvailabilityUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_available: bool


class RestaurantOrderLineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    menu_item_id: str = Field(min_length=1, max_length=36)
    quantity: int = Field(ge=1, le=20)
    selected_options: list[MenuOptionSchema] = Field(default_factory=list, max_length=8)
    customer_note: str | None = Field(default=None, max_length=500)


class RestaurantOrderCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    vendor_id: str = Field(min_length=1, max_length=36)
    customer_name: str = Field(min_length=2, max_length=120)
    customer_phone: str = Field(min_length=6, max_length=40)
    delivery_address: str = Field(min_length=4, max_length=220)
    distance_km: float = Field(default=3.0, ge=0.1, le=50)
    payment_mode: str = Field(pattern="^(nita|amana|cash_on_delivery)$")
    transaction_code: str | None = Field(default=None, max_length=120)
    items: list[RestaurantOrderLineRequest] = Field(min_length=1, max_length=20)


class RestaurantOrderItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    menu_item_id: str
    dish_name: str
    quantity: int
    selected_options: list[dict[str, Any]]
    customer_note: str | None
    unit_price: float
    subtotal: float


class RestaurantOrderResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    vendor_id: str
    vendor_name: str
    customer_name: str
    customer_phone: str
    delivery_address: str
    distance_km: float
    delivery_fee: float
    delivery_minutes: int
    payment_mode: str
    status: str
    total_amount: float
    currency: str
    created_at: datetime
    items: list[RestaurantOrderItemResponse]


class RestaurantOrderStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern="^(commande|preparation|livraison|recu)$")


class RestaurantStorefrontResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    slug: str
    business_name: str | None
    city: str | None
    phone: str | None
    address: str | None
    is_verified: bool
    menu_item_count: int
    plat_du_jour_count: int
    cover_image_url: str | None


class RestaurantStorefrontListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[RestaurantStorefrontResponse]


class RestaurantReservationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    vendor_id: str = Field(min_length=1, max_length=36)
    customer_name: str = Field(min_length=2, max_length=120)
    customer_phone: str = Field(min_length=6, max_length=40)
    reservation_at: datetime
    guest_count: int = Field(default=2, ge=1, le=20)
    note: str | None = Field(default=None, max_length=1000)


class RestaurantReservationStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern="^(pending|confirmed|declined)$")


class RestaurantReservationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    vendor_id: str
    customer_name: str
    customer_phone: str
    reservation_at: datetime
    guest_count: int
    note: str | None
    status: str
    created_at: datetime
