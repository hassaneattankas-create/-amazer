from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.core.crypto import decrypt_payment_code, encrypt_payment_code
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.user_mfa import UserMfa
from app.models.user_preferences import UserPreferences
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.refresh_tokens = RefreshTokenRepository(db)

    def register(self, identifier: str, full_name: str, password: str) -> User:
        settings = get_settings()
        if self._is_whatsapp_identifier(identifier):
            whatsapp_phone = self._canonicalize_whatsapp(identifier)
            email = self._shadow_email_for_whatsapp(whatsapp_phone)
            existing = self.users.get_by_whatsapp_phone(whatsapp_phone)
        else:
            whatsapp_phone = None
            email = identifier.strip().lower()
            existing = self.users.get_by_email(email)
        if existing:
            raise ConflictError("Email ou WhatsApp deja enregistre")

        try:
            user = self.users.create(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(password),
                whatsapp_phone=whatsapp_phone,
                is_active=settings.auto_activate_new_accounts,
            )
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError("Email ou WhatsApp deja enregistre") from exc

        self.db.refresh(user)
        return user

    def login(self, identifier: str, password: str) -> dict[str, str]:
        if self._is_whatsapp_identifier(identifier):
            user = self.users.get_by_whatsapp_phone(self._canonicalize_whatsapp(identifier))
        else:
            user = self.users.get_by_email(identifier)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid credentials")
        if not user.is_active:
            raise ForbiddenError("Inactive user")

        self.refresh_tokens.revoke_all_for_user(user.id)
        tokens = self._issue_tokens(user.id)
        self._ensure_default_preferences(user.id)
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

    def save_mfa_secret(self, user: User, secret: str, enabled: bool = False) -> UserMfa:
        row = self.db.scalar(select(UserMfa).where(UserMfa.user_id == user.id))
        encrypted = encrypt_payment_code(secret)
        if row is None:
            row = UserMfa(user_id=user.id, secret_encrypted=encrypted, enabled=enabled)
            self.db.add(row)
        else:
            row.secret_encrypted = encrypted
            row.enabled = enabled
        self.db.flush()
        return row

    def get_mfa_secret(self, user: User) -> str | None:
        row = self.db.scalar(select(UserMfa).where(UserMfa.user_id == user.id))
        if row is None:
            return None
        return decrypt_payment_code(row.secret_encrypted)

    def get_mfa_status(self, user: User) -> tuple[bool, bool]:
        row = self.db.scalar(select(UserMfa.enabled).where(UserMfa.user_id == user.id))
        required = self._is_sensitive_account(user)
        return bool(row), required

    def _is_sensitive_account(self, user: User) -> bool:
        settings = get_settings()
        user_email = str(getattr(user, "email", "") or "").lower()
        if user_email and user_email == settings.admin_email.lower():
            return True
        return (
            self.db.scalar(select(SellerProfile.id).where(SellerProfile.user_id == user.id).limit(1))
            is not None
        )

    def _ensure_default_preferences(self, user_id: str) -> None:
        row = self.db.scalar(select(UserPreferences).where(UserPreferences.user_id == user_id))
        if row is None:
            self.db.add(UserPreferences(user_id=user_id, preferred_currency="XOF"))
            self.db.flush()

    def _is_whatsapp_identifier(self, identifier: str) -> bool:
        return "@" not in identifier

    def _canonicalize_whatsapp(self, value: str) -> str:
        digits = "".join(ch for ch in value if ch.isdigit())
        if digits.startswith("227"):
            return f"+{digits}"
        return f"+227{digits[-8:]}"

    def _shadow_email_for_whatsapp(self, whatsapp_phone: str) -> str:
        digits = "".join(ch for ch in whatsapp_phone if ch.isdigit())
        return f"wa-{digits}@users.amazer.ne"
