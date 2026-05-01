"""Rappels renouvellement abonnement vendeur (in-app + push via NotificationService)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.app_notification import AppNotification
from app.models.seller_profile import SellerProfile
from app.services.notification_service import NotificationPayload, NotificationService

logger = logging.getLogger(__name__)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _notification_exists(db: Session, *, user_id: str, tag: str) -> bool:
    return (
        db.scalar(
            select(AppNotification.id).where(
                AppNotification.user_id == user_id,
                AppNotification.tag == tag,
            ).limit(1)
        )
        is not None
    )


def maybe_send_seller_subscription_reminders(
    db: Session,
    *,
    user_id: str,
    profile: SellerProfile | None,
) -> None:
    """Envoie au plus une notif par fenetre (7j / 3j / 1j) ou une fois expire, par periode."""
    if profile is None:
        return
    if profile.onboarding_fee_paid_at is None:
        return

    until = profile.subscription_paid_until
    if until is None:
        return

    until = _as_utc(until)
    now = datetime.now(UTC)
    expiry_key = until.strftime("%Y%m%d")

    if until <= now:
        tag = f"seller_sub_expired_{profile.id}_{expiry_key}"
        if _notification_exists(db, user_id=user_id, tag=tag):
            return
        NotificationService(db).send_to_user(
            user_id=user_id,
            payload=NotificationPayload(
                title="Abonnement vendeur expire",
                body="Renouvelle dans l'espace vendeur pour reactiver ta boutique. Tes donnees sont conservees.",
                data={
                    "tag": tag,
                    "href": "/seller",
                    "kind": "seller_subscription_expired",
                },
            ),
        )
        db.commit()
        return

    days_left = (until - now).total_seconds() / 86400.0
    bucket: str | None
    title: str
    body: str

    if 0 < days_left <= 1:
        bucket = "1d"
        title = "Abonnement vendeur : dernier jour"
        body = (
            f"Ton abonnement expire le {until.strftime('%d/%m/%Y')}. "
            "Renouvelle dans l'espace vendeur pour eviter la coupure."
        )
    elif 1 < days_left <= 3:
        bucket = "3d"
        title = "Abonnement vendeur : moins de 3 jours"
        body = f"Ton abonnement se termine le {until.strftime('%d/%m/%Y')}. Pense au renouvellement."
    elif 3 < days_left <= 7:
        bucket = "7d"
        title = "Abonnement vendeur : moins d'une semaine"
        body = (
            f"Ton abonnement se termine le {until.strftime('%d/%m/%Y')}. "
            "Tu peux deja renouveler depuis l'espace vendeur."
        )
    else:
        return

    tag = f"seller_sub_remind_{bucket}_{profile.id}_{expiry_key}"
    if _notification_exists(db, user_id=user_id, tag=tag):
        return

    NotificationService(db).send_to_user(
        user_id=user_id,
        payload=NotificationPayload(
            title=title,
            body=body,
            data={
                "tag": tag,
                "href": "/seller",
                "kind": "seller_subscription_reminder",
            },
        ),
    )
    db.commit()


def run_seller_subscription_reminders_task(user_id: str, profile_id: str) -> None:
    """Tache de fond : session DB dediee (la requete HTTP peut deja etre close)."""
    db = SessionLocal()
    try:
        profile = db.get(SellerProfile, profile_id)
        if profile is None or profile.user_id != user_id:
            return
        maybe_send_seller_subscription_reminders(db, user_id=user_id, profile=profile)
    except Exception:
        logger.exception(
            "seller_subscription_reminders failed user_id=%s profile_id=%s",
            user_id,
            profile_id,
        )
    finally:
        db.close()
