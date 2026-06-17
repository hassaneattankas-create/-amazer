"""Taches planifiees AMAZER (declenchees par un cron GitHub Action).

Protege par un secret partage (header X-Cron-Secret == settings.cron_secret).
Si le secret n'est pas configure cote serveur, l'endpoint est desactive (503).

Ce que ca automatise (ce que /ping ne fait pas deja) :
- Rappels de renouvellement d'abonnement vendeur (balayage global, dedup par notif).
- Nettoyage des codes de verification expires.

NB: l'expiration des abonnements (desactivation des boutiques) est deja faite en
lazy par /ping, appele toutes les 14 min par le workflow keep-alive.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.login_verification_code import LoginVerificationCode
from app.models.seller_profile import SellerProfile
from app.services.seller_subscription_reminder_service import (
    maybe_send_seller_subscription_reminders,
)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])
settings = get_settings()


def _require_cron_secret(x_cron_secret: str | None) -> None:
    expected = (settings.cron_secret or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Maintenance cron not configured")
    if not x_cron_secret or x_cron_secret.strip() != expected:
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.post("/run")
def run_maintenance(
    db: Annotated[Session, Depends(get_db)],
    x_cron_secret: Annotated[str | None, Header(alias="X-Cron-Secret")] = None,
) -> dict[str, object]:
    _require_cron_secret(x_cron_secret)
    now = datetime.now(UTC)
    summary: dict[str, object] = {"ran_at": now.isoformat()}

    # 1) Rappels d'abonnement vendeur (la fonction dedup via le tag de notification).
    reminders_checked = 0
    profiles = db.scalars(
        select(SellerProfile).where(
            SellerProfile.subscription_paid_until.is_not(None),
            SellerProfile.onboarding_fee_paid_at.is_not(None),
        )
    ).all()
    for profile in profiles:
        try:
            maybe_send_seller_subscription_reminders(db, user_id=profile.user_id, profile=profile)
            reminders_checked += 1
        except Exception:
            db.rollback()
    summary["subscription_profiles_checked"] = reminders_checked

    # 2) Nettoyage des codes de verification expires.
    try:
        result = db.execute(
            delete(LoginVerificationCode).where(LoginVerificationCode.expires_at < now)
        )
        db.commit()
        summary["verification_codes_deleted"] = int(result.rowcount or 0)
    except Exception:
        db.rollback()
        summary["verification_codes_deleted"] = "error"

    return summary
