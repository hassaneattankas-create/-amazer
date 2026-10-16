"""Statistiques des vitrines : compter visites et contacts, resume pour le vendeur."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.hospitality import HotelBooking
from app.models.order import Order, OrderItem
from app.models.restaurant import RestaurantOrder
from app.models.storefront_stat import StorefrontDailyStat

NIAMEY_TZ = timezone(timedelta(hours=1))


def today(now: datetime | None = None) -> date:
    return (now or datetime.now(UTC)).astimezone(NIAMEY_TZ).date()


def record(db: Session, vendor_id: str, kind: str, now: datetime | None = None) -> None:
    """Ajoute une visite (« view ») ou un contact (« contact ») au compteur du jour."""
    day = today(now)
    row = db.get(StorefrontDailyStat, (vendor_id, day))
    if row is None:
        row = StorefrontDailyStat(vendor_id=vendor_id, day=day, views=0, contacts=0)
        db.add(row)
    if kind == "view":
        row.views = int(row.views or 0) + 1
    else:
        row.contacts = int(row.contacts or 0) + 1


def daily(db: Session, vendor_id: str, days: int, now: datetime | None = None) -> list[tuple[date, int, int]]:
    """(jour, visites, contacts) pour les N derniers jours, jours vides compris."""
    end = today(now)
    start = end - timedelta(days=days - 1)
    rows = {
        row.day: row
        for row in db.scalars(
            select(StorefrontDailyStat).where(StorefrontDailyStat.vendor_id == vendor_id, StorefrontDailyStat.day >= start)
        )
    }
    result = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        row = rows.get(day)
        result.append((day, int(row.views) if row else 0, int(row.contacts) if row else 0))
    return result


def orders_between(db: Session, vendor_id: str, start: datetime, end: datetime) -> int:
    """Commandes boutique + commandes restaurant + reservations recues sur la periode (hors annulees)."""
    shop = db.scalar(
        select(func.count(func.distinct(Order.id)))
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(OrderItem.vendor_id == vendor_id, Order.created_at >= start, Order.created_at < end, Order.status != "annulee")
    ) or 0
    food = db.scalar(
        select(func.count()).select_from(RestaurantOrder).where(
            RestaurantOrder.vendor_id == vendor_id,
            RestaurantOrder.created_at >= start,
            RestaurantOrder.created_at < end,
            RestaurantOrder.status != "annulee",
        )
    ) or 0
    stays = db.scalar(
        select(func.count()).select_from(HotelBooking).where(
            HotelBooking.vendor_id == vendor_id,
            HotelBooking.created_at >= start,
            HotelBooking.created_at < end,
            HotelBooking.status != "cancelled",
        )
    ) or 0
    return int(shop) + int(food) + int(stays)


@dataclass
class WeekTotals:
    views: int
    contacts: int
    orders: int


def week_totals(db: Session, vendor_id: str, weeks_ago: int, now: datetime | None = None) -> WeekTotals:
    """Totaux sur 7 jours glissants (weeks_ago=0 : cette semaine, 1 : la semaine d'avant)."""
    end_day = today(now) - timedelta(days=7 * weeks_ago)
    start_day = end_day - timedelta(days=6)
    totals = db.execute(
        select(func.coalesce(func.sum(StorefrontDailyStat.views), 0), func.coalesce(func.sum(StorefrontDailyStat.contacts), 0)).where(
            StorefrontDailyStat.vendor_id == vendor_id, StorefrontDailyStat.day >= start_day, StorefrontDailyStat.day <= end_day
        )
    ).one()
    start = datetime.combine(start_day, datetime.min.time(), NIAMEY_TZ)
    end = datetime.combine(end_day + timedelta(days=1), datetime.min.time(), NIAMEY_TZ)
    return WeekTotals(views=int(totals[0]), contacts=int(totals[1]), orders=orders_between(db, vendor_id, start, end))
