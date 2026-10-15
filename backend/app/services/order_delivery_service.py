"""Livraison confirmee : une seule regle, quelle que soit la source.

Livreur, vendeur, admin, scan du QR code du recu, confirmation du client ou delai automatique :
la commande passe « livree » partout (commande, parts de chaque boutique, date de livraison)
et chaque personne concernee est prevenue (site + e-mail), sans doublon.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.seller_profile import SellerProfile
from app.services.affiliate_service import credit_customer_bonus
from app.services.notification_service import NotificationPayload, NotificationService
from app.services.order_fulfillment_service import sync_fulfillments

logger = logging.getLogger(__name__)

DELIVERED_STATUS = "recu"
SOURCE_LABELS = {
    "courier": "par le livreur",
    "seller": "par la boutique",
    "admin": "par AMAZER",
    "qr_scan": "par scan du reçu",
    "customer": "par le client",
    "auto": "automatiquement",
}


def _tracking(order: Order) -> str:
    return getattr(order, "tracking_code", None) or str(order.id)[:8].upper()


def mark_order_delivered(db: Session, order: Order, *, source: str) -> bool:
    """Passe la commande « livree » partout. Retourne False si elle l'etait deja (pas de doublon)."""
    already = order.status in (DELIVERED_STATUS, "CLAIMED") and order.delivered_at is not None
    order.status = DELIVERED_STATUS
    sync_fulfillments(order)
    if order.delivered_at is None:
        order.delivered_at = datetime.now(UTC)
    if already:
        return False
    try:
        with db.begin_nested():
            credit_customer_bonus(db, order)
    except Exception:  # noqa: BLE001 - la livraison reste enregistree meme si le bonus echoue
        logger.exception("Bonus d'affiliation non inscrit (commande %s).", order.id)
    _notify_delivery(db, order, source)
    return True


def _notify_delivery(db: Session, order: Order, source: str) -> None:
    tracking = _tracking(order)
    how = SOURCE_LABELS.get(source, "")
    service = NotificationService(db)

    def send(user_id: str | None, title: str, body: str, tag: str, href: str) -> None:
        if not user_id:
            return
        try:
            service.send_to_user(user_id=user_id, payload=NotificationPayload(title=title, body=body, data={"tag": tag, "href": href}))
        except Exception:  # noqa: BLE001 - la livraison reste enregistree meme si l'envoi echoue
            logger.exception("Notification de livraison impossible (%s).", tag)

    if source != "customer":
        send(
            order.user_id,
            "Commande livrée",
            f"Votre commande #{tracking} a été livrée. Merci d'avoir choisi AMAZER !",
            f"order-{order.id}-recu",
            "/dashboard",
        )
    vendor_ids = {item.vendor_id for item in order.items}
    if vendor_ids:
        try:
            seller_ids = db.scalars(select(SellerProfile.user_id).where(SellerProfile.vendor_id.in_(vendor_ids))).all()
        except Exception:  # noqa: BLE001
            seller_ids = []
        for seller_id in seller_ids:
            if source == "seller" and len(seller_ids) == 1:
                continue  # le vendeur vient de le faire lui-meme
            send(seller_id, "Commande livrée", f"La commande #{tracking} a été livrée {how}.", f"seller-order-{order.id}-recu", "/seller/dashboard#commandes")
    courier_id = getattr(order, "courier_user_id", None)
    if courier_id and source != "courier":
        send(courier_id, "Livraison confirmée", f"La commande #{tracking} est confirmée livrée {how}.", f"courier-{order.id}-recu", "/livreur")
