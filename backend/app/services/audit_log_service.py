from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def append_audit_log(
    db: Session,
    *,
    event_type: str,
    actor: User | None,
    ip_address: str | None,
    path: str | None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    row = AuditLog(
        event_type=event_type,
        actor_user_id=actor.id if actor else None,
        actor_email=actor.email if actor else None,
        ip_address=ip_address,
        path=path,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
    )
    db.add(row)
