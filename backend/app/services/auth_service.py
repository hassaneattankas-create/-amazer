import secrets
from datetime import UTC, datetime, timedelta

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
from app.models.login_verification_code import LoginVerificationCode
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.user_mfa import UserMfa
from app.models.user_preferences import UserPreferences
from app.services.notification_service import send_login_verification_code
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

    def login(self, email: str, password: str, mfa_code: str | None = None) -> dict[str, str]:
        user = self.users.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid credentials")
        if not user.is_active:
            raise ForbiddenError("Inactive user")

        if not mfa_code:
            destination_masked = self._issue_login_verification_code(user)
            raise UnauthorizedError(f"Code de connexion envoye a {destination_masked}")
        if not self._consume_login_verification_code(user, mfa_code):
            raise UnauthorizedError("Invalid verification code")

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

    def _resolve_login_channel(self, user: User) -> tuple[str, str, str]:
        profile = self.db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
        phone = (profile.phone if profile else None) or ""
        if phone.strip():
            return "sms", phone.strip(), self._mask_phone(phone.strip())
        email = str(user.email).strip().lower()
        return "email", email, self._mask_email(email)

    def _issue_login_verification_code(self, user: User) -> str:
        now = datetime.now(UTC)
        latest = self.db.scalar(
            select(LoginVerificationCode)
            .where(
                LoginVerificationCode.user_id == user.id,
                LoginVerificationCode.consumed_at.is_(None),
                LoginVerificationCode.expires_at > now,
            )
            .order_by(LoginVerificationCode.created_at.desc())
            .limit(1)
        )
        if latest and (now - latest.created_at).total_seconds() < 45:
            return latest.destination_masked

        channel, destination, destination_masked = self._resolve_login_channel(user)
        code = f"{secrets.randbelow(1_000_000):06d}"
        hashed = payment_code_hash(f"{user.id}:{code}")
        row = LoginVerificationCode(
            user_id=user.id,
            channel=channel,
            destination_masked=destination_masked,
            code_hash=hashed,
            attempt_count=0,
            expires_at=now + timedelta(minutes=5),
            consumed_at=None,
        )
        self.db.add(row)
        self.db.flush()
        send_login_verification_code(channel=channel, destination=destination, code=code)
        self.db.commit()
        return destination_masked

    def _consume_login_verification_code(self, user: User, code: str) -> bool:
        now = datetime.now(UTC)
        provided_hash = payment_code_hash(f"{user.id}:{code.strip()}")
        row = self.db.scalar(
            select(LoginVerificationCode)
            .where(
                LoginVerificationCode.user_id == user.id,
                LoginVerificationCode.consumed_at.is_(None),
                LoginVerificationCode.expires_at > now,
                LoginVerificationCode.code_hash == provided_hash,
            )
            .order_by(LoginVerificationCode.created_at.desc())
            .limit(1)
        )
        if row is None:
            latest = self.db.scalar(
                select(LoginVerificationCode)
                .where(
                    LoginVerificationCode.user_id == user.id,
                    LoginVerificationCode.consumed_at.is_(None),
                    LoginVerificationCode.expires_at > now,
                )
                .order_by(LoginVerificationCode.created_at.desc())
                .limit(1)
            )
            if latest is not None:
                latest.attempt_count += 1
                self.db.commit()
            return False

        row.consumed_at = now
        other_active = self.db.scalars(
            select(LoginVerificationCode).where(
                LoginVerificationCode.user_id == user.id,
                LoginVerificationCode.consumed_at.is_(None),
                LoginVerificationCode.id != row.id,
            )
        ).all()
        for entry in other_active:
            entry.consumed_at = now
        return True

    def _mask_email(self, email: str) -> str:
        name, _, domain = email.partition("@")
        if not name or not domain:
            return "***"
        if len(name) <= 2:
            masked_name = f"{name[0]}*" if len(name) == 2 else "*"
        else:
            masked_name = f"{name[0]}{'*' * (len(name) - 2)}{name[-1]}"
        return f"{masked_name}@{domain}"

    def _mask_phone(self, phone: str) -> str:
        digits = "".join(ch for ch in phone if ch.isdigit())
        if len(digits) <= 4:
            return "****"
        return f"{'*' * (len(digits) - 4)}{digits[-4:]}"
