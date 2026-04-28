from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class FinanceSettingsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    commission_rate: float
    service_fee: float
    default_delivery_fee: float
    seller_subscription_fee_shop: float
    seller_subscription_fee_restaurant: float
    seller_subscription_fee_premium: float
    ad_boost_price: float
    ad_boost_duration_days: int
    urban_delivery_fee: float
    peripheral_delivery_fee: float
    ad_boost_price_24h: float
    ad_boost_price_7d: float
    launch_mode_zero_commission: bool
    max_products_basic_tier: int
    platform_wallet_phone: str | None = None
    support_email: str | None = None
    support_phone: str | None = None
    support_whatsapp: str | None = None


class FinanceSettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    commission_rate: float = Field(ge=0)
    service_fee: float = Field(ge=0)
    default_delivery_fee: float = Field(ge=0)
    seller_subscription_fee_shop: float = Field(ge=0)
    seller_subscription_fee_restaurant: float = Field(ge=0)
    seller_subscription_fee_premium: float = Field(ge=0)
    ad_boost_price: float = Field(ge=0)
    ad_boost_duration_days: int = Field(ge=1, le=365)
    urban_delivery_fee: float = Field(ge=0)
    peripheral_delivery_fee: float = Field(ge=0)
    ad_boost_price_24h: float = Field(ge=0)
    ad_boost_price_7d: float = Field(ge=0)
    launch_mode_zero_commission: bool = False
    max_products_basic_tier: int = Field(default=10, ge=1, le=5000)
    platform_wallet_phone: str | None = Field(default=None, max_length=40)
    support_email: str | None = Field(default=None, max_length=255)
    support_phone: str | None = Field(default=None, max_length=40)
    support_whatsapp: str | None = Field(default=None, max_length=40)


class PublicContactInfoResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    support_email: str | None = None
    support_phone: str | None = None
    support_whatsapp: str | None = None


class RevenuePoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day: date
    amount: float


class FinanceSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_commissions_collected: float
    active_sellers: int
    revenue_last_30_days: list[RevenuePoint]


class PinVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    pin: str = Field(min_length=4, max_length=32)
    birth_date: str = Field(min_length=6, max_length=16)


class WalletSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_nita: float
    total_amana: float
    total_cash_on_delivery: float
    total_all: float
    amazer_commission_total: float
    service_fee_total: float


class TreasuryTransactionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str
    order_id: str
    payment_mode: str
    amount: float
    encrypted_transaction_code: str | None
    decrypted_transaction_code: str | None
    created_at: str


class TransferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bank_name: str = Field(pattern="^(BOA|SONIBANK)$")
    amount: float = Field(gt=0)


class TransferResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    bank_name: str
    amount: float
    currency: str
    status: str
    created_at: str


class CountersResetResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    finance_counters_reset_at: str
    ad_click_counters_reset_at: str


class AdminOrderTrackingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    customer_name: str
    status: str
    payment_mode: str
    total_amount: float
    tracking_code: str | None
    created_at: str


class AdminOrderStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern="^(commande|preparation|livraison|recu|CLAIMED)$")


class DistrictFeeItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district_name: str = Field(min_length=2, max_length=120)
    delivery_fee: float = Field(ge=0)


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    event_type: str
    actor_email: str | None
    ip_address: str | None
    entity_type: str | None
    entity_id: str | None
    details: dict
    created_at: str


class AdminSellerResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_id: str
    user_id: str
    vendor_id: str
    business_name: str
    city: str
    phone: str | None
    is_verified: bool
    is_active: bool
    commission_rate_override: float | None = None
    service_fee_override: float | None = None
    seller_subscription_fee_override: float | None = None
    effective_commission_rate: float
    effective_service_fee: float
    effective_seller_subscription_fee: float
    created_at: str


class AdminSellerPricingUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    commission_rate_override: float | None = Field(default=None, ge=0)
    service_fee_override: float | None = Field(default=None, ge=0)
    seller_subscription_fee_override: float | None = Field(default=None, ge=0)


class AdminUserStatsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_users: int
    active_users: int
    inactive_users: int
    seller_accounts: int
    client_only_accounts: int
    admin_accounts: int
    new_users_last_7_days: int
    new_users_last_30_days: int


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    email: str
    full_name: str
    whatsapp_phone: str | None
    is_active: bool
    is_admin: bool
    is_seller: bool
    created_at: str


class AdminSellerSubscriptionPaymentRequestResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    seller_profile_id: str
    seller_user_id: str
    business_name: str
    seller_email: str
    payment_mode: str
    transaction_reference: str
    months: int
    amount_claimed: float
    status: str
    admin_note: str | None = None
    reviewed_by_user_id: str | None = None
    reviewed_at: str | None = None
    created_at: str


class AdminSellerSubscriptionPaymentDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    decision: str = Field(pattern="^(approved|rejected)$")
    admin_note: str | None = Field(default=None, max_length=500)
