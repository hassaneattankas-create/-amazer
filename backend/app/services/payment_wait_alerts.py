"""Alerte admin : un paiement Nita attend sa validation depuis plus d'une heure.

Le client a envoye sa reference mais personne ne l'a encore verifiee : sans rappel, sa commande
reste bloquee. Toutes les 15 minutes, chaque commande concernee (boutique ou restaurant) previent
les administrateurs une seule fois (le sujet de la notification sert de memoire).
"""

from __future__ import annotations

import logging
import threading
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.app_notification import AppNotification
from app.models.order import Order
from app.models.restaurant import RestaurantOrder
from app.models.user import User
from app.services.notification_service import NotificationPayload, NotificationService

logger = logging.getLogger(__name__)
WAIT_MINUTES = 60
_started = False


def _admin_ids(db: Session) -> list[str]:
    email = get_settings().admin_email.strip().lower()
    stmt = select(User.id).where(User.is_active.is_(True), or_(User.role == "admin", User.email == email))
    return list(db.scalars(stmt).all())


def _waiting(db: Session, model, now: datetime) -> list:
    """Paiements hors Amana, reference client recue, en attente depuis plus de WAIT_MINUTES."""
    return list(
        db.scalars(
            select(model)
            .where(
                model.payment_status != "paid",
                model.payment_mode != "amana",
                model.status != "annulee",
                model.transaction_code.is_not(None),
                model.created_at <= now - timedelta(minutes=WAIT_MINUTES),
                model.created_at >= now - timedelta(days=7),
            )
            .limit(100)
        ).all()
    )


def alert_waiting_payments(db: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    admins = _admin_ids(db)
    if not admins:
        return 0
    sent = 0
    service = NotificationService(db)
    for kind, model in (("commande", Order), ("restaurant", RestaurantOrder)):
        for order in _waiting(db, model, now):
            tag = f"admin-payment-wait-{order.id}"
            if db.scalar(select(AppNotification.id).where(AppNotification.tag == tag).limit(1)) is not None:
                continue
            label = getattr(order, "tracking_code", None) or getattr(order, "payment_reference", None) or order.id[:8].upper()
            for admin_id in admins:
                service.send_to_user(
                    user_id=admin_id,
                    payload=NotificationPayload(
                        title="Paiement à valider depuis plus d'1 h",
                        body=f"{'Commande restaurant' if kind == 'restaurant' else 'Commande'} #{label} : {int(round(float(order.total_amount or 0)))} XOF "
                        f"({str(order.payment_mode).upper()}). Le client attend la validation.",
                        data={"tag": tag, "href": "/admin/finance"},
                    ),
                )
            sent += 1
    return sent


def _run_once() -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        sent = alert_waiting_payments(db)
        db.commit()
        if sent:
            logger.info("Alerte admin : %s paiement(s) en attente depuis plus d'une heure.", sent)
    except Exception:  # noqa: BLE001 - un rappel ne doit jamais arreter le serveur
        db.rollback()
        logger.exception("Rappel des paiements en attente impossible.")
    finally:
        db.close()


def start_payment_wait_worker(interval_seconds: int = 15 * 60) -> None:
    """Toutes les 15 minutes (un seul fil par processus)."""
    global _started
    if _started:
        return
    _started = True

    def loop() -> None:
        stop = threading.Event()
        while not stop.is_set():
            _run_once()
            stop.wait(interval_seconds)

    threading.Thread(target=loop, name="payment-wait-alerts", daemon=True).start()
