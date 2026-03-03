from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CheckoutItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1, max_length=36)
    vendor_id: str = Field(min_length=1, max_length=36)
    quantity: int = Field(ge=1, le=100)
    unit_price: float = Field(gt=0)


class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    items: list[CheckoutItemRequest] = Field(min_length=1)
    payment_mode: str = Field(default="nita", pattern="^(nita|amana)$")
    delivery_type: str = Field(default="standard", pattern="^(standard|express_niamey)$")
    transaction_code: str | None = Field(default=None, max_length=120)
    currency: str = Field(default="XOF", min_length=3, max_length=3)


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    product_id: str
    vendor_id: str
    quantity: int
    unit_price: float
    subtotal: float


class OrderResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    status: str
    payment_mode: str
    delivery_type: str
    transaction_code: str | None
    tracking_code: str | None
    estimated_minutes: int
    total_amount: float
    currency: str
    created_at: datetime
    items: list[OrderItemResponse]


class ReceiptItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    subtotal: float


class ReceiptLinkResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: str
    token: str
    receipt_url: str
    verify_url: str


class ReceiptResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: str
    customer_name: str
    payment_mode: str
    currency: str
    total_amount: float
    transaction_code_masked: str | None
    created_at: datetime
    issued_at: datetime
    items: list[ReceiptItemResponse]
    integrity_hash: str
    verify_url: str


class ReceiptVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=32, max_length=2048)
    vendor_id: str | None = Field(default=None, max_length=36)
    gps: str | None = Field(default=None, max_length=120)


class ReceiptVerifyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: str
    status: str
    message: str
    scanned_at: datetime | None
