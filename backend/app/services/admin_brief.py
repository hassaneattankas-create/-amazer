"""Résumé du matin de l'admin : ce qui attend une action, et la journée d'hier, envoyé une fois par jour.

Envoyé par notification (copie par e-mail / WhatsApp selon les préférences) à chaque compte admin,
au premier passage des tâches horaires après 7 h (heure de Niamey). Aucun PIN n'est nécessaire :
le serveur compte lui-même, le résumé ne contient que des nombres et le lien vers « À traiter ».
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.permissions import ROLE_ADMIN

logger = logging.getLogger(__name__)

NIAMEY_TZ = timezone(timedelta(hours=1))
SEND_FROM_HOUR = 7


def _count(db: Session, query) -> int:
    try:
        return int(db.scalar(query) or 0)
    except Exception:  # noqa: BLE001 - une table absente ne doit pas bloquer tout le résumé
        db.rollback()
        logger.exception("Résumé admin : un compteur a échoué.")
        return 0


def collect(db: Session, now: datetime) -> dict[str, int | float]:
    """Les nombres du résumé (le serveur les calcule, sans passer par l'interface admin)."""
    from app.models.affiliate import AffiliateAccount, AffiliatePayout
    from app.models.order import Order
    from app.models.refund import Refund
    from app.models.seller_pending_registration import SellerPendingRegistration
    from app.models.seller_profile import SellerProfile
    from app.models.seller_subscription_payment import SellerSubscriptionPayment

    local = now.astimezone(NIAMEY_TZ)
    today_start = datetime(local.year, local.month, local.day, tzinfo=NIAMEY_TZ)
    yesterday_start = today_start - timedelta(days=1)
    count = lambda model: select(func.count()).select_from(model)  # noqa: E731

    return {
        "order_payments": _count(db, count(Order).where(Order.payment_status != "paid", Order.status != "annulee")),
        "registrations": _count(db, count(SellerPendingRegistration).where(SellerPendingRegistration.status == "pending")),
        "subscriptions": _count(db, count(SellerSubscriptionPayment).where(SellerSubscriptionPayment.status == "pending")),
        "ambassadors": _count(
            db, count(AffiliateAccount).where(AffiliateAccount.ambassador_applied_at.is_not(None), AffiliateAccount.tier != "ambassador")
        ),
        "affiliate_payouts": _count(db, count(AffiliatePayout).where(AffiliatePayout.status == "requested")),
        "refunds": _count(db, count(Refund).where(Refund.status == "to_refund")),
        "orders_yesterday": _count(
            db, count(Order).where(Order.created_at >= yesterday_start, Order.created_at < today_start, Order.status != "annulee")
        ),
        "sales_yesterday": float(
            db.scalar(
                select(func.coalesce(func.sum(Order.total_amount), 0)).where(
                    Order.created_at >= yesterday_start,
                    Order.created_at < today_start,
                    Order.status != "annulee",
                    Order.payment_status == "paid",
                )
            )
            or 0
        ),
        "new_sellers_yesterday": _count(
            db, count(SellerProfile).where(SellerProfile.created_at >= yesterday_start, SellerProfile.created_at < today_start)
        ),
    }


def compose(numbers: dict[str, int | float]) -> tuple[str, str]:
    """(titre, texte) en français simple : d'abord ce qui attend, puis hier."""
    labels = (
        ("order_payments", "paiement(s) de commande à valider"),
        ("registrations", "inscription(s) vendeur à valider"),
        ("subscriptions", "abonnement(s) à valider"),
        ("ambassadors", "candidature(s) d'ambassadeur"),
        ("affiliate_payouts", "retrait(s) d'affilié demandé(s)"),
        ("refunds", "remboursement(s) à faire"),
    )
    waiting = [f"• {int(numbers[key])} {label}" for key, label in labels if numbers.get(key)]
    total = sum(int(numbers[key]) for key, _ in labels)
    sales = f"{int(numbers['sales_yesterday']):,}".replace(",", " ")
    yesterday = (
        f"Hier : {int(numbers['orders_yesterday'])} commande(s), {sales} F encaissés, "
        f"{int(numbers['new_sellers_yesterday'])} nouveau(x) vendeur(s)."
    )
    if total:
        title = f"Bonjour ! {total} chose(s) vous attendent sur AMAZER"
        body = "\n".join(waiting) + "\n\n" + yesterday + "\nTout est dans Admin › À traiter."
    else:
        title = "Bonjour ! Rien en attente sur AMAZER"
        body = yesterday
    return title, body


def admin_user_ids(db: Session) -> list[str]:
    from app.models.user import User

    principal = (get_settings().admin_email or "").strip().lower()
    rows = db.scalars(
        select(User.id).where(
            User.is_active.is_(True),
            or_(User.role == ROLE_ADMIN, func.lower(User.email) == principal),
        )
    ).all()
    return list(dict.fromkeys(rows))


def maybe_send(db: Session, now: datetime | None = None) -> int:
    """Envoie le résumé du jour aux admins qui ne l'ont pas encore reçu. Renvoie le nombre d'envois."""
    from app.models.app_notification import AppNotification
    from app.services.notification_service import NotificationPayload, NotificationService

    now = now or datetime.now(UTC)
    local = now.astimezone(NIAMEY_TZ)
    if local.hour < SEND_FROM_HOUR:
        return 0
    tag = f"admin-brief-{local:%Y-%m-%d}"
    recipients = [
        user_id
        for user_id in admin_user_ids(db)
        if not db.scalar(select(AppNotification.id).where(AppNotification.user_id == user_id, AppNotification.tag == tag).limit(1))
    ]
    if not recipients:
        return 0
    title, body = compose(collect(db, now))
    service = NotificationService(db)
    sent = 0
    for user_id in recipients:
        try:
            service.send_to_user(user_id=user_id, payload=NotificationPayload(title=title, body=body, data={"tag": tag, "href": "/admin"}))
            sent += 1
        except Exception:  # noqa: BLE001 - un admin injoignable n'empêche pas les autres
            db.rollback()
            logger.exception("Résumé admin non envoyé.")
    db.commit()
    return sent
