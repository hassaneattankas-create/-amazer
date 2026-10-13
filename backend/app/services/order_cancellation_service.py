"""Annulation des commandes boutique.

- Le client annule lui-meme une commande **non payee** et pas encore en livraison.
- L'administrateur peut annuler toute commande non livree. Si elle etait payee,
  le stock est remis en vente ; le remboursement eventuel se fait hors plateforme
  (aucun moyen de remboursement automatique n'existe aujourd'hui).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.models.order import Order
from app.models.product import Price

CANCELLED_STATUS = "annulee"
_DELIVERED = {"recu", "CLAIMED"}
_CUSTOMER_CANCELLABLE = {"payment_pending", "commande"}


def ensure_not_cancelled(order: Order) -> None:
    if order.status == CANCELLED_STATUS:
        raise ConflictError("Cette commande a ete annulee.")


def _restore_stock(db: Session, order: Order) -> None:
    for item in order.items:
        price = db.scalar(
            select(Price)
            .where(Price.product_id == item.product_id, Price.vendor_id == item.vendor_id)
            .with_for_update()
        )
        if price is not None:
            price.stock_quantity = int(price.stock_quantity) + int(item.quantity)


def cancel_order(db: Session, order: Order, *, by_admin: bool) -> bool:
    """Annule la commande ; retourne True si du stock a ete remis en vente."""
    ensure_not_cancelled(order)
    if order.status in _DELIVERED:
        raise ConflictError("Une commande deja livree ne peut pas etre annulee.")
    if not by_admin:
        if order.payment_status == "paid":
            raise ConflictError("Commande deja payee : contactez le support pour l'annuler.")
        if order.status not in _CUSTOMER_CANCELLABLE:
            raise ConflictError("Cette commande est deja en cours de traitement.")

    restocked = False
    if order.payment_status == "paid":
        # Le stock n'est retire qu'au paiement : on ne le rend que dans ce cas.
        _restore_stock(db, order)
        restocked = True
    order.status = CANCELLED_STATUS
    for row in order.fulfillments:
        row.status = CANCELLED_STATUS
    return restocked


def notify_order_cancelled(db: Session, order: Order, *, by_admin: bool) -> None:
    """Previent les vendeurs concernes (et le client si l'annulation vient de l'admin)."""
    # Imports locaux : evite un cycle avec le service de notifications.
    from app.models.seller_profile import SellerProfile
    from app.services.notification_service import NotificationPayload, NotificationService

    tracking = order.tracking_code or order.id[:8].upper()
    service = NotificationService(db)
    try:
        vendor_ids = {item.vendor_id for item in order.items}
        for profile in db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_(vendor_ids))).all():
            service.send_to_user(
                user_id=profile.user_id,
                payload=NotificationPayload(
                    title="Commande annulee",
                    body=f"La commande #{tracking} a ete annulee. Ne la preparez pas.",
                    data={"tag": f"seller-order-cancel-{order.id}", "href": "/seller/dashboard", "kind": "order_cancelled"},
                ),
            )
        if by_admin:
            service.send_to_user(
                user_id=order.user_id,
                payload=NotificationPayload(
                    title="Commande annulee",
                    body=f"Votre commande #{tracking} a ete annulee par AMAZER. Contactez le support pour toute question.",
                    data={"tag": f"order-cancel-{order.id}", "href": "/dashboard", "kind": "order_cancelled"},
                ),
            )
        db.commit()
    except Exception:  # pragma: no cover - une notification ne doit jamais annuler l'annulation
        db.rollback()
