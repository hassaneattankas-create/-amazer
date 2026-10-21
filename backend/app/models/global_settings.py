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
    # Securite des gains : delai avant paiement, minimum de retrait, plafond des nouveaux comptes (3 premiers mois),
    # nombre d'inscriptions par jour au-dela duquel les parrainages sont a verifier.
    affiliate_hold_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30, server_default="30")
    # Commande « En livraison » sans confirmation du client : passee « Recu » automatiquement apres ce delai (heures).
    auto_receipt_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=72, server_default="72")
    # Numeros AMAZER a contacter pour se faire livrer depuis une pharmacie ou une station (Niamey pour l'instant).
    pharmacy_delivery_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    fuel_delivery_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Villes ou AMAZER livre depuis les pharmacies / stations, separees par des virgules.
    local_delivery_cities: Mapped[str] = mapped_column(String(400), nullable=False, default="Niamey", server_default="Niamey")
    affiliate_min_payout: Mapped[float] = mapped_column(Float, nullable=False, default=2000, server_default="2000")
    affiliate_new_account_monthly_cap: Mapped[float] = mapped_column(Float, nullable=False, default=25000, server_default="25000")
    affiliate_max_referrals_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=15, server_default="15")
    # Ambassadeurs : prime sur le 1er mois d'abonnement, paliers selon le nombre de boutiques payantes, prime du mois.
    ambassador_first_month_percent: Mapped[float] = mapped_column(Float, nullable=False, default=50, server_default="50")
    ambassador_tier2_shops: Mapped[int] = mapped_column(Integer, nullable=False, default=10, server_default="10")
    ambassador_tier2_percent: Mapped[float] = mapped_column(Float, nullable=False, default=25, server_default="25")
    ambassador_tier3_shops: Mapped[int] = mapped_column(Integer, nullable=False, default=25, server_default="25")
    ambassador_tier3_percent: Mapped[float] = mapped_column(Float, nullable=False, default=30, server_default="30")
    ambassador_monthly_top_bonus: Mapped[float] = mapped_column(Float, nullable=False, default=10000, server_default="10000")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
