from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import logging
import secrets
from uuid import uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.phone import normalize_phone
from app.core.permissions import is_admin
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
from app.models.login_verification_code import LoginVerificationCode
from app.models.product import Price
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.vendor import Vendor
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.services.seller_profile_service import create_or_update_seller_profile
from app.services.email_delivery_service import send_verification_code_email
from app.services.verification_delivery_service import send_verification_code_via_whatsapp

logger = logging.getLogger(__name__)

# Canal dedie : un code de reinitialisation ne peut jamais servir a verifier un compte, et inversement.
RESET_CHANNEL = "reset"
# Adresse interne des comptes crees avec un numero seul (la colonne email est obligatoire).
SHADOW_EMAIL_DOMAIN = "@users.amazer.ne"


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.refresh_tokens = RefreshTokenRepository(db)

    def register(
        self,
        identifier: str,
        full_name: str,
        password: str,
        seller_profile: dict | None = None,
        contact_email: str | None = None,
        contact_phone: str | None = None,
    ) -> dict[str, str | bool | None]:
        settings = get_settings()
        if self._is_whatsapp_identifier(identifier):
            whatsapp_phone = self._canonicalize_whatsapp(identifier)
            email = self._shadow_email_for_whatsapp(whatsapp_phone)
            existing = self.users.get_by_whatsapp_phone(whatsapp_phone)
        else:
            whatsapp_phone = None
            email = identifier.strip().lower()
            existing = self.users.get_by_email(email)
        # E-mail ET WhatsApp (comme les grandes plateformes) : connexion avec l'un ou l'autre,
        # et notifications recues sur les deux canaux.
        if contact_email and email.endswith(SHADOW_EMAIL_DOMAIN):
            email = contact_email.strip().lower()
            existing = existing or self.users.get_by_email(email)
        if contact_phone and whatsapp_phone is None:
            whatsapp_phone = self._canonicalize_whatsapp(contact_phone)
            existing = existing or self.users.get_by_whatsapp_phone(whatsapp_phone)
        if settings.is_production() and email.strip().lower().endswith("@amazer.demo"):
            raise ConflictError(
                "Les adresses @amazer.demo sont reservees aux comptes demonstration configures par la plateforme."
            )
        # Le compte admin est cree au demarrage (ADMIN_PASSWORD), jamais par inscription
        # publique : sinon un inconnu pourrait le reserver et obtenir les droits admin.
        if existing or email == settings.admin_email.strip().lower():
            raise ConflictError("Email ou WhatsApp deja enregistre")

        is_active = not settings.registration_requires_verification and settings.auto_activate_new_accounts
        try:
            user = self.users.create(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(password),
                whatsapp_phone=whatsapp_phone,
                is_active=is_active,
            )
            if seller_profile:
                create_or_update_seller_profile(self.db, user=user, payload=seller_profile)
            verification_meta = self._build_registration_verification(user) if not is_active else {
                "channel": "none",
                "destination_masked": "",
                "code_preview": None,
            }
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError("Email ou WhatsApp deja enregistre") from exc
        except Exception:
            self.db.rollback()
            raise

        self.db.refresh(user)
        return {
            "success": True,
            "user_id": user.id,
            "email": user.email,
            "verification_channel": str(verification_meta["channel"]),
            "verification_destination_masked": str(verification_meta["destination_masked"]),
            "verification_code_preview": verification_meta["code_preview"],
        }

    def verify_account(self, identifier: str, code: str) -> dict[str, str | bool]:
        settings = get_settings()
        user = self._get_user_by_identifier(identifier)
        if user is None:
            raise NotFoundError("Compte introuvable")
        if user.is_active:
            return {"success": True, "message": "Compte déjà vérifié"}

        record = self.db.scalar(
            select(LoginVerificationCode)
            .where(
                LoginVerificationCode.user_id == user.id,
                LoginVerificationCode.consumed_at.is_(None),
                LoginVerificationCode.channel != RESET_CHANNEL,
            )
            .order_by(LoginVerificationCode.created_at.desc())
            .limit(1)
        )
        if record is None or record.expires_at <= datetime.now(UTC):
            raise UnauthorizedError("Code de vérification expiré ou introuvable.")
        if record.attempt_count >= settings.verification_code_max_attempts:
            raise ForbiddenError("Code de vérification bloqué : recommencez l'inscription ou contactez AMAZER.")

        expected_hash = self._hash_verification_code(user.id, code)
        if record.code_hash != expected_hash:
            record.attempt_count += 1
            self.db.commit()
            raise UnauthorizedError("Code de vérification invalide.")

        record.consumed_at = datetime.now(UTC)
        user.is_active = True
        self._ensure_default_preferences(user.id)
        self.db.commit()
        return {"success": True, "message": "Compte verifie avec succes"}

    def login(self, identifier: str, password: str) -> dict[str, str]:
        user = self._get_user_by_identifier(identifier)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid credentials")
        if not user.is_active:
            email_lower = user.email.strip().lower()
            if email_lower.endswith("@amazer.demo"):
                user.is_active = True
                self.db.execute(delete(LoginVerificationCode).where(LoginVerificationCode.user_id == user.id))
                self.db.flush()
                logger.info(
                    "Compte demonstration @amazer.demo active a la connexion (mot de passe valide): %s",
                    email_lower,
                )
            else:
                raise ForbiddenError("Account verification required")

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

    def close_account(self, user: User, password: str) -> None:
        settings = get_settings()
        if is_admin(user):
            raise ForbiddenError(
                "Le compte administrateur ne peut pas etre supprime depuis l'application."
            )
        if not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid credentials")

        profile = self.db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
        if profile is not None:
            vendor = self.db.get(Vendor, profile.vendor_id)
            if vendor is not None:
                vendor.is_active = False
            self.db.execute(update(Price).where(Price.vendor_id == profile.vendor_id).values(is_active=False))
            profile.phone = None
            profile.address = None
            profile.description = "Compte vendeur supprime"
            profile.whatsapp_contact = None
            profile.contact_email = None
            profile.is_verified = False

        marker = f"deleted-{user.id[:8]}-{uuid4().hex[:10]}"
        user.email = f"{marker}@users.deleted.amazer.ne"
        user.full_name = "Compte supprime"
        user.whatsapp_phone = None
        user.hashed_password = hash_password(secrets.token_urlsafe(32))
        user.is_active = False
        self.refresh_tokens.revoke_all_for_user(user.id)
        self.db.commit()

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

    def _ensure_default_preferences(self, user_id: str) -> None:
        self.db.execute(
            insert(UserPreferences)
            .values(user_id=user_id, preferred_currency="XOF")
            .on_conflict_do_nothing(index_elements=[UserPreferences.user_id])
        )

    def _build_registration_verification(self, user: User) -> dict[str, str | None]:
        settings = get_settings()
        code = self._generate_verification_code()
        # E-mail en priorite quand il est reel : c'est le canal configure (Brevo).
        channel = "whatsapp" if user.whatsapp_phone and user.email.endswith(SHADOW_EMAIL_DOMAIN) else "email"
        destination = user.whatsapp_phone if channel == "whatsapp" else user.email
        destination_masked = self._mask_destination(destination)

        self.db.execute(
            delete(LoginVerificationCode).where(
                LoginVerificationCode.user_id == user.id,
                LoginVerificationCode.consumed_at.is_(None),
            )
        )
        self.db.add(
            LoginVerificationCode(
                user_id=user.id,
                channel=channel,
                destination_masked=destination_masked,
                code_hash=self._hash_verification_code(user.id, code),
                expires_at=datetime.now(UTC) + timedelta(minutes=settings.verification_code_ttl_minutes),
            )
        )
        self.db.flush()

        delivered = False
        if channel == "whatsapp" and user.whatsapp_phone:
            delivered = send_verification_code_via_whatsapp(user.whatsapp_phone, code)
            if not delivered:
                logger.warning("WhatsApp verification fallback active for %s", destination_masked)
        else:
            delivered = send_verification_code_email(user.email, code, purpose="verify")
            if not delivered:
                logger.warning("Email verification not delivered; preview fallback active.")

        if settings.is_production() and not delivered:
            raise ForbiddenError("Verification WhatsApp n'est pas encore configure en production")

        return {
            "channel": channel,
            "destination_masked": destination_masked,
            "code_preview": None if settings.is_production() else code,
        }

    def request_password_reset(self, identifier: str) -> dict[str, str | None]:
        """Envoie un code de reinitialisation. Reponse identique que le compte existe ou non."""
        settings = get_settings()
        user = self._get_user_by_identifier(identifier)
        if user is None or not user.is_active:
            return {"code_preview": None}

        code = self._generate_verification_code()
        has_real_email = not user.email.endswith(SHADOW_EMAIL_DOMAIN)
        destination = user.email if has_real_email else (user.whatsapp_phone or user.email)
        self.db.execute(
            delete(LoginVerificationCode).where(
                LoginVerificationCode.user_id == user.id,
                LoginVerificationCode.channel == RESET_CHANNEL,
                LoginVerificationCode.consumed_at.is_(None),
            )
        )
        self.db.add(
            LoginVerificationCode(
                user_id=user.id,
                channel=RESET_CHANNEL,
                destination_masked=self._mask_destination(destination),
                code_hash=self._hash_verification_code(user.id, code),
                expires_at=datetime.now(UTC) + timedelta(minutes=settings.verification_code_ttl_minutes),
            )
        )
        self.db.commit()

        # E-mail reel d'abord (canal configure), WhatsApp en secours.
        delivered = send_verification_code_email(user.email, code, purpose="reset") if has_real_email else False
        if not delivered and user.whatsapp_phone:
            delivered = send_verification_code_via_whatsapp(user.whatsapp_phone, code)
        if not delivered:
            logger.warning("Code de reinitialisation non delivre (canal absent ou envoi en echec) pour %s", user.id)
        return {"code_preview": None if settings.is_production() else code}

    def reset_password(self, identifier: str, code: str, new_password: str) -> None:
        settings = get_settings()
        user = self._get_user_by_identifier(identifier)
        if user is None or not user.is_active:
            raise UnauthorizedError("Code de réinitialisation invalide ou expiré.")
        record = self.db.scalar(
            select(LoginVerificationCode)
            .where(
                LoginVerificationCode.user_id == user.id,
                LoginVerificationCode.channel == RESET_CHANNEL,
                LoginVerificationCode.consumed_at.is_(None),
            )
            .order_by(LoginVerificationCode.created_at.desc())
            .limit(1)
        )
        if record is None or record.expires_at <= datetime.now(UTC):
            raise UnauthorizedError("Code de réinitialisation invalide ou expiré.")
        if record.attempt_count >= settings.verification_code_max_attempts:
            raise ForbiddenError("Trop de tentatives. Demandez un nouveau code.")
        if record.code_hash != self._hash_verification_code(user.id, code):
            record.attempt_count += 1
            self.db.commit()
            raise UnauthorizedError("Code de réinitialisation invalide ou expiré.")

        record.consumed_at = datetime.now(UTC)
        user.hashed_password = hash_password(new_password)
        # Toutes les sessions ouvertes avec l'ancien mot de passe sont fermees.
        self.refresh_tokens.revoke_all_for_user(user.id)
        self.db.commit()

    def _get_user_by_identifier(self, identifier: str) -> User | None:
        if self._is_whatsapp_identifier(identifier):
            return self.users.get_by_whatsapp_phone(self._canonicalize_whatsapp(identifier))
        return self.users.get_by_email(identifier.strip().lower())

    def _is_whatsapp_identifier(self, identifier: str) -> bool:
        return "@" not in identifier

    def _canonicalize_whatsapp(self, value: str) -> str:
        # Numero international (E.164) ; 8 chiffres sans indicatif = Niger.
        phone = normalize_phone(value)
        if phone is None:
            digits = "".join(ch for ch in value if ch.isdigit())
            return f"+{digits}" if digits else value
        return phone

    def _shadow_email_for_whatsapp(self, whatsapp_phone: str) -> str:
        digits = "".join(ch for ch in whatsapp_phone if ch.isdigit())
        return f"wa-{digits}{SHADOW_EMAIL_DOMAIN}"

    def _generate_verification_code(self) -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    def _hash_verification_code(self, user_id: str, code: str) -> str:
        payload = f"{user_id}:{code.strip()}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _mask_destination(self, destination: str) -> str:
        cleaned = destination.strip()
        if "@" in cleaned:
            local_part, domain = cleaned.split("@", 1)
            if len(local_part) <= 2:
                return f"{local_part[0]}***@{domain}" if local_part else f"***@{domain}"
            return f"{local_part[:2]}***@{domain}"
        digits = "".join(ch for ch in cleaned if ch.isdigit())
        if len(digits) <= 4:
            return f"***{digits}"
        return f"+{digits[:3]}***{digits[-2:]}"
