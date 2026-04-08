from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SellerSubscriptionPayment(Base):
    __tablename__ = "seller_subscription_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    seller_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seller_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    payment_mode: Mapped[str] = mapped_column(String(20), nullable=False)
    transaction_reference: Mapped[str] = mapped_column(String(180), nullable=False)
    months: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    amount_claimed: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

