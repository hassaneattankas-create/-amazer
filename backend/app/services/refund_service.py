"""Remboursements : inscrits automatiquement quand une commande payee est annulee ou refusee."""

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_phone_value
from app.models.refund import Refund

logger = logging.getLogger(__name__)


def record_refund(
    db: Session,
    *,
    source: str,
    source_id: str,
    user_id: str | None,
    customer_name: str | None,
    phone: str | None,
    method: str | None,
    amount: float,
    reason: str,
) -> Refund | None:
    """Ajoute un remboursement a faire (une seule fois par commande). Ne leve jamais d'erreur."""
    if amount <= 0:
        return None
    try:
        existing = db.scalar(select(Refund).where(Refund.source == source, Refund.source_id == source_id))
        if existing is not None:
            return existing
        refund = Refund(
            source=source,
            source_id=source_id,
            user_id=user_id,
            customer_name=(customer_name or "Client")[:120],
            phone=(decrypt_phone_value(phone) or "")[:40] or None,
            method=method,
            amount=round(float(amount), 2),
            reason=reason[:200],
            status="to_refund",
        )
        db.add(refund)
        db.flush()
        return refund
    except Exception:  # noqa: BLE001 - l'annulation ne doit jamais echouer a cause du suivi
        logger.exception("Remboursement non inscrit (%s %s).", source, source_id)
        return None


def settle_refund(refund: Refund, *, admin_id: str, refunded: bool, reference: str | None, note: str | None) -> None:
    if refund.status != "to_refund":
        raise ValueError("Ce remboursement a déjà été traité.")
    if refunded and not (reference or "").strip():
        raise ValueError("Indiquez la référence du virement.")
    refund.status = "refunded" if refunded else "not_needed"
    refund.reference = (reference or "").strip() or None
    refund.admin_note = (note or "").strip()[:300] or None
    refund.processed_by_user_id = admin_id
    refund.processed_at = datetime.now(UTC)
