"""Alerte l'admin (notification in-app + push) quand une erreur serveur (500) survient.
Monitoring leger, sans dependance externe : l'admin est prevenu avant les clients.

Anti-spam : au plus une alerte par signature (chemin + type d'erreur) toutes les
ALERT_WINDOW_SECONDS, en memoire process.
"""
from __future__ import annotations

import logging
import time

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models.user import User
from app.services.notification_service import NotificationPayload, NotificationService

logger = logging.getLogger(__name__)

ALERT_WINDOW_SECONDS = 600  # 10 min par signature d'erreur
_last_sent: dict[str, float] = {}


def alert_admin_error(*, path: str, method: str, exc: BaseException) -> None:
    """Best-effort : ne leve jamais (appele depuis le handler d'exception)."""
    try:
        signature = f"{method}:{path}:{type(exc).__name__}"
        now = time.monotonic()
        last = _last_sent.get(signature)
        if last is not None and (now - last) < ALERT_WINDOW_SECONDS:
            return
        _last_sent[signature] = now

        settings = get_settings()
        admin_email = (settings.admin_email or "").strip().lower()
        if not admin_email:
            return

        db = SessionLocal()
        try:
            admin = db.scalar(select(User).where(User.email == admin_email))
            if admin is None:
                return
            detail = f"{type(exc).__name__}: {exc}"[:300]
            NotificationService(db).send_to_user(
                user_id=admin.id,
                payload=NotificationPayload(
                    title="⚠️ Erreur serveur AMAZER",
                    body=f"{method} {path}\n{detail}",
                    data={
                        "tag": f"error-{signature}",
                        "href": "/admin",
                        "kind": "server_error",
                    },
                ),
            )
            db.commit()
        finally:
            db.close()
    except Exception:
        logger.exception("alert_admin_error failed")
