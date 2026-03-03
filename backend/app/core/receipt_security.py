from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from app.config import get_settings


def receipt_integrity_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def create_receipt_access_token(order_id: str, digest: str, ttl_hours: int = 72) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    claims = {
        "sub": order_id,
        "type": "receipt_access",
        "digest": digest,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=ttl_hours)).timestamp()),
    }
    return str(jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm))


def decode_receipt_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired receipt token") from exc
    if payload.get("type") != "receipt_access":
        raise ValueError("Invalid receipt token type")
    return payload
