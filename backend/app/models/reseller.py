"""Revente sans stock (dropshipping AMAZER).

Un membre choisit une offre d'une boutique (prix fournisseur) et fixe son prix de revente.
Le client paie le prix de revente ; la boutique d'origine prepare et AMAZER livre comme
d'habitude ; la difference (marge) revient au revendeur, payee par l'admin apres livraison.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ResellerListing(Base):
    __tablename__ = "reseller_listings"
    __table_args__ = (UniqueConstraint("reseller_user_id", "price_id", name="uq_reseller_listing_user_price"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    reseller_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    price_id: Mapped[str] = mapped_column(String(36), ForeignKey("prices.id", ondelete="CASCADE"), nullable=False)
    resale_amount: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ResellerAccount(Base):
    """Abonnement du revendeur : ses annonces ne sont visibles que s'il est a jour."""

    __tablename__ = "reseller_accounts"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ResellerSubscriptionPayment(Base):
    """Paiement d'abonnement declare par le revendeur (Nita / Amana), valide par l'admin."""

    __tablename__ = "reseller_subscription_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_mode: Mapped[str] = mapped_column(String(20), nullable=False)
    transaction_reference: Mapped[str] = mapped_column(String(180), nullable=False)
    months: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    amount_claimed: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class ResellerPayout(Base):
    """Versement d'une marge a un revendeur (Nita / Amana), enregistre par l'admin."""

    __tablename__ = "reseller_payouts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(180), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
