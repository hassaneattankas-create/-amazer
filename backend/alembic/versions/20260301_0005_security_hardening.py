"""security hardening models and columns

Revision ID: 20260301_0005
Revises: 20260301_0004
Create Date: 2026-03-01 21:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260301_0005"
down_revision: str | None = "20260301_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("security_events"):
        op.create_table(
            "security_events",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("event_type", sa.String(length=80), nullable=False),
            sa.Column("ip_address", sa.String(length=64), nullable=True),
            sa.Column("path", sa.String(length=255), nullable=True),
            sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_security_events_event_type"), "security_events", ["event_type"], unique=False)

    if _has_column(inspector, "orders", "transaction_code") and not _has_column(inspector, "orders", "transaction_code_hash"):
        op.add_column("orders", sa.Column("transaction_code_hash", sa.String(length=64), nullable=True))
        op.create_index(op.f("ix_orders_transaction_code_hash"), "orders", ["transaction_code_hash"], unique=True)

    if not _has_column(inspector, "orders", "tracking_code"):
        op.add_column("orders", sa.Column("tracking_code", sa.String(length=120), nullable=True))

    if inspector.has_table("restaurant_orders"):
        if not _has_column(inspector, "restaurant_orders", "transaction_code"):
            op.add_column("restaurant_orders", sa.Column("transaction_code", sa.String(length=180), nullable=True))
        if not _has_column(inspector, "restaurant_orders", "transaction_code_hash"):
            op.add_column("restaurant_orders", sa.Column("transaction_code_hash", sa.String(length=64), nullable=True))
            op.create_index(
                op.f("ix_restaurant_orders_transaction_code_hash"),
                "restaurant_orders",
                ["transaction_code_hash"],
                unique=True,
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("restaurant_orders"):
        if _has_column(inspector, "restaurant_orders", "transaction_code_hash"):
            op.drop_index(op.f("ix_restaurant_orders_transaction_code_hash"), table_name="restaurant_orders")
            op.drop_column("restaurant_orders", "transaction_code_hash")
        if _has_column(inspector, "restaurant_orders", "transaction_code"):
            op.drop_column("restaurant_orders", "transaction_code")

    if inspector.has_table("orders"):
        if _has_column(inspector, "orders", "tracking_code"):
            op.drop_column("orders", "tracking_code")
        if _has_column(inspector, "orders", "transaction_code_hash"):
            op.drop_index(op.f("ix_orders_transaction_code_hash"), table_name="orders")
            op.drop_column("orders", "transaction_code_hash")

    if inspector.has_table("security_events"):
        op.drop_index(op.f("ix_security_events_event_type"), table_name="security_events")
        op.drop_table("security_events")
