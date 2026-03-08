from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RestaurantReservation(Base):
    __tablename__ = "restaurant_reservations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(120), nullable=False)
    reservation_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    guest_count: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class HotelBooking(Base):
    __tablename__ = "hotel_bookings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    room_type_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    room_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    guest_name: Mapped[str] = mapped_column(String(120), nullable=False)
    guest_phone: Mapped[str] = mapped_column(String(120), nullable=False)
    guest_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_out_date: Mapped[date] = mapped_column(Date, nullable=False)
    guest_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    deposit_payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    deposit_amount: Mapped[float] = mapped_column(Float, nullable=False)
    transaction_reference: Mapped[str | None] = mapped_column(String(180), nullable=True)
    special_request: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
