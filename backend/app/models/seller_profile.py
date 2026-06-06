from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.vendor import Vendor


class SellerProfile(Base):
    __tablename__ = "seller_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    vendor_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vendors.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    business_name: Mapped[str] = mapped_column(String(140), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(80), nullable=False, default="Niamey")
    address: Mapped[str | None] = mapped_column(String(220), nullable=True)
    activity_type: Mapped[str] = mapped_column(String(32), nullable=False, default="shop")
    storefront_tier: Mapped[str] = mapped_column(String(32), nullable=False, default="basic")
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    opening_hours: Mapped[str | None] = mapped_column(String(240), nullable=True)
    whatsapp_contact: Mapped[str | None] = mapped_column(String(40), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    gallery_images: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    service_offerings: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False, default=list)
    room_types: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    deposit_payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    deposit_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    commission_rate_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    service_fee_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    seller_subscription_fee_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    onboarding_fee_paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_last_payment_reference: Mapped[str | None] = mapped_column(String(180), nullable=True)
    accepts_table_reservations: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    accepts_hotel_bookings: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Premium Entreprise (sur devis): debloque import/export, reservations et calendrier d'un coup.
    is_enterprise: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped[User] = relationship("User")
    vendor: Mapped[Vendor] = relationship("Vendor", back_populates="seller_profile")
