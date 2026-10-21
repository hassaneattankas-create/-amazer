"""Espace livreur : commandes a livrer, prise en charge et confirmation de livraison.

Acces reserve aux livreurs (role `courier`) et aux administrateurs, verifie cote serveur.
Le telephone du client est visible par tous les livreurs (pour l'appeler avant de prendre
la commande) ; l'adresse exacte n'apparait qu'au livreur qui a pris la commande.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.crypto import decrypt_phone_value
from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.permissions import is_admin, is_courier
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.database import get_db
from app.models.order import Order
from app.models.product import Product
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.services.order_delivery_service import mark_order_delivered
from app.services.audit_log_service import append_audit_log
from app.services.notification_service import NotificationPayload, NotificationService
from app.services.order_fulfillment_service import sync_fulfillments
from app.services.local_services import maps_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/courier", tags=["courier"])

# Une commande peut etre prise en charge des qu'elle est payee et pas encore partie.
_AVAILABLE_STATUSES = ("commande", "preparation")


# Etat de la part d'une boutique, dit au livreur avant de se deplacer.
PICKUP_LABELS = {
    "commande": "Commande reçue par la boutique",
    "preparation": "En préparation",
    "livraison": "Prête / remise au livreur",
    "recu": "Livrée",
    "annulee": "Annulée",
}


class PickupPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shop_name: str
    address: str | None
    city: str | None
    # Numero public de la boutique (jamais son numero de paiement).
    phone: str | None
    whatsapp: str | None = None
    opening_hours: str | None = None
    # Itineraire Google Maps (position exacte si la boutique l'a enregistree).
    maps_url: str | None = None
    status: str = "commande"
    status_label: str = PICKUP_LABELS["commande"]
    items: list[str]


class CourierOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    tracking_code: str | None
    status: str
    created_at: datetime
    delivery_type: str
    district: str | None
    total_amount: float
    payment_status: str
    item_count: int
    # Frais de livraison payes par le client (deja encaisses par AMAZER).
    delivery_fee: float = 0
    # Heure limite indicative : paiement confirme + delai annonce au client.
    deliver_before: datetime | None = None
    pickups: list[PickupPoint]
    customer_name: str
    # Visibles uniquement par le livreur charge de la commande.
    customer_phone: str | None
    delivery_address: str | None
    customer_maps_url: str | None = None
    assigned_to_me: bool
    courier_assigned_at: datetime | None
    delivered_at: datetime | None


def get_courier_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if not (is_courier(current_user) or is_admin(current_user)):
        raise ForbiddenError("Espace réservé aux livreurs AMAZER.")
    return current_user


def _first_name(full_name: str | None) -> str:
    return (full_name or "Client").strip().split(" ")[0] or "Client"


def _build(db: Session, order: Order, courier: User) -> CourierOrder:
    mine = order.courier_user_id == courier.id
    vendor_ids = {item.vendor_id for item in order.items}
    profiles = {
        profile.vendor_id: profile
        for profile in db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_(vendor_ids))).all()
    }
    product_ids = {item.product_id for item in order.items}
    names = {
        product.id: product.name for product in db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
    }
    states = {row.vendor_id: row.status for row in (getattr(order, "fulfillments", None) or [])}
    pickups: list[PickupPoint] = []
    for vendor_id in sorted(vendor_ids):
        profile = profiles.get(vendor_id)
        public_phone = decrypt_phone_value(getattr(profile, "phone", None)) if profile else None
        whatsapp = getattr(profile, "whatsapp_contact", None) if profile else None
        state = states.get(vendor_id) or (order.status if order.status in PICKUP_LABELS else "commande")
        pickups.append(
            PickupPoint(
                shop_name=profile.business_name if profile else "Boutique",
                address=profile.address if profile else None,
                city=profile.city if profile else None,
                phone=public_phone or whatsapp,
                whatsapp=whatsapp,
                opening_hours=getattr(profile, "opening_hours", None) if profile else None,
                maps_url=maps_url(profile) if profile else None,
                status=state,
                status_label=PICKUP_LABELS.get(state, PICKUP_LABELS["commande"]),
                items=[
                    f"{item.quantity} × {names.get(item.product_id, 'Article')}"
                    for item in order.items
                    if item.vendor_id == vendor_id
                ],
            )
        )
    customer = order.user
    fees = getattr(order, "fee_breakdown", None) or {}
    start = getattr(order, "payment_confirmed_at", None) or order.created_at
    minutes = int(getattr(order, "estimated_minutes", 0) or 0)
    deliver_before = start + timedelta(minutes=minutes) if start is not None and minutes > 0 else None
    address = order.delivery_address if mine else None
    customer_maps = None
    if address:
        query = ", ".join(part for part in (address, order.delivery_district, "Niger") if part)
        customer_maps = f"https://www.google.com/maps/search/?api=1&query={quote(query)}"
    return CourierOrder(
        id=order.id,
        tracking_code=order.tracking_code,
        status=order.status,
        created_at=order.created_at,
        delivery_type=order.delivery_type,
        district=order.delivery_district,
        total_amount=float(order.total_amount),
        payment_status=order.payment_status,
        item_count=sum(int(item.quantity) for item in order.items),
        delivery_fee=round(float(fees.get("delivery_fee", 0) or 0), 2) if isinstance(fees, dict) else 0,
        deliver_before=deliver_before,
        pickups=pickups,
        customer_name=(customer.full_name if mine and customer else _first_name(customer.full_name if customer else None)),
        customer_phone=order.delivery_phone or (customer.whatsapp_phone if customer else None),
        delivery_address=address,
        customer_maps_url=customer_maps,
        assigned_to_me=mine,
        courier_assigned_at=order.courier_assigned_at,
        delivered_at=order.delivered_at,
    )


def _notify(db: Session, user_id: str | None, title: str, body: str, tag: str, href: str) -> None:
    if not user_id:
        return
    try:
        NotificationService(db).send_to_user(
            user_id=user_id,
            payload=NotificationPayload(title=title, body=body, data={"tag": tag, "href": href, "kind": "delivery"}),
        )
        db.commit()
    except Exception:  # pragma: no cover - une notification ne doit jamais bloquer la livraison
        logger.exception("Notification de livraison non envoyee")
        db.rollback()


def _orders_query():
    return select(Order).options(selectinload(Order.items), selectinload(Order.user), selectinload(Order.fulfillments))


@router.get("/orders/available", response_model=list[CourierOrder])
def list_available_orders(
    db: Annotated[Session, Depends(get_db)],
    courier: Annotated[User, Depends(get_courier_user)],
) -> list[CourierOrder]:
    rows = db.scalars(
        _orders_query()
        .where(
            Order.payment_status == "paid",
            Order.status.in_(_AVAILABLE_STATUSES),
            Order.courier_user_id.is_(None),
        )
        .order_by(Order.created_at.asc())
        .limit(50)
    ).all()
    return [_build(db, order, courier) for order in rows]


@router.get("/orders/mine", response_model=list[CourierOrder])
def list_my_deliveries(
    db: Annotated[Session, Depends(get_db)],
    courier: Annotated[User, Depends(get_courier_user)],
) -> list[CourierOrder]:
    rows = db.scalars(
        _orders_query().where(Order.courier_user_id == courier.id).order_by(Order.courier_assigned_at.desc()).limit(50)
    ).all()
    return [_build(db, order, courier) for order in rows]


def _locked_order(db: Session, order_id: str) -> Order:
    order = db.scalar(_orders_query().where(Order.id == order_id).with_for_update(of=Order))
    if order is None:
        raise NotFoundError("Commande introuvable")
    return order


@router.post("/orders/{order_id}/take", response_model=CourierOrder)
def take_order(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    courier: Annotated[User, Depends(get_courier_user)],
) -> CourierOrder:
    """Prise en charge : un seul livreur par commande (verrou en base)."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="courier_take", limit=30, window_seconds=300)
    order = _locked_order(db, order_id)
    if order.courier_user_id is not None:
        raise ConflictError("Cette commande a déjà été prise par un autre livreur.")
    if order.payment_status != "paid" or order.status not in _AVAILABLE_STATUSES:
        raise ConflictError("Cette commande n'est pas disponible pour la livraison.")
    order.courier_user_id = courier.id
    order.courier_assigned_at = datetime.now(UTC)
    order.status = "livraison"
    sync_fulfillments(order)
    append_audit_log(
        db,
        event_type="courier_order_taken",
        actor=courier,
        ip_address=client_ip(request),
        path=str(request.url.path),
        entity_type="order",
        entity_id=order.id,
        details={"tracking_code": order.tracking_code},
    )
    db.commit()
    db.refresh(order)
    tracking = order.tracking_code or order.id[:8].upper()
    _notify(db, order.user_id, "Votre commande est en route", f"Un livreur a pris en charge la commande #{tracking}.", f"delivery-{order.id}", "/dashboard")
    return _build(db, order, courier)


@router.post("/orders/{order_id}/delivered", response_model=CourierOrder)
def mark_delivered(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    courier: Annotated[User, Depends(get_courier_user)],
) -> CourierOrder:
    enforce_csrf(request)
    order = _locked_order(db, order_id)
    if order.courier_user_id != courier.id:
        raise ForbiddenError("Seul le livreur chargé de cette commande peut la marquer livrée.")
    if order.status != "livraison":
        raise ConflictError("Cette commande n'est pas en cours de livraison.")
    mark_order_delivered(db, order, source="courier")
    append_audit_log(
        db,
        event_type="courier_order_delivered",
        actor=courier,
        ip_address=client_ip(request),
        path=str(request.url.path),
        entity_type="order",
        entity_id=order.id,
        details={"tracking_code": order.tracking_code},
    )
    db.commit()
    db.refresh(order)
    return _build(db, order, courier)


@router.post("/orders/{order_id}/release", response_model=CourierOrder)
def release_order(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    courier: Annotated[User, Depends(get_courier_user)],
) -> CourierOrder:
    """Le livreur rend une commande qu'il ne peut pas livrer : elle redevient disponible."""
    enforce_csrf(request)
    order = _locked_order(db, order_id)
    if order.courier_user_id != courier.id:
        raise ForbiddenError("Cette commande ne vous est pas attribuée.")
    if order.status != "livraison":
        raise ConflictError("Cette commande ne peut plus être rendue.")
    order.courier_user_id = None
    order.courier_assigned_at = None
    order.status = "preparation"
    sync_fulfillments(order)
    append_audit_log(
        db,
        event_type="courier_order_released",
        actor=courier,
        ip_address=client_ip(request),
        path=str(request.url.path),
        entity_type="order",
        entity_id=order.id,
        details={},
    )
    db.commit()
    db.refresh(order)
    return _build(db, order, courier)
