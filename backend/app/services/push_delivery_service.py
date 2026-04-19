from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import firebase_admin
from firebase_admin import credentials, messaging

from app.config import get_settings


FCM_TOKEN_PREFIX = "fcm:"
ANDROID_NOTIFICATION_CHANNEL_ID = "amazer-alerts"
INVALID_FCM_ERROR_CODES = {
    "invalid-argument",
    "registration-token-not-registered",
    "unregistered",
}


@dataclass(frozen=True)
class PushDeliveryResult:
    attempted: int = 0
    delivered: int = 0
    invalid_tokens: tuple[str, ...] = ()
    skipped: bool = False
    reason: str | None = None


def _decode_base64_payload(value: str) -> str:
    normalized = value.strip()
    padding = "=" * (-len(normalized) % 4)
    return base64.b64decode(f"{normalized}{padding}").decode("utf-8")


def _resolve_service_account_source() -> dict[str, Any] | str | None:
    settings = get_settings()
    if settings.firebase_service_account_json:
        return json.loads(settings.firebase_service_account_json)
    if settings.firebase_service_account_base64:
        return json.loads(_decode_base64_payload(settings.firebase_service_account_base64))
    if settings.firebase_service_account_path:
        return settings.firebase_service_account_path.strip() or None
    return None


@lru_cache(maxsize=1)
def get_firebase_app() -> firebase_admin.App | None:
    try:
        source = _resolve_service_account_source()
        if source is None:
            return None

        settings = get_settings()
        options = {"projectId": settings.firebase_project_id} if settings.firebase_project_id else None
        try:
            return firebase_admin.get_app("amazer-fcm")
        except ValueError:
            credential = credentials.Certificate(source)
            return firebase_admin.initialize_app(credential, options=options, name="amazer-fcm")
    except Exception as exc:
        print(f"[notification] firebase_init_failed: {exc}")
        return None


def extract_fcm_token(device_token: str) -> str | None:
    raw = (device_token or "").strip()
    if not raw.lower().startswith(FCM_TOKEN_PREFIX):
        return None
    normalized = raw[len(FCM_TOKEN_PREFIX) :].strip()
    return normalized or None


def extract_fcm_tokens(device_tokens: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for row in device_tokens:
        token = extract_fcm_token(row)
        if token is None or token in seen:
            continue
        seen.add(token)
        normalized.append(token)
    return normalized


def serialize_fcm_data(data: dict[str, Any] | None) -> dict[str, str]:
    if not data:
        return {}
    serialized: dict[str, str] = {}
    for key, value in data.items():
        if value is None:
            continue
        if isinstance(value, str):
            serialized[key] = value
            continue
        serialized[key] = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    return serialized


def _looks_like_invalid_token(error_code: str, error_message: str) -> bool:
    lowered_code = (error_code or "").strip().lower()
    lowered_message = (error_message or "").strip().lower()
    if lowered_code in INVALID_FCM_ERROR_CODES:
        return True
    return "not registered" in lowered_message or "unregistered" in lowered_message


def send_fcm_push(
    *,
    device_tokens: list[str],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> PushDeliveryResult:
    fcm_tokens = extract_fcm_tokens(device_tokens)
    if not fcm_tokens:
        return PushDeliveryResult(skipped=True, reason="no_fcm_tokens")

    app = get_firebase_app()
    if app is None:
        return PushDeliveryResult(
            attempted=len(fcm_tokens),
            skipped=True,
            reason="fcm_not_configured",
        )

    message = messaging.MulticastMessage(
        tokens=fcm_tokens,
        notification=messaging.Notification(title=title, body=body),
        data=serialize_fcm_data(data),
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(channel_id=ANDROID_NOTIFICATION_CHANNEL_ID),
        ),
    )
    try:
        response = messaging.send_each_for_multicast(message, app=app)
    except Exception as exc:
        print(f"[notification] fcm_send_failed: {exc}")
        return PushDeliveryResult(
            attempted=len(fcm_tokens),
            skipped=True,
            reason="fcm_send_failed",
        )

    invalid_tokens: list[str] = []
    for index, item in enumerate(response.responses):
        if item.success:
            continue
        code = str(getattr(item.exception, "code", "") or "")
        message_text = str(item.exception or "")
        if _looks_like_invalid_token(code, message_text):
            invalid_tokens.append(f"{FCM_TOKEN_PREFIX}{fcm_tokens[index]}")

    return PushDeliveryResult(
        attempted=len(fcm_tokens),
        delivered=int(response.success_count),
        invalid_tokens=tuple(invalid_tokens),
    )
