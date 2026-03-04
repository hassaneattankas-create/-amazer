"""add global settings and keep seller soft delete compatible

Revision ID: 20260304_0008
Revises: 20260302_0007
Create Date: 2026-03-04 21:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260304_0008"
down_revision: str | None = "20260302_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("global_settings"):
        op.create_table(
            "global_settings",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("commission_rate", sa.Float(), nullable=False, server_default=sa.text("0.05")),
            sa.Column("service_fee", sa.Float(), nullable=False, server_default=sa.text("200")),
            sa.Column("default_delivery_fee", sa.Float(), nullable=False, server_default=sa.text("1500")),
            sa.Column("urban_delivery_fee", sa.Float(), nullable=False, server_default=sa.text("1500")),
            sa.Column("peripheral_delivery_fee", sa.Float(), nullable=False, server_default=sa.text("2200")),
            sa.Column("seller_subscription_fee", sa.Float(), nullable=False, server_default=sa.text("5000")),
            sa.Column("ad_boost_price", sa.Float(), nullable=False, server_default=sa.text("2000")),
            sa.Column("ad_boost_duration_days", sa.Integer(), nullable=False, server_default=sa.text("7")),
            sa.Column("ad_boost_price_24h", sa.Float(), nullable=False, server_default=sa.text("1000")),
            sa.Column("ad_boost_price_7d", sa.Float(), nullable=False, server_default=sa.text("2000")),
            sa.Column("launch_mode_zero_commission", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if inspector.has_table("finance_settings") and not _has_column(inspector, "finance_settings", "urban_delivery_fee"):
        op.add_column("finance_settings", sa.Column("urban_delivery_fee", sa.Float(), nullable=False, server_default=sa.text("1500")))
    if inspector.has_table("finance_settings") and not _has_column(inspector, "finance_settings", "peripheral_delivery_fee"):
        op.add_column("finance_settings", sa.Column("peripheral_delivery_fee", sa.Float(), nullable=False, server_default=sa.text("2200")))
    if inspector.has_table("finance_settings") and not _has_column(inspector, "finance_settings", "ad_boost_price_24h"):
        op.add_column("finance_settings", sa.Column("ad_boost_price_24h", sa.Float(), nullable=False, server_default=sa.text("1000")))
    if inspector.has_table("finance_settings") and not _has_column(inspector, "finance_settings", "ad_boost_price_7d"):
        op.add_column("finance_settings", sa.Column("ad_boost_price_7d", sa.Float(), nullable=False, server_default=sa.text("2000")))
    if inspector.has_table("finance_settings") and not _has_column(inspector, "finance_settings", "launch_mode_zero_commission"):
        op.add_column("finance_settings", sa.Column("launch_mode_zero_commission", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.execute(
        sa.text(
            """
            INSERT INTO global_settings
            (
              commission_rate,
              service_fee,
              default_delivery_fee,
              urban_delivery_fee,
              peripheral_delivery_fee,
              seller_subscription_fee,
              ad_boost_price,
              ad_boost_duration_days,
              ad_boost_price_24h,
              ad_boost_price_7d,
              launch_mode_zero_commission
            )
            SELECT
              COALESCE(fs.commission_rate, 0.05),
              COALESCE(fs.service_fee, 200),
              COALESCE(fs.default_delivery_fee, 1500),
              COALESCE(fs.urban_delivery_fee, fs.default_delivery_fee, 1500),
              COALESCE(fs.peripheral_delivery_fee, 2200),
              COALESCE(fs.seller_subscription_fee, 5000),
              COALESCE(fs.ad_boost_price, 2000),
              COALESCE(fs.ad_boost_duration_days, 7),
              COALESCE(fs.ad_boost_price_24h, 1000),
              COALESCE(fs.ad_boost_price_7d, fs.ad_boost_price, 2000),
              COALESCE(fs.launch_mode_zero_commission, false)
            FROM finance_settings fs
            WHERE NOT EXISTS (SELECT 1 FROM global_settings)
            LIMIT 1
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("global_settings"):
        op.drop_table("global_settings")
