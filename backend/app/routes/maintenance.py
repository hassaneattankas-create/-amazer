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

import hmac

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db

router = APIRouter(prefix="/maintenance", tags=["maintenance"])
settings = get_settings()


def _require_cron_secret(x_cron_secret: str | None) -> None:
    expected = (settings.cron_secret or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Maintenance cron not configured")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret.strip(), expected):
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.post("/run")
def run_maintenance(
    db: Annotated[Session, Depends(get_db)],
    x_cron_secret: Annotated[str | None, Header(alias="X-Cron-Secret")] = None,
) -> dict[str, object]:
    _require_cron_secret(x_cron_secret)
    # Même entretien que celui lancé chaque heure par le serveur (services/daily_maintenance).
    from app.services import daily_maintenance

    return daily_maintenance.run(db, force=True)
