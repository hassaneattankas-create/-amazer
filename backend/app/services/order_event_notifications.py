"""Notifications automatiques du parcours de commande (site + e-mail via le relais).

Chaque etape importante previent la bonne personne, sans action manuelle :
commande recue (client), paiement confirme (client + vendeurs/restaurants + livreurs), preparation / livraison / livree (client).
Le sujet (tag) inclut l'etape : deux etapes proches ne sont jamais bloquees par l'anti-rafale.
"""

from __future__ import annotations

import contextlib
import functools
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.services.notification_service import NotificationPayload, NotificationService

logger = logging.getLogger(__name__)

STATUS_MESSAGES: dict[str, tuple[str, str]] = {
    "preparation": ("Commande en préparation", "La boutique prépare votre commande #{t}."),
    "livraison": ("Commande en route", "Votre commande #{t} est en cours de livraison."),
    "recu": ("Commande livrée", "Votre commande #{t} a été livrée. Merci d'avoir choisi AMAZER !"),
    "annulee": ("Commande annulée", "Votre commande #{t} a été annulée. Si vous avez payé, AMAZER vous rembourse."),
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


def _savepoint(db: Session):
    begin = getattr(db, "begin_nested", None)
    nested = begin() if isinstance(db, Session) and begin else None
    return nested if nested is not None else contextlib.nullcontext()


def _send(db: Session, user_id: str | None, title: str, body: str, tag: str, href: str) -> None:
    if not user_id:
        return
    try:
        # Point de sauvegarde : un envoi rate n'annule jamais la commande ou le paiement en cours.
        with _savepoint(db):
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
    notify_sellers_order_paid(db, order)
    notify_resellers_sale(db, order)
    if couriers:
        notify_couriers_new_delivery(db, order)


@_safe
def notify_resellers_sale(db: Session, order) -> None:
    """Le revendeur apprend qu'une vente faite avec son lien est payee (marge versee apres livraison)."""
    margins: dict[str, float] = {}
    for item in getattr(order, "items", None) or []:
        reseller = getattr(item, "reseller_user_id", None)
        if reseller:
            net = float(getattr(item, "reseller_margin", 0) or 0) - float(getattr(item, "reseller_commission", 0) or 0)
            margins[reseller] = margins.get(reseller, 0.0) + max(net, 0.0)
    for user_id, margin in margins.items():
        _send(
            db,
            user_id,
            "Vente payée grâce à votre lien",
            f"Commande #{_tracking(order)} payée : {int(round(margin))} XOF de marge pour vous, versée après la livraison.",
            f"reseller-sale-{order.id}",
            "/revendre",
        )


def vendor_amounts(order) -> dict[str, int]:
    """Part de chaque boutique dans la commande (articles), ou total pour une commande restaurant."""
    amounts: dict[str, float] = {}
    for item in getattr(order, "items", None) or []:
        amounts[item.vendor_id] = amounts.get(item.vendor_id, 0.0) + float(item.unit_price or 0) * int(item.quantity or 1)
    if not amounts and getattr(order, "vendor_id", None):
        amounts[order.vendor_id] = float(order.total_amount or 0)
    return {vendor_id: int(round(value)) for vendor_id, value in amounts.items()}


def seller_users(db: Session, vendor_ids) -> dict[str, str]:
    """vendor_id -> compte vendeur a prevenir."""
    if not vendor_ids:
        return {}
    rows = db.execute(select(SellerProfile.vendor_id, SellerProfile.user_id).where(SellerProfile.vendor_id.in_(list(vendor_ids)))).all()
    return {vendor_id: user_id for vendor_id, user_id in rows if user_id}


@_safe
def notify_sellers_order_paid(db: Session, order) -> None:
    """Le vendeur (ou le restaurant) sait qu'il peut preparer : le paiement est confirme."""
    amounts = vendor_amounts(order)
    t = _tracking(order)
    for vendor_id, user_id in seller_users(db, amounts.keys()).items():
        _send(
            db,
            user_id,
            "Commande payée : à préparer",
            f"Le paiement de la commande #{t} est confirmé ({amounts[vendor_id]} XOF pour vous). Vous pouvez la préparer.",
            f"seller-order-{order.id}-{vendor_id[:6]}-paid",
            "/seller/dashboard",
        )


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
        f"Bonjour {first}, votre compte est prêt. Achetez en toute confiance : paiement contrôlé et livraison suivie. Astuce : devenez affilié gratuitement dans « Affiliation » et gagnez de l'argent en partageant AMAZER.".replace(
            "Bonjour , ", "Bonjour, "
        ),
        f"welcome-{user_id}",
        "/",
    )
