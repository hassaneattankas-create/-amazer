"""Tâches d'entretien d'AMAZER : rappels d'abonnement aux vendeurs et nettoyage des codes expirés.

Lancées par les tâches horaires du serveur (passage de /ping, toutes les 14 minutes), sans dépendre d'un
cron extérieur ni d'un secret partagé. Les rappels ne partent qu'en journée (8 h - 20 h à Niamey) et
chaque rappel n'est envoyé qu'une fois (dédoublonné par le tag de sa notification).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.login_verification_code import LoginVerificationCode
from app.models.seller_profile import SellerProfile
from app.services.seller_subscription_reminder_service import maybe_send_seller_subscription_reminders

logger = logging.getLogger(__name__)

NIAMEY_TZ = timezone(timedelta(hours=1))
REMINDER_HOURS = range(8, 20)


def send_subscription_reminders(db: Session) -> int:
    """Rappels 7 j / 3 j / 1 j avant l'échéance, puis à l'expiration (une seule fois chacun)."""
    checked = 0
    profiles = db.scalars(
        select(SellerProfile).where(
            SellerProfile.subscription_paid_until.is_not(None),
            SellerProfile.onboarding_fee_paid_at.is_not(None),
        )
    ).all()
    for profile in profiles:
        try:
            maybe_send_seller_subscription_reminders(db, user_id=profile.user_id, profile=profile)
            checked += 1
        except Exception:  # noqa: BLE001 - un vendeur en erreur ne bloque pas les autres
            db.rollback()
            logger.exception("Rappel d'abonnement impossible (profil %s).", profile.id)
    return checked


def delete_expired_codes(db: Session, now: datetime) -> int:
    try:
        result = db.execute(delete(LoginVerificationCode).where(LoginVerificationCode.expires_at < now))
        db.commit()
        return int(result.rowcount or 0)
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Nettoyage des codes expirés impossible.")
        return 0


def run(db: Session, now: datetime | None = None, *, force: bool = False) -> dict[str, object]:
    """Entretien complet. Hors des heures de journée, seul le nettoyage tourne (sauf force=True)."""
    now = now or datetime.now(UTC)
    summary: dict[str, object] = {"ran_at": now.isoformat(), "verification_codes_deleted": delete_expired_codes(db, now)}
    if force or now.astimezone(NIAMEY_TZ).hour in REMINDER_HOURS:
        summary["subscription_profiles_checked"] = send_subscription_reminders(db)
    return summary
