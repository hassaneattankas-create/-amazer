from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.receipt_scan import ReceiptScan
    from app.models.user import User
    from app.models.vendor import Vendor


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
    # Livraison : ou livrer, et quel livreur s'en charge.
    delivery_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    delivery_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    delivery_district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    courier_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    courier_assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Affiliation : affilie qui a apporte la vente et sa commission (figee a la commande).
    affiliate_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    affiliate_commission: Mapped[float] = mapped_column(Float, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list[OrderItem]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    # Deux cles vers users (client et livreur) : on precise celle du client.
    user: Mapped[User] = relationship("User", foreign_keys=[user_id])
    fulfillments: Mapped[list["OrderFulfillment"]] = relationship(
        "OrderFulfillment",
        back_populates="order",
        cascade="all, delete-orphan",
    )
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
    # Revente sans stock : unit_price reste le prix de la boutique ; la marge du revendeur s'y ajoute pour le client.
    reseller_listing_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reseller_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    reseller_margin: Mapped[float] = mapped_column(Float, nullable=False, default=0, server_default="0")
    # Part AMAZER prelevee sur la marge (pourcentage fixe au moment de la commande).
    reseller_commission: Mapped[float] = mapped_column(Float, nullable=False, default=0, server_default="0")

    @property
    def customer_unit_price(self) -> float:
        """Prix unitaire paye par le client (prix boutique + marge eventuelle du revendeur)."""
        margin = float(self.reseller_margin or 0)
        return float(self.unit_price) + (margin / self.quantity if self.quantity else 0)

    order: Mapped[Order] = relationship("Order", back_populates="items")


class OrderFulfillment(Base):
    """Part d'une commande prise en charge par un vendeur (sous-commande).

    Chaque vendeur fait avancer sa propre preparation ; le statut global de la
    commande suit le vendeur le moins avance.
    """

    __tablename__ = "order_fulfillments"
    __table_args__ = (UniqueConstraint("order_id", "vendor_id", name="uq_order_fulfillments_order_vendor"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vendor_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="commande")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    order: Mapped[Order] = relationship("Order", back_populates="fulfillments")
    vendor: Mapped["Vendor"] = relationship("Vendor")
