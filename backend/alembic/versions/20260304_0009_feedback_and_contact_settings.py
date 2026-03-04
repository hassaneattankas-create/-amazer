"""add customer feedback and global settings contact fields

Revision ID: 20260304_0009
Revises: 20260304_0008
Create Date: 2026-03-04 23:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260304_0009"
down_revision: str | None = "20260304_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("global_settings"):
        if not _has_column(inspector, "global_settings", "support_email"):
            op.add_column("global_settings", sa.Column("support_email", sa.String(length=255), nullable=True))
        if not _has_column(inspector, "global_settings", "support_phone"):
            op.add_column("global_settings", sa.Column("support_phone", sa.String(length=40), nullable=True))
        if not _has_column(inspector, "global_settings", "support_whatsapp"):
            op.add_column("global_settings", sa.Column("support_whatsapp", sa.String(length=40), nullable=True))

    if not inspector.has_table("customer_feedback"):
        op.create_table(
            "customer_feedback",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("full_name", sa.String(length=140), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column("message", sa.String(length=2000), nullable=False),
            sa.Column("rating", sa.Integer(), nullable=False, server_default=sa.text("5")),
            sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_customer_feedback_user_id", "customer_feedback", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("customer_feedback"):
        op.drop_index("ix_customer_feedback_user_id", table_name="customer_feedback")
        op.drop_table("customer_feedback")

    if inspector.has_table("global_settings"):
        if _has_column(inspector, "global_settings", "support_whatsapp"):
            op.drop_column("global_settings", "support_whatsapp")
        if _has_column(inspector, "global_settings", "support_phone"):
            op.drop_column("global_settings", "support_phone")
        if _has_column(inspector, "global_settings", "support_email"):
            op.drop_column("global_settings", "support_email")
