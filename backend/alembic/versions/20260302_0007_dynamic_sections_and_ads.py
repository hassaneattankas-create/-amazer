"""add dynamic sections ads clicks and boost fields

Revision ID: 20260302_0007
Revises: 20260302_0006
Create Date: 2026-03-02 17:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260302_0007"
down_revision: str | None = "20260302_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_column(inspector, "products", "is_boosted") is False:
        op.add_column("products", sa.Column("is_boosted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    if _has_column(inspector, "products", "ad_banner_url") is False:
        op.add_column("products", sa.Column("ad_banner_url", sa.String(length=1024), nullable=True))

    if _has_column(inspector, "finance_settings", "ad_boost_price") is False:
        op.add_column("finance_settings", sa.Column("ad_boost_price", sa.Float(), nullable=False, server_default=sa.text("2000")))
    if _has_column(inspector, "finance_settings", "ad_boost_duration_days") is False:
        op.add_column("finance_settings", sa.Column("ad_boost_duration_days", sa.Integer(), nullable=False, server_default=sa.text("7")))

    if not inspector.has_table("dynamic_sections"):
        op.create_table(
            "dynamic_sections",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("title", sa.String(length=120), nullable=False),
            sa.Column("slug", sa.String(length=140), nullable=False),
            sa.Column("section_type", sa.String(length=20), nullable=False, server_default="products"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_dynamic_sections_slug"), "dynamic_sections", ["slug"], unique=True)

    if not inspector.has_table("dynamic_section_items"):
        op.create_table(
            "dynamic_section_items",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("section_id", sa.String(length=36), nullable=False),
            sa.Column("target_type", sa.String(length=20), nullable=False, server_default="product"),
            sa.Column("product_id", sa.String(length=36), nullable=True),
            sa.Column("vendor_id", sa.String(length=36), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["section_id"], ["dynamic_sections.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_dynamic_section_items_product_id"), "dynamic_section_items", ["product_id"], unique=False)
        op.create_index(op.f("ix_dynamic_section_items_section_id"), "dynamic_section_items", ["section_id"], unique=False)
        op.create_index(op.f("ix_dynamic_section_items_vendor_id"), "dynamic_section_items", ["vendor_id"], unique=False)

    if not inspector.has_table("ad_clicks"):
        op.create_table(
            "ad_clicks",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("product_id", sa.String(length=36), nullable=False),
            sa.Column("section_slug", sa.String(length=140), nullable=True),
            sa.Column("ip_address", sa.String(length=64), nullable=True),
            sa.Column("user_agent", sa.String(length=512), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_ad_clicks_product_id"), "ad_clicks", ["product_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("ad_clicks"):
        op.drop_index(op.f("ix_ad_clicks_product_id"), table_name="ad_clicks")
        op.drop_table("ad_clicks")

    if inspector.has_table("dynamic_section_items"):
        op.drop_index(op.f("ix_dynamic_section_items_vendor_id"), table_name="dynamic_section_items")
        op.drop_index(op.f("ix_dynamic_section_items_section_id"), table_name="dynamic_section_items")
        op.drop_index(op.f("ix_dynamic_section_items_product_id"), table_name="dynamic_section_items")
        op.drop_table("dynamic_section_items")

    if inspector.has_table("dynamic_sections"):
        op.drop_index(op.f("ix_dynamic_sections_slug"), table_name="dynamic_sections")
        op.drop_table("dynamic_sections")

    if _has_column(inspector, "finance_settings", "ad_boost_duration_days"):
        op.drop_column("finance_settings", "ad_boost_duration_days")
    if _has_column(inspector, "finance_settings", "ad_boost_price"):
        op.drop_column("finance_settings", "ad_boost_price")
    if _has_column(inspector, "products", "ad_banner_url"):
        op.drop_column("products", "ad_banner_url")
    if _has_column(inspector, "products", "is_boosted"):
        op.drop_column("products", "is_boosted")
