"""add receipt scans table for anti-fraud tracking

Revision ID: 20260302_0006
Revises: 20260301_0005
Create Date: 2026-03-02 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260302_0006"
down_revision: str | None = "20260301_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("receipt_scans"):
        op.create_table(
            "receipt_scans",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("order_id", sa.String(length=36), nullable=False),
            sa.Column("vendor_id", sa.String(length=36), nullable=True),
            sa.Column("ip_address", sa.String(length=64), nullable=True),
            sa.Column("gps", sa.String(length=120), nullable=True),
            sa.Column("result", sa.String(length=20), nullable=False, server_default="accepted"),
            sa.Column("scanned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_receipt_scans_order_id"), "receipt_scans", ["order_id"], unique=False)
        op.create_index(op.f("ix_receipt_scans_vendor_id"), "receipt_scans", ["vendor_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("receipt_scans"):
        op.drop_index(op.f("ix_receipt_scans_vendor_id"), table_name="receipt_scans")
        op.drop_index(op.f("ix_receipt_scans_order_id"), table_name="receipt_scans")
        op.drop_table("receipt_scans")
