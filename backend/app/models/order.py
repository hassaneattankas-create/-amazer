from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.receipt_scan import ReceiptScan
    from app.models.user import User


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="commande")
    payment_mode: Mapped[str] = mapped_column(String(30), nullable=False, default="nita")
    delivery_type: Mapped[str] = mapped_column(String(30), nullable=False, default="standard")
    transaction_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    transaction_code_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        unique=True,
    )
    payment_reference: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True,
        index=True,
        unique=True,
    )
    gateway_payment_reference: Mapped[str | None] = mapped_column(
        String(120), nullable=True, index=True, unique=True
    )
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, default="paid")
    payment_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tracking_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="XOF")
    fee_breakdown: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list[OrderItem]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    user: Mapped[User] = relationship("User")
    receipt_scans: Mapped[list["ReceiptScan"]] = relationship(
        "ReceiptScan",
        back_populates="order",
        cascade="all, delete-orphan",
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    vendor_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)

    order: Mapped[Order] = relationship("Order", back_populates="items")
