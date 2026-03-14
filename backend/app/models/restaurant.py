from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RestaurantMenuItem(Base):
    __tablename__ = "restaurant_menu_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1200), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    base_price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="XOF")
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    options: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    estimated_prep_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class RestaurantOrder(Base):
    __tablename__ = "restaurant_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vendors.id", ondelete="RESTRICT"),
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
    customer_phone: Mapped[str] = mapped_column(String(40), nullable=False)
    delivery_address: Mapped[str] = mapped_column(String(220), nullable=False)
    distance_km: Mapped[float] = mapped_column(Float, nullable=False, default=3)
    delivery_fee: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    delivery_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    payment_mode: Mapped[str] = mapped_column(String(30), nullable=False, default="cash_on_delivery")
    transaction_code: Mapped[str | None] = mapped_column(String(180), nullable=True)
    transaction_code_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        unique=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="commande")
    total_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="XOF")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list[RestaurantOrderItem]] = relationship(
        "RestaurantOrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )


class RestaurantOrderItem(Base):
    __tablename__ = "restaurant_order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("restaurant_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    menu_item_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("restaurant_menu_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    selected_options: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    customer_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False)

    order: Mapped[RestaurantOrder] = relationship("RestaurantOrder", back_populates="items")
