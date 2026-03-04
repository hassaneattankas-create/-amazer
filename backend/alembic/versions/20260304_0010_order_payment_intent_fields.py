"""add payment intent fields on orders

Revision ID: 20260304_0010
Revises: 20260304_0009
Create Date: 2026-03-04 23:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260304_0010"
down_revision: str | None = "20260304_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("orders"):
        return

    if not _has_column(inspector, "orders", "payment_reference"):
        op.add_column("orders", sa.Column("payment_reference", sa.String(length=40), nullable=True))
        op.create_index("ix_orders_payment_reference", "orders", ["payment_reference"], unique=True)

    if not _has_column(inspector, "orders", "payment_status"):
        op.add_column(
            "orders",
            sa.Column("payment_status", sa.String(length=20), nullable=False, server_default=sa.text("'paid'")),
        )

    if not _has_column(inspector, "orders", "payment_confirmed_at"):
        op.add_column("orders", sa.Column("payment_confirmed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("orders"):
        return
    if _has_column(inspector, "orders", "payment_confirmed_at"):
        op.drop_column("orders", "payment_confirmed_at")
    if _has_column(inspector, "orders", "payment_status"):
        op.drop_column("orders", "payment_status")
    if _has_column(inspector, "orders", "payment_reference"):
        op.drop_index("ix_orders_payment_reference", table_name="orders")
        op.drop_column("orders", "payment_reference")
