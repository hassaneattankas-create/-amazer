from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.restaurant import RestaurantMenuItemResponse


class SellerServiceOfferingSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=600)
    display_mode: Literal["consult_only", "book_only", "shop"] = "consult_only"


class HotelRoomTypeSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: str | None = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    night_price: float = Field(gt=0)
    capacity: int = Field(default=1, ge=1, le=12)
    amenities: list[str] = Field(default_factory=list, max_length=20)
    photo_urls: list[str] = Field(default_factory=list, max_length=20)
    deposit_amount: float | None = Field(default=None, ge=0)


class SellerProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    business_name: str = Field(min_length=2, max_length=140)
    phone: str | None = Field(default=None, max_length=40)
    city: str = Field(default="Niamey", min_length=2, max_length=80)
    address: str | None = Field(default=None, max_length=220)
    activity_type: Literal["shop", "restaurant", "hotel", "enterprise"] = "shop"
    storefront_tier: Literal["basic", "premium"] = "basic"
    description: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = Field(default=None, max_length=1024)
    cover_image_url: str | None = Field(default=None, max_length=1024)
    opening_hours: str | None = Field(default=None, max_length=240)
    whatsapp_contact: str | None = Field(default=None, max_length=40)
    contact_email: str | None = Field(default=None, max_length=320)
    gallery_images: list[str] = Field(default_factory=list, max_length=12)
    service_offerings: list[SellerServiceOfferingSchema] = Field(default_factory=list, max_length=20)
    room_types: list[HotelRoomTypeSchema] = Field(default_factory=list, max_length=24)
    deposit_payment_method: Literal["nita", "amana"] | None = None
    deposit_amount: float | None = Field(default=None, ge=0)
    accepts_table_reservations: bool = False
    accepts_hotel_bookings: bool = False


class SellerProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    user_id: str
    vendor_id: str
    business_name: str
    phone: str | None
    city: str
    address: str | None
    activity_type: Literal["shop", "restaurant", "hotel", "enterprise"]
    storefront_tier: Literal["basic", "premium"]
    description: str | None
    logo_url: str | None
    cover_image_url: str | None
    opening_hours: str | None
    whatsapp_contact: str | None
    contact_email: str | None
    gallery_images: list[str]
    service_offerings: list[SellerServiceOfferingSchema]
    room_types: list[HotelRoomTypeSchema]
    deposit_payment_method: Literal["nita", "amana"] | None
    deposit_amount: float | None
    commission_rate_override: float | None = None
    service_fee_override: float | None = None
    seller_subscription_fee_override: float | None = None
    onboarding_fee_paid_at: datetime | None = None
    subscription_paid_until: datetime | None = None
    subscription_last_payment_reference: str | None = None
    effective_commission_rate: float
    effective_service_fee: float
    effective_seller_subscription_fee: float
    accepts_table_reservations: bool
    accepts_hotel_bookings: bool
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
    description: str | None = None
    main_image_url: str | None = None
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

    product_name: str | None = Field(default=None, min_length=2, max_length=180)
    amount: float | None = Field(default=None, gt=0)
    stock_quantity: int | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=2000)
    main_image_url: str | None = Field(default=None, max_length=1024)
    is_active: bool | None = None
    promo_amount: float | None = Field(default=None, gt=0)
    boost_duration_hours: int | None = Field(default=None, ge=24, le=168)


class SellerShopOrderItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    subtotal: float


class SellerShopOrderResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    customer_name: str
    status: Literal["payment_pending", "commande", "preparation", "livraison", "recu", "CLAIMED"]
    payment_mode: Literal["nita", "amana"]
    payment_status: Literal["pending", "paid"]
    delivery_type: Literal["standard", "express_niamey"]
    tracking_code: str | None
    total_amount: float
    currency: str
    created_at: datetime
    items: list[SellerShopOrderItemResponse]


class SellerShopOrderStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["commande", "preparation", "livraison", "recu"]


class SellerSubscriptionStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    has_seller_profile: bool
    onboarding_fee_paid: bool
    onboarding_fee_paid_at: datetime | None = None
    subscription_paid_until: datetime | None = None
    subscription_active: bool
    monthly_fee: float
    onboarding_fee: float
    amount_due_now: float
    currency: str = "XOF"
    has_pending_payment_request: bool = False


class SellerSubscriptionPayRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    payment_mode: Literal["nita", "amana"]
    transaction_reference: str | None = Field(default=None, max_length=180)
    months: int = Field(default=1, ge=1, le=12)


class SellerSubscriptionPaymentRequestResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    seller_profile_id: str
    seller_user_id: str
    payment_mode: Literal["nita", "amana"]
    transaction_reference: str
    months: int
    amount_claimed: float
    status: Literal["pending", "approved", "rejected"]
    admin_note: str | None = None
    reviewed_by_user_id: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class SellerStorefrontProductResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_id: str
    product_id: str
    name: str
    brand: str
    description: str | None = None
    amount: float
    currency: str
    is_boosted: bool
    main_image_url: str | None


class SellerStorefrontResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vendor_id: str
    vendor_slug: str
    business_name: str
    activity_type: Literal["shop", "restaurant", "hotel", "enterprise"]
    storefront_tier: Literal["basic", "premium"]
    city: str | None
    address: str | None
    phone: str | None
    description: str | None
    logo_url: str | None
    cover_image_url: str | None
    opening_hours: str | None
    whatsapp_contact: str | None
    contact_email: str | None
    gallery_images: list[str]
    service_offerings: list[SellerServiceOfferingSchema]
    room_types: list[HotelRoomTypeSchema]
    deposit_payment_method: Literal["nita", "amana"] | None
    deposit_amount: float | None
    effective_commission_rate: float
    effective_service_fee: float
    accepts_table_reservations: bool
    accepts_hotel_bookings: bool
    is_verified: bool
    products: list[SellerStorefrontProductResponse]
    restaurant_menu: list[RestaurantMenuItemResponse]


class HotelBookingCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    vendor_id: str = Field(min_length=1, max_length=36)
    room_type_id: str = Field(min_length=1, max_length=64)
    guest_name: str = Field(min_length=2, max_length=120)
    guest_phone: str = Field(min_length=6, max_length=40)
    guest_email: str | None = Field(default=None, max_length=320)
    check_in_date: date
    check_out_date: date
    guest_count: int = Field(default=1, ge=1, le=12)
    deposit_payment_method: Literal["nita", "amana"]
    transaction_reference: str | None = Field(default=None, max_length=180)
    special_request: str | None = Field(default=None, max_length=1000)


class HotelBookingStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["pending", "confirmed", "cancelled"]


class HotelBookingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    vendor_id: str
    room_type_id: str
    room_snapshot: dict[str, Any]
    guest_name: str
    guest_phone: str
    guest_email: str | None
    check_in_date: date
    check_out_date: date
    guest_count: int
    deposit_payment_method: Literal["nita", "amana"]
    deposit_amount: float
    transaction_reference: str | None
    special_request: str | None
    status: Literal["pending", "confirmed", "cancelled"]
    created_at: datetime
