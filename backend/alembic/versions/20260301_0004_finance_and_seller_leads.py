"""add finance settings seller leads and sponsored products

Revision ID: 20260301_0004
Revises: 20260301_0003
Create Date: 2026-03-01 20:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260301_0004"
down_revision: str | None = "20260301_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("finance_settings"):
        op.create_table(
            "finance_settings",
            sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
            sa.Column("commission_rate", sa.Float(), nullable=False),
            sa.Column("service_fee", sa.Float(), nullable=False),
            sa.Column("default_delivery_fee", sa.Float(), nullable=False),
            sa.Column("seller_subscription_fee", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.execute(
            """
            INSERT INTO finance_settings (commission_rate, service_fee, default_delivery_fee, seller_subscription_fee)
            VALUES (0.05, 200, 1500, 5000)
            """
        )

    if not inspector.has_table("seller_leads"):
        op.create_table(
            "seller_leads",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("shop_name", sa.String(length=140), nullable=False),
            sa.Column("district", sa.String(length=120), nullable=False),
            sa.Column("contact", sa.String(length=80), nullable=False),
            sa.Column("product_type", sa.String(length=140), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _has_column(inspector, "products", "is_sponsored"):
        op.add_column(
            "products",
            sa.Column("is_sponsored", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _has_column(inspector, "products", "is_sponsored"):
        op.drop_column("products", "is_sponsored")
    if inspector.has_table("seller_leads"):
        op.drop_table("seller_leads")
    if inspector.has_table("finance_settings"):
        op.drop_table("finance_settings")
