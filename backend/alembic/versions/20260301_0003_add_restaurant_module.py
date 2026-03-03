"""add restaurant module tables

Revision ID: 20260301_0003
Revises: 20260301_0002
Create Date: 2026-03-01 19:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260301_0003"
down_revision: str | None = "20260301_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("restaurant_menu_items"):
        op.create_table(
            "restaurant_menu_items",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("vendor_id", sa.String(length=36), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("description", sa.String(length=1200), nullable=True),
            sa.Column("image_url", sa.String(length=1024), nullable=True),
            sa.Column("base_price", sa.Float(), nullable=False),
            sa.Column("currency", sa.String(length=3), nullable=False),
            sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("estimated_prep_minutes", sa.Integer(), nullable=False, server_default="20"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_restaurant_menu_items_vendor_id"),
            "restaurant_menu_items",
            ["vendor_id"],
            unique=False,
        )

    if not inspector.has_table("restaurant_orders"):
        op.create_table(
            "restaurant_orders",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("vendor_id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=True),
            sa.Column("customer_name", sa.String(length=120), nullable=False),
            sa.Column("customer_phone", sa.String(length=40), nullable=False),
            sa.Column("delivery_address", sa.String(length=220), nullable=False),
            sa.Column("distance_km", sa.Float(), nullable=False),
            sa.Column("delivery_minutes", sa.Integer(), nullable=False),
            sa.Column("payment_mode", sa.String(length=30), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("total_amount", sa.Float(), nullable=False),
            sa.Column("currency", sa.String(length=3), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_restaurant_orders_vendor_id"), "restaurant_orders", ["vendor_id"], unique=False)
        op.create_index(op.f("ix_restaurant_orders_user_id"), "restaurant_orders", ["user_id"], unique=False)

    if not inspector.has_table("restaurant_order_items"):
        op.create_table(
            "restaurant_order_items",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("order_id", sa.String(length=36), nullable=False),
            sa.Column("menu_item_id", sa.String(length=36), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("selected_options", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("unit_price", sa.Float(), nullable=False),
            sa.Column("subtotal", sa.Float(), nullable=False),
            sa.ForeignKeyConstraint(["order_id"], ["restaurant_orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["menu_item_id"], ["restaurant_menu_items.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_restaurant_order_items_order_id"),
            "restaurant_order_items",
            ["order_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("restaurant_order_items"):
        op.drop_index(op.f("ix_restaurant_order_items_order_id"), table_name="restaurant_order_items")
        op.drop_table("restaurant_order_items")

    if inspector.has_table("restaurant_orders"):
        op.drop_index(op.f("ix_restaurant_orders_user_id"), table_name="restaurant_orders")
        op.drop_index(op.f("ix_restaurant_orders_vendor_id"), table_name="restaurant_orders")
        op.drop_table("restaurant_orders")

    if inspector.has_table("restaurant_menu_items"):
        op.drop_index(op.f("ix_restaurant_menu_items_vendor_id"), table_name="restaurant_menu_items")
        op.drop_table("restaurant_menu_items")
