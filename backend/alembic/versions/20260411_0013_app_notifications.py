"""add app notifications table

Revision ID: 20260411_0013
Revises: 20260305_0012
Create Date: 2026-04-11 10:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260411_0013"
down_revision: str | None = "20260305_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("app_notifications"):
        return

    op.create_table(
        "app_notifications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.String(length=500), nullable=False),
        sa.Column("tag", sa.String(length=160), nullable=False),
        sa.Column("href", sa.String(length=260), nullable=True),
        sa.Column("data", sa.JSON(), nullable=True),
        sa.Column("unread", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_app_notifications_user_id", "app_notifications", ["user_id"], unique=False)
    op.create_index("ix_app_notifications_tag", "app_notifications", ["tag"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("app_notifications"):
        return

    op.drop_index("ix_app_notifications_tag", table_name="app_notifications")
    op.drop_index("ix_app_notifications_user_id", table_name="app_notifications")
    op.drop_table("app_notifications")
