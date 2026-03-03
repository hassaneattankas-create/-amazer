from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.refresh_tokens = RefreshTokenRepository(db)

    def register(self, email: str, full_name: str, password: str) -> User:
        existing = self.users.get_by_email(email)
        if existing:
            raise ConflictError("Email is already registered")

        try:
            user = self.users.create(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(password),
            )
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError("Email is already registered") from exc

        self.db.refresh(user)
        return user

    def login(self, email: str, password: str) -> dict[str, str]:
        user = self.users.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid credentials")
        if not user.is_active:
            raise ForbiddenError("Inactive user")

        tokens = self._issue_tokens(user.id)
        self.db.commit()
        return tokens

    def refresh(self, refresh_token: str) -> dict[str, str]:
        try:
            payload = decode_token(refresh_token)
        except ValueError as exc:
            raise UnauthorizedError("Invalid or expired refresh token") from exc
        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")

        user_id = payload.get("sub")
        jti = payload.get("jti")
        if not user_id or not jti:
            raise UnauthorizedError("Malformed token")

        token_record = self.refresh_tokens.get_valid_by_jti(jti)
        if not token_record:
            raise UnauthorizedError("Refresh token is not valid")

        user = self.users.get_by_id(user_id)
        if not user or not user.is_active:
            raise UnauthorizedError("User not available")

        self.refresh_tokens.revoke(token_record)
        tokens = self._issue_tokens(user.id)
        self.db.commit()
        return tokens

    def get_current_user(self, access_token: str) -> User:
        try:
            payload = decode_token(access_token)
        except ValueError as exc:
            raise UnauthorizedError("Invalid or expired access token") from exc
        if payload.get("type") != "access":
            raise UnauthorizedError("Invalid token type")

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Malformed token")

        user = self.users.get_by_id(user_id)
        if not user:
            raise NotFoundError("User not found")
        if not user.is_active:
            raise ForbiddenError("Inactive user")
        return user

    def _issue_tokens(self, user_id: str) -> dict[str, str]:
        access_token = create_access_token(subject=user_id)
        refresh_token, jti, expires_at = create_refresh_token(subject=user_id)
        self.refresh_tokens.create(user_id=user_id, jti=jti, expires_at=expires_at)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
