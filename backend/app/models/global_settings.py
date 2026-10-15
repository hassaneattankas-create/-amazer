from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GlobalSettings(Base):
    __tablename__ = "global_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    commission_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)
    service_fee: Mapped[float] = mapped_column(Float, nullable=False, default=200)
    default_delivery_fee: Mapped[float] = mapped_column(Float, nullable=False, default=1500)
    urban_delivery_fee: Mapped[float] = mapped_column(Float, nullable=False, default=1500)
    peripheral_delivery_fee: Mapped[float] = mapped_column(Float, nullable=False, default=2200)
    seller_subscription_fee: Mapped[float] = mapped_column(Float, nullable=False, default=5000)
    seller_subscription_fee_shop: Mapped[float] = mapped_column(Float, nullable=False, default=5000)
    seller_subscription_fee_restaurant: Mapped[float] = mapped_column(Float, nullable=False, default=5000)
    seller_subscription_fee_premium: Mapped[float] = mapped_column(Float, nullable=False, default=5000)
    ad_boost_price: Mapped[float] = mapped_column(Float, nullable=False, default=2000)
    ad_boost_duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    ad_boost_price_24h: Mapped[float] = mapped_column(Float, nullable=False, default=1000)
    ad_boost_price_7d: Mapped[float] = mapped_column(Float, nullable=False, default=2000)
    launch_mode_zero_commission: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_products_basic_tier: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    platform_wallet_phone: Mapped[str | None] = mapped_column(String(40), nullable=True, default=None)
    support_email: Mapped[str | None] = mapped_column(nullable=True, default=None)
    support_phone: Mapped[str | None] = mapped_column(nullable=True, default=None)
    support_whatsapp: Mapped[str | None] = mapped_column(nullable=True, default=None)
    finance_counters_reset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Offres de lancement : desactivees par defaut, activees par l'admin quand la decision est prise.
    seller_trial_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    seller_launch_discount_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0, server_default="0")
    ad_click_counters_reset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Revente sans stock : abonnement mensuel du revendeur + commission AMAZER sur chaque marge.
    reseller_subscription_fee: Mapped[float] = mapped_column(Float, nullable=False, default=500, server_default="500")
    reseller_commission_percent: Mapped[float] = mapped_column(Float, nullable=False, default=10, server_default="10")
    # Affiliation : part du montant des articles versee a l'affilie qui a apporte la vente.
    affiliate_commission_percent: Mapped[float] = mapped_column(Float, nullable=False, default=3, server_default="3")  # obsolete
    # Affiliation : part des abonnements des vendeurs amenes (pendant N mois) et bonus par nouveau client.
    affiliate_seller_share_percent: Mapped[float] = mapped_column(Float, nullable=False, default=20, server_default="20")
    affiliate_seller_share_months: Mapped[int] = mapped_column(Integer, nullable=False, default=12, server_default="12")
    affiliate_customer_bonus: Mapped[float] = mapped_column(Float, nullable=False, default=250, server_default="250")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
