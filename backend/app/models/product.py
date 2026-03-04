from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.cart import CartItem
    from app.models.category import Category
    from app.models.price_history import PriceHistory
    from app.models.vendor import Vendor


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_specs_gin", "specs", postgresql_using="gin"),
        Index(
            "ix_products_search_tsv",
            text(
                "to_tsvector('simple'::regconfig, (COALESCE(name, ''::character varying)::text "
                "|| ' '::text) || COALESCE(brand, ''::character varying)::text)"
            ),
            postgresql_using="gin",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    brand: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    main_image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_sponsored: Mapped[bool] = mapped_column(nullable=False, default=False)
    is_boosted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ad_banner_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    category_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("categories.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    specs: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    images: Mapped[list[ProductImage]] = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
    )
    prices: Mapped[list[Price]] = relationship(
        "Price",
        back_populates="product",
        cascade="all, delete-orphan",
    )
    cart_items: Mapped[list[CartItem]] = relationship("CartItem", back_populates="product")
    category: Mapped[Category | None] = relationship("Category", back_populates="products")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped[Product] = relationship("Product", back_populates="images")


class Price(Base):
    __tablename__ = "prices"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_prices_amount_positive"),
        CheckConstraint("stock_quantity >= 0", name="ck_prices_stock_non_negative"),
        Index("ix_prices_active_stock", "is_active", "stock_quantity"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vendor_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    product: Mapped[Product] = relationship("Product", back_populates="prices")
    vendor: Mapped[Vendor] = relationship("Vendor", back_populates="prices")
    history_entries: Mapped[list[PriceHistory]] = relationship(
        "PriceHistory",
        back_populates="price",
        cascade="all, delete-orphan",
    )
