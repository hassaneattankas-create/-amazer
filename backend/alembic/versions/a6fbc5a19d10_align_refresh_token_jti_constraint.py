"""align refresh token jti uniqueness with ORM metadata

Revision ID: a6fbc5a19d10
Revises: c152e80741bb
Create Date: 2026-02-26 17:15:00
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a6fbc5a19d10"
down_revision: str | None = "c152e80741bb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'refresh_tokens_jti_key'
            ) THEN
                ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_jti_key;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'refresh_tokens_jti_key'
            ) THEN
                ALTER TABLE refresh_tokens
                ADD CONSTRAINT refresh_tokens_jti_key UNIQUE (jti);
            END IF;
        END $$;
        """
    )
