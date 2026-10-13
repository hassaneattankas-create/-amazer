from __future__ import annotations

from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.crypto import encrypt_payment_code, payment_code_hash
from app.core.exceptions import ValidationDomainError
from app.models.order import Order
from app.models.restaurant import RestaurantOrder

MANUAL_PAYMENT_PENDING_MESSAGE = (
    "Paiement en attente de verification par AMAZER. "
    "Votre commande sera confirmee des que la transaction aura ete controlee."
)


class _PayableOrder(Protocol):
    id: str
    transaction_code: str | None
    transaction_code_hash: str | None


def build_payment_page_url(order_id: str, *, restaurant: bool = False) -> str:
    """Lien vers la vraie page de paiement AMAZER de la commande."""
    base = get_settings().public_site_url.rstrip("/")
    path = "restaurant/order/pay" if restaurant else "order/pay"
    return f"{base}/{path}/{order_id}"


def payment_code_in_use(db: Session, code: str, *, order_id: str | None = None) -> bool:
    """Vrai si la reference est deja rattachee a une autre commande (boutique ou restaurant)."""
    digest = payment_code_hash(code)
    order_query = select(Order.id).where(Order.transaction_code_hash == digest)
    restaurant_query = select(RestaurantOrder.id).where(RestaurantOrder.transaction_code_hash == digest)
    if order_id is not None:
        order_query = order_query.where(Order.id != order_id)
        restaurant_query = restaurant_query.where(RestaurantOrder.id != order_id)
    if db.scalar(order_query) is not None:
        return True
    return db.scalar(restaurant_query) is not None


def verify_payment_code(db: Session, code: str) -> bool:
    return not payment_code_in_use(db, code)


def resolve_manual_payment_code(
    db: Session,
    order: _PayableOrder,
    provider_reference: str | None,
    *,
    actor_is_admin: bool,
) -> str | None:
    """Paiement hors Amana : seul un administrateur peut le valider.

    - Client : la reference saisie est conservee (chiffree) pour controle admin,
      la commande reste en attente. Retourne None.
    - Admin : la reference operateur est obligatoire et doit etre unique.
      Retourne la reference a enregistrer comme preuve de paiement.
    """
    reference = (provider_reference or "").strip()
    if not actor_is_admin:
        if reference and order.transaction_code_hash is None:
            if payment_code_in_use(db, reference, order_id=order.id):
                raise ValidationDomainError("Transaction code already used")
            order.transaction_code = encrypt_payment_code(reference)
            order.transaction_code_hash = payment_code_hash(reference)
        return None
    if not reference:
        raise ValidationDomainError(
            "Reference de transaction operateur obligatoire pour confirmer manuellement un paiement"
        )
    if payment_code_in_use(db, reference, order_id=order.id):
        raise ValidationDomainError("Transaction code already used")
    return reference
