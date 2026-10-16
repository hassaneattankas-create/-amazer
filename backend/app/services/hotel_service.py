"""Hotels : stock de chambres par type, disponibilite nuit par nuit, dates et etapes du sejour.

Inspire de Booking.com : le client choisit d'abord ses dates, ne voit que les chambres libres,
et la meme chambre ne peut pas etre vendue deux fois la meme nuit (pas de surreservation).
"""

from datetime import UTC, date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationDomainError
from app.models.hospitality import HotelBooking

NIAMEY_TZ = timezone(timedelta(hours=1))
MAX_NIGHTS = 60
MAX_ADVANCE_DAYS = 365
# Reservations qui occupent une chambre (une demande en attente bloque aussi : premier arrive, premier servi).
HOLDING_STATUSES = ("pending", "confirmed", "checked_in")

# Etapes autorisees par l'hotel.
NEXT_STATUSES: dict[str, tuple[str, ...]] = {
    "pending": ("confirmed", "cancelled"),
    "confirmed": ("checked_in", "cancelled", "no_show"),
    "checked_in": ("checked_out",),
}


def today_niamey(now: datetime | None = None) -> date:
    return (now or datetime.now(UTC)).astimezone(NIAMEY_TZ).date()


def room_count(room: dict) -> int:
    try:
        return max(int(room.get("room_count") or 1), 1)
    except (TypeError, ValueError):
        return 1


def validate_stay(check_in: date, check_out: date, now: datetime | None = None) -> int:
    """Nombre de nuits ; erreur claire si les dates sont impossibles."""
    today = today_niamey(now)
    if check_in < today:
        raise ValidationDomainError("La date d'arrivée est déjà passée.")
    if check_in > today + timedelta(days=MAX_ADVANCE_DAYS):
        raise ValidationDomainError("Réservation possible jusqu'à un an à l'avance.")
    nights = (check_out - check_in).days
    if nights <= 0:
        raise ValidationDomainError("La date de départ doit être après la date d'arrivée.")
    if nights > MAX_NIGHTS:
        raise ValidationDomainError(f"Séjour limité à {MAX_NIGHTS} nuits par réservation.")
    return nights


def occupied_by_night(
    bookings: list[HotelBooking], check_in: date, check_out: date
) -> dict[str, int]:
    """Pour chaque type de chambre : le maximum de chambres occupees sur une nuit de la periode."""
    peak: dict[str, int] = {}
    nights = [check_in + timedelta(days=i) for i in range((check_out - check_in).days)]
    for night in nights:
        counts: dict[str, int] = {}
        for booking in bookings:
            if booking.check_in_date <= night < booking.check_out_date:
                counts[booking.room_type_id] = counts.get(booking.room_type_id, 0) + 1
        for room_id, count in counts.items():
            peak[room_id] = max(peak.get(room_id, 0), count)
    return peak


def overlapping_bookings(
    db: Session, vendor_id: str, check_in: date, check_out: date, exclude_id: str | None = None
) -> list[HotelBooking]:
    query = select(HotelBooking).where(
        HotelBooking.vendor_id == vendor_id,
        HotelBooking.status.in_(HOLDING_STATUSES),
        HotelBooking.check_in_date < check_out,
        HotelBooking.check_out_date > check_in,
    )
    if exclude_id:
        query = query.where(HotelBooking.id != exclude_id)
    return list(db.scalars(query).all())


def availability(db: Session, vendor_id: str, rooms: list[dict], check_in: date, check_out: date) -> dict[str, int]:
    """Chambres encore libres par type pour toute la periode."""
    peak = occupied_by_night(overlapping_bookings(db, vendor_id, check_in, check_out), check_in, check_out)
    return {
        str(room.get("id")): max(room_count(room) - peak.get(str(room.get("id")), 0), 0)
        for room in rooms
        if isinstance(room, dict) and room.get("id")
    }


def check_transition(current: str, target: str) -> None:
    if target == current:
        return
    if target not in NEXT_STATUSES.get(current, ()):
        raise ValidationDomainError("Étape impossible pour cette réservation.")
