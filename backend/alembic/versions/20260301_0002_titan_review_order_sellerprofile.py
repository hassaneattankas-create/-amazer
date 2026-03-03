"""titan edition add seller profile reviews and orders

Revision ID: 20260301_0002
Revises: 69bf07fdd8c9
Create Date: 2026-03-01 18:15:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260301_0002"
down_revision: str | None = "69bf07fdd8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("seller_profiles"):
        op.create_table(
            "seller_profiles",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("vendor_id", sa.String(length=36), nullable=False),
            sa.Column("business_name", sa.String(length=140), nullable=False),
            sa.Column("phone", sa.String(length=40), nullable=True),
            sa.Column("city", sa.String(length=80), nullable=False),
            sa.Column("address", sa.String(length=220), nullable=True),
            sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id"),
            sa.UniqueConstraint("vendor_id"),
        )
        op.create_index(op.f("ix_seller_profiles_user_id"), "seller_profiles", ["user_id"], unique=True)
        op.create_index(op.f("ix_seller_profiles_vendor_id"), "seller_profiles", ["vendor_id"], unique=True)

    if not inspector.has_table("reviews"):
        op.create_table(
            "reviews",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("product_id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("rating", sa.Float(), nullable=False),
            sa.Column("comment", sa.Text(), nullable=False),
            sa.Column("photo_url", sa.String(length=1024), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
        )
        op.create_index(op.f("ix_reviews_product_id"), "reviews", ["product_id"], unique=False)
        op.create_index(op.f("ix_reviews_user_id"), "reviews", ["user_id"], unique=False)

    if not inspector.has_table("orders"):
        op.create_table(
            "orders",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("payment_mode", sa.String(length=30), nullable=False),
            sa.Column("delivery_type", sa.String(length=30), nullable=False),
            sa.Column("transaction_code", sa.String(length=120), nullable=True),
            sa.Column("tracking_code", sa.String(length=120), nullable=True),
            sa.Column("estimated_minutes", sa.Integer(), nullable=False),
            sa.Column("total_amount", sa.Float(), nullable=False),
            sa.Column("currency", sa.String(length=3), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_orders_user_id"), "orders", ["user_id"], unique=False)
    else:
        if not _has_column(inspector, "orders", "tracking_code"):
            op.add_column("orders", sa.Column("tracking_code", sa.String(length=120), nullable=True))

    if not inspector.has_table("order_items"):
        op.create_table(
            "order_items",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("order_id", sa.String(length=36), nullable=False),
            sa.Column("product_id", sa.String(length=36), nullable=False),
            sa.Column("vendor_id", sa.String(length=36), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("unit_price", sa.Float(), nullable=False),
            sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_order_items_order_id"), "order_items", ["order_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("order_items"):
        op.drop_index(op.f("ix_order_items_order_id"), table_name="order_items")
        op.drop_table("order_items")

    if inspector.has_table("orders"):
        if _has_column(inspector, "orders", "tracking_code"):
            op.drop_column("orders", "tracking_code")
        op.drop_index(op.f("ix_orders_user_id"), table_name="orders")
        op.drop_table("orders")

    if inspector.has_table("reviews"):
        op.drop_index(op.f("ix_reviews_user_id"), table_name="reviews")
        op.drop_index(op.f("ix_reviews_product_id"), table_name="reviews")
        op.drop_table("reviews")

    if inspector.has_table("seller_profiles"):
        op.drop_index(op.f("ix_seller_profiles_vendor_id"), table_name="seller_profiles")
        op.drop_index(op.f("ix_seller_profiles_user_id"), table_name="seller_profiles")
        op.drop_table("seller_profiles")
