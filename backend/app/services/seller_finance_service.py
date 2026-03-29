from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.global_settings import GlobalSettings
from app.models.seller_profile import SellerProfile


@dataclass(frozen=True)
class EffectiveSellerFinanceSettings:
    commission_rate: float
    service_fee: float
    seller_subscription_fee: float
    commission_overridden: bool
    service_fee_overridden: bool
    subscription_overridden: bool


def get_or_create_global_settings(db: Session) -> GlobalSettings:
    row = db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))
    if row is None:
        row = GlobalSettings(
            commission_rate=0.05,
            service_fee=200,
            default_delivery_fee=1500,
            urban_delivery_fee=1500,
            peripheral_delivery_fee=2200,
            seller_subscription_fee=5000,
            ad_boost_price=2000,
            ad_boost_duration_days=7,
            ad_boost_price_24h=1000,
            ad_boost_price_7d=2000,
            launch_mode_zero_commission=False,
            max_products_basic_tier=10,
            platform_wallet_phone=None,
            support_email=None,
            support_phone=None,
            support_whatsapp=None,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def build_effective_seller_finance_settings(
    settings: GlobalSettings,
    profile: SellerProfile | None = None,
) -> EffectiveSellerFinanceSettings:
    commission_overridden = profile is not None and profile.commission_rate_override is not None
    service_fee_overridden = profile is not None and profile.service_fee_override is not None
    subscription_overridden = profile is not None and profile.seller_subscription_fee_override is not None

    commission_rate = (
        float(profile.commission_rate_override)
        if commission_overridden and profile is not None
        else float(settings.commission_rate)
    )
    if settings.launch_mode_zero_commission:
        commission_rate = 0.0

    service_fee = (
        float(profile.service_fee_override)
        if service_fee_overridden and profile is not None
        else float(settings.service_fee)
    )
    seller_subscription_fee = (
        float(profile.seller_subscription_fee_override)
        if subscription_overridden and profile is not None
        else float(settings.seller_subscription_fee)
    )

    return EffectiveSellerFinanceSettings(
        commission_rate=commission_rate,
        service_fee=service_fee,
        seller_subscription_fee=seller_subscription_fee,
        commission_overridden=commission_overridden,
        service_fee_overridden=service_fee_overridden,
        subscription_overridden=subscription_overridden,
    )
