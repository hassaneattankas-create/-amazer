"""Transport : places restantes par depart (jour + heure), controle du depart, billet a QR code signe.

Inspire des compagnies de car en ligne (FlixBus, Rimbo) : le client choisit un trajet, un jour et une
heure parmi ceux publies, voit les places restantes, et recoit un billet a QR code que le transporteur
scanne a l'embarquement. Un billet ne peut pas etre falsifie (signature serveur) ni servir deux fois.
"""

import hashlib
import hmac
from datetime import UTC, date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.exceptions import ValidationDomainError
from app.models.hospitality import HotelBooking

NIAMEY_TZ = timezone(timedelta(hours=1))
HOLDING_STATUSES = ("pending", "confirmed", "checked_in")
MAX_ADVANCE_DAYS = 180


def _now_local(now: datetime | None = None) -> datetime:
    return (now or datetime.now(UTC)).astimezone(NIAMEY_TZ)


def validate_departure(trip: dict, day: date, time: str | None, now: datetime | None = None) -> str | None:
    """Verifie que le jour et l'heure font partie des departs publies et ne sont pas passes."""
    local = _now_local(now)
    if day < local.date():
        raise ValidationDomainError("Ce départ est déjà passé.")
    if day > local.date() + timedelta(days=MAX_ADVANCE_DAYS):
        raise ValidationDomainError("Réservation possible jusqu'à 6 mois à l'avance.")
    days = [str(d) for d in (trip.get("available_days") or []) if d]
    if days and day.isoformat() not in days:
        raise ValidationDomainError("Pas de départ ce jour-là pour ce trajet. Choisissez un jour proposé.")
    times = [str(t) for t in (trip.get("departure_times") or []) if t]
    if times:
        if not time or time not in times:
            raise ValidationDomainError("Choisissez une heure de départ proposée.")
        hours, minutes = (int(part) for part in time.split(":"))
        if day == local.date() and (hours * 60 + minutes) <= local.hour * 60 + local.minute:
            raise ValidationDomainError("Ce départ est déjà parti. Choisissez une heure plus tard.")
        return time
    return None


def seats_taken(db: Session, vendor_id: str, trip_id: str, day: date, time: str | None) -> int:
    query = select(func.coalesce(func.sum(HotelBooking.guest_count), 0)).where(
        HotelBooking.vendor_id == vendor_id,
        HotelBooking.room_type_id == trip_id,
        HotelBooking.check_in_date == day,
        HotelBooking.status.in_(HOLDING_STATUSES),
    )
    query = query.where(HotelBooking.departure_time == time) if time else query.where(HotelBooking.departure_time.is_(None))
    return int(db.scalar(query) or 0)


def seats_left(db: Session, vendor_id: str, trip: dict, day: date, time: str | None) -> int:
    capacity = max(int(trip.get("capacity") or 1), 1)
    return max(capacity - seats_taken(db, vendor_id, str(trip.get("id")), day, time), 0)


# ------------------------------------------------------------------ billet

def _signature(booking_id: str) -> str:
    key = get_settings().jwt_secret_key.encode()
    return hmac.new(key, f"ticket:{booking_id}".encode(), hashlib.sha256).hexdigest()[:32]


def ticket_token(booking_id: str) -> str:
    return f"{booking_id}.{_signature(booking_id)}"


def read_ticket(token: str) -> str:
    """Identifiant de reservation d'un billet authentique, sinon erreur."""
    booking_id, _, signature = (token or "").strip().rpartition(".")
    if not booking_id or not hmac.compare_digest(signature, _signature(booking_id)):
        raise ValidationDomainError("Billet invalide ou falsifié.")
    return booking_id
