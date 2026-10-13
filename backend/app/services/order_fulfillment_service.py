"""Sous-commandes par vendeur : chaque boutique fait avancer sa propre preparation.

Regles :
- une commande a un vendeur se comporte exactement comme avant ;
- dans une commande multi-vendeurs, le statut global suit le vendeur le moins avance ;
- les evenements globaux (livraison lancee par l'admin, reception confirmee par le
  client) s'appliquent a toutes les parts via `sync_fulfillments`.

Fonctions pures sur les objets ORM : aucune requete, le flush est fait par l'appelant.
"""

from __future__ import annotations

from app.models.order import Order, OrderFulfillment

FULFILLMENT_STEPS: tuple[str, ...] = ("commande", "preparation", "livraison", "recu")
_RANK = {step: index for index, step in enumerate(FULFILLMENT_STEPS)}


def _vendor_ids(order: Order) -> list[str]:
    return sorted({item.vendor_id for item in order.items})


def _default_status(order: Order) -> str:
    return order.status if order.status in _RANK else "commande"


def create_initial_fulfillments(order: Order) -> None:
    """A la creation de la commande : une part par vendeur, a preparer."""
    order.fulfillments = [OrderFulfillment(vendor_id=vendor_id, status="commande") for vendor_id in _vendor_ids(order)]


def _ensure_rows(order: Order) -> dict[str, OrderFulfillment]:
    """Commandes anterieures a cette fonctionnalite : les parts sont creees au statut global."""
    rows = {row.vendor_id: row for row in order.fulfillments}
    for vendor_id in _vendor_ids(order):
        if vendor_id not in rows:
            row = OrderFulfillment(vendor_id=vendor_id, status=_default_status(order))
            order.fulfillments.append(row)
            rows[vendor_id] = row
    return rows


def vendor_status(order: Order, vendor_id: str) -> str:
    for row in order.fulfillments:
        if row.vendor_id == vendor_id:
            return row.status
    return order.status


def set_vendor_status(order: Order, vendor_id: str, status: str) -> None:
    """Le vendeur fait avancer sa part ; le statut global devient celui du moins avance."""
    if status not in _RANK:
        raise ValueError(f"Statut de preparation inconnu : {status}")
    rows = _ensure_rows(order)
    rows[vendor_id].status = status
    order.status = min((row.status for row in rows.values()), key=lambda value: _RANK.get(value, 0))


def sync_fulfillments(order: Order) -> None:
    """Un evenement global (livraison, reception) s'applique a toutes les parts existantes."""
    if order.status not in _RANK:
        return
    for row in order.fulfillments:
        row.status = order.status
