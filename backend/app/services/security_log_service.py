from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.security_event import SecurityEvent

logger = logging.getLogger("amazer.security")


def log_security_event(
    db: Session,
    *,
    event_type: str,
    ip_address: str | None,
    path: str | None,
    details: dict[str, Any] | None = None,
) -> None:
    payload = details or {}
    logger.warning("SECURITY_EVENT type=%s ip=%s path=%s details=%s", event_type, ip_address, path, payload)
    event = SecurityEvent(
        event_type=event_type,
        ip_address=ip_address,
        path=path,
        details=payload,
    )
    db.add(event)
