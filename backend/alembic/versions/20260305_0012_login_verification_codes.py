"""add login verification codes table

Revision ID: 20260305_0012
Revises: 20260305_0011
Create Date: 2026-03-05 11:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260305_0012"
down_revision: str | None = "20260305_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("login_verification_codes"):
        return

    op.create_table(
        "login_verification_codes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("channel", sa.String(length=12), nullable=False),
        sa.Column("destination_masked", sa.String(length=140), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_login_verification_codes_user_id", "login_verification_codes", ["user_id"], unique=False)
    op.create_index("ix_login_verification_codes_code_hash", "login_verification_codes", ["code_hash"], unique=False)
    op.create_index(
        "ix_login_verification_codes_expires_at",
        "login_verification_codes",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "ix_login_verification_codes_created_at",
        "login_verification_codes",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("login_verification_codes"):
        return

    op.drop_index("ix_login_verification_codes_created_at", table_name="login_verification_codes")
    op.drop_index("ix_login_verification_codes_expires_at", table_name="login_verification_codes")
    op.drop_index("ix_login_verification_codes_code_hash", table_name="login_verification_codes")
    op.drop_index("ix_login_verification_codes_user_id", table_name="login_verification_codes")
    op.drop_table("login_verification_codes")

