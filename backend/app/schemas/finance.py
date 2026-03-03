from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class FinanceSettingsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    commission_rate: float
    service_fee: float
    default_delivery_fee: float
    seller_subscription_fee: float
    ad_boost_price: float
    ad_boost_duration_days: int


class FinanceSettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    commission_rate: float = Field(ge=0, le=1)
    service_fee: float = Field(ge=0)
    default_delivery_fee: float = Field(ge=0)
    seller_subscription_fee: float = Field(ge=0)
    ad_boost_price: float = Field(ge=0)
    ad_boost_duration_days: int = Field(ge=1, le=365)


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
    model_config = ConfigDict(extra="forbid")

    pin: str = Field(min_length=4, max_length=32)


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
