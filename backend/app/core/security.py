from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def _create_token(
    subject: str,
    expires_delta: timedelta,
    token_type: str,
    jti: str | None = None,
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "type": token_type,
        "jti": jti or str(uuid4()),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return cast(str, token)


def create_access_token(subject: str) -> str:
    return _create_token(
        subject=subject,
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
        token_type="access",
    )


def create_refresh_token(subject: str) -> tuple[str, str, datetime]:
    expires_delta = timedelta(days=settings.jwt_refresh_token_expire_days)
    now = datetime.now(UTC)
    jti = str(uuid4())
    token = _create_token(
        subject=subject,
        expires_delta=expires_delta,
        token_type="refresh",
        jti=jti,
    )
    expires_at = now + expires_delta
    return token, jti, expires_at


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return cast(dict[str, Any], payload)
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
