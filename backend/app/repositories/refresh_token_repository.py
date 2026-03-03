from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.refresh_token import RefreshToken


class RefreshTokenRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, user_id: str, jti: str, expires_at: datetime) -> RefreshToken:
        record = RefreshToken(user_id=user_id, jti=jti, expires_at=expires_at)
        self.db.add(record)
        self.db.flush()
        return record

    def get_valid_by_jti(self, jti: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(
            RefreshToken.jti == jti,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > datetime.now(UTC),
        )
        return self.db.scalar(stmt)

    def revoke(self, token: RefreshToken) -> None:
        token.revoked = True
        self.db.add(token)
