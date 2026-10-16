"""Avis verifies : qui peut noter, resume (moyenne, repartition), nom public."""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.hospitality import HotelBooking
from app.models.order import Order, OrderItem
from app.models.restaurant import RestaurantOrder
from app.models.user import User
from app.models.vendor_review import VendorReview

DELIVERED = ("recu", "CLAIMED")


def can_review(db: Session, user_id: str, vendor_id: str) -> bool:
    """Vrai si le client a deja vecu une experience reelle avec cet etablissement."""
    shop = db.scalar(
        select(Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.user_id == user_id, OrderItem.vendor_id == vendor_id, Order.status.in_(DELIVERED))
        .limit(1)
    )
    if shop:
        return True
    restaurant = db.scalar(
        select(RestaurantOrder.id)
        .where(RestaurantOrder.user_id == user_id, RestaurantOrder.vendor_id == vendor_id, RestaurantOrder.status.in_(DELIVERED))
        .limit(1)
    )
    if restaurant:
        return True
    stay = db.scalar(
        select(HotelBooking.id)
        .where(HotelBooking.user_id == user_id, HotelBooking.vendor_id == vendor_id, HotelBooking.status.in_(("checked_in", "checked_out")))
        .limit(1)
    )
    return bool(stay)


@dataclass
class Summary:
    average: float
    count: int
    distribution: dict[int, int]


def summary(db: Session, vendor_id: str) -> Summary:
    rows = db.execute(
        select(VendorReview.rating, func.count())
        .where(VendorReview.vendor_id == vendor_id, VendorReview.is_hidden.is_(False))
        .group_by(VendorReview.rating)
    ).all()
    distribution = {star: 0 for star in range(1, 6)}
    for rating, count in rows:
        distribution[int(rating)] = int(count)
    total = sum(distribution.values())
    average = round(sum(star * count for star, count in distribution.items()) / total, 1) if total else 0.0
    return Summary(average=average, count=total, distribution=distribution)


def public_name(user: User | None) -> str:
    """Prenom + initiale du nom : jamais le nom complet, l'e-mail ou le telephone."""
    parts = ((user.full_name if user else "") or "Client").split()
    return parts[0] + (f" {parts[1][0]}." if len(parts) > 1 and parts[1] else "")
