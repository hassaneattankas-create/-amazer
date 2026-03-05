"""add user preferences table

Revision ID: 20260305_0011
Revises: 20260304_0010
Create Date: 2026-03-05 11:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260305_0011"
down_revision: str | None = "20260304_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("user_preferences"):
        return

    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("preferred_currency", sa.String(length=3), nullable=False, server_default=sa.text("'XOF'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("user_preferences"):
        op.drop_table("user_preferences")

