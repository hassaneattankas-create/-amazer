"""Notifications automatiques du parcours de commande (site + e-mail via le relais).

Chaque etape importante previent la bonne personne, sans action manuelle :
commande recue (client), paiement confirme (client + livreurs), preparation / livraison / livree (client).
Le sujet (tag) inclut l'etape : deux etapes proches ne sont jamais bloquees par l'anti-rafale.
"""

from __future__ import annotations

import functools
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.notification_service import NotificationPayload, NotificationService

logger = logging.getLogger(__name__)

STATUS_MESSAGES: dict[str, tuple[str, str]] = {
    "preparation": ("Commande en préparation", "La boutique prépare votre commande #{t}."),
    "livraison": ("Commande en route", "Votre commande #{t} est en cours de livraison."),
    "recu": ("Commande livrée", "Votre commande #{t} a été livrée. Merci d'avoir choisi AMAZER !"),
}


def _safe(func):
    """Une notification ne doit jamais faire echouer une commande, un paiement ou une livraison."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception:  # noqa: BLE001
            logger.exception("Notification automatique impossible (%s).", func.__name__)
            return None

    return wrapper


def _tracking(order) -> str:
    return getattr(order, "tracking_code", None) or str(order.id)[:8].upper()


def _amount(order) -> int:
    return int(round(float(order.total_amount or 0)))


def _send(db: Session, user_id: str | None, title: str, body: str, tag: str, href: str) -> None:
    if not user_id:
        return
    try:
        NotificationService(db).send_to_user(
            user_id=user_id, payload=NotificationPayload(title=title, body=body, data={"tag": tag, "href": href})
        )
    except Exception:  # noqa: BLE001 - une notification ne doit jamais bloquer une commande
        logger.exception("Notification impossible (%s).", tag)


@_safe
def notify_order_placed(db: Session, order) -> None:
    t = _tracking(order)
    if order.payment_status == "paid":
        body = f"Commande #{t} confirmée : {_amount(order)} XOF. Nous vous prévenons à chaque étape."
    else:
        body = f"Commande #{t} reçue : {_amount(order)} XOF. Paiement en cours de vérification par AMAZER."
    _send(db, getattr(order, "user_id", None), "Commande reçue", body, f"order-{order.id}-placed", "/dashboard")


@_safe
def notify_order_paid(db: Session, order, *, couriers: bool = True) -> None:
    t = _tracking(order)
    _send(
        db,
        getattr(order, "user_id", None),
        "Paiement confirmé",
        f"Le paiement de la commande #{t} ({_amount(order)} XOF) est confirmé. La préparation commence.",
        f"order-{order.id}-paid",
        "/dashboard",
    )
    if couriers:
        notify_couriers_new_delivery(db, order)


@_safe
def notify_couriers_new_delivery(db: Session, order) -> None:
    if getattr(order, "delivery_type", None) == "pickup":
        return
    district = getattr(order, "delivery_district", None)
    where = f" ({district})" if district else ""
    couriers = db.scalars(select(User.id).where(User.role == "courier", User.is_active.is_(True))).all()
    for courier_id in couriers:
        _send(
            db,
            courier_id,
            "Nouvelle livraison disponible",
            f"Commande #{_tracking(order)}{where} prête à être prise en charge.",
            f"courier-available-{order.id}",
            "/livreur",
        )


@_safe
def notify_order_status(db: Session, order, status: str) -> None:
    message = STATUS_MESSAGES.get(status)
    if message is None:
        return
    title, body = message
    _send(db, getattr(order, "user_id", None), title, body.format(t=_tracking(order)), f"order-{order.id}-{status}", "/dashboard")


@_safe
def notify_welcome(db: Session, user_id: str, full_name: str | None) -> None:
    first = (full_name or "").strip().split(" ")[0]
    _send(
        db,
        user_id,
        "Bienvenue sur AMAZER",
        f"Bonjour {first}, votre compte est prêt. Achetez en toute confiance : paiement contrôlé et livraison suivie.".replace(
            "Bonjour , ", "Bonjour, "
        ),
        f"welcome-{user_id}",
        "/",
    )
