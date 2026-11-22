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


# ------------------------------------------------------------------ recherche de trajets (toutes compagnies)

import re  # noqa: E402
import unicodedata  # noqa: E402

_ROUTE_SPLIT = re.compile(r"\s*(?:→|->|–|—|/|\s-\s|-|\sà\s|\sa\s)\s*", re.IGNORECASE)


def normalize_city(text: str) -> str:
    """« Niamey » == « niamey » == « NIAMEY » ; accents et espaces ignores."""
    plain = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    return " ".join(plain.lower().replace("'", " ").split())


def _display_city(text: str) -> str:
    """« diffa » -> « Diffa » ; les noms deja ecrits avec des majuscules sont gardes tels quels."""
    text = " ".join(text.split())
    return text if text != text.lower() else " ".join(word[:1].upper() + word[1:] for word in text.split())


def route_cities(trip: dict) -> list[str]:
    """Villes du trajet dans l'ordre : depart, arrets publies, arrivee (lus dans le nom « Niamey - Zinder »)."""
    parts = [_display_city(part) for part in _ROUTE_SPLIT.split(str(trip.get("name") or "")) if part.strip()]
    if not parts:
        return []
    if len(parts) == 1 and len(parts[0].split()) == 2:
        # « Niamey Agadez » ecrit sans tiret : deux villes.
        parts = [_display_city(word) for word in parts[0].split()]
    stops = [_display_city(str(stop)) for stop in (trip.get("stops") or []) if str(stop).strip()]
    if len(parts) == 1:
        return [parts[0], *stops]
    middle = parts[1:-1] + [stop for stop in stops if normalize_city(stop) not in {normalize_city(p) for p in parts}]
    return [parts[0], *middle, parts[-1]]


def _city_index(cities: list[str], query: str, start: int = 0) -> int | None:
    wanted = normalize_city(query)
    if not wanted:
        return None
    for index in range(start, len(cities)):
        city = normalize_city(cities[index])
        if city == wanted or city.startswith(wanted) or wanted in city.split():
            return index
    return None


def match_route(trip: dict, origin: str, destination: str) -> tuple[str, str] | None:
    """(ville de montee, ville de descente) si le trajet relie origine -> destination dans ce sens."""
    cities = route_cities(trip)
    if len(cities) < 2:
        return None
    if origin.strip():
        first = _city_index(cities[:-1], origin)
        if first is None:
            return None
    else:
        first = 0
    if destination.strip():
        last = _city_index(cities, destination, first + 1)
        if last is None:
            return None
    else:
        last = len(cities) - 1
    return cities[first], cities[last]


def search_trips(db: Session, origin: str, destination: str, day: date, now: datetime | None = None) -> list[dict]:
    """Departs du jour de toutes les compagnies visibles, du moins cher au plus cher."""
    from app.models.seller_profile import SellerProfile
    from app.models.vendor import Vendor
    from app.services.shop_plan_service import has_paid_access

    local = _now_local(now)
    if day < local.date() or day > local.date() + timedelta(days=MAX_ADVANCE_DAYS):
        return []
    profiles = db.scalars(
        select(SellerProfile)
        .join(Vendor, Vendor.id == SellerProfile.vendor_id)
        .where(
            Vendor.is_active.is_(True),
            SellerProfile.accepts_hotel_bookings.is_(True),
            (SellerProfile.offers_transport.is_(True)) | (SellerProfile.activity_type == "transport"),
        )
    ).all()
    results: list[dict] = []
    for profile in profiles:
        if not has_paid_access(profile, now):
            continue
        for trip in profile.room_types or []:
            if not isinstance(trip, dict) or not trip.get("id"):
                continue
            stretch = match_route(trip, origin, destination)
            if stretch is None:
                continue
            days = [str(d) for d in (trip.get("available_days") or []) if d]
            if days and day.isoformat() not in days:
                continue
            times = [str(t) for t in (trip.get("departure_times") or []) if t] or [None]
            departures = []
            for time in sorted(times, key=lambda value: value or ""):
                if time and day == local.date():
                    hours, minutes = (int(part) for part in time.split(":"))
                    if hours * 60 + minutes <= local.hour * 60 + local.minute:
                        continue
                departures.append({"time": time, "seats_left": seats_left(db, profile.vendor_id, trip, day, time)})
            if not departures:
                continue
            results.append(
                {
                    "vendor_id": profile.vendor_id,
                    "company": profile.business_name,
                    "logo_url": profile.logo_url,
                    "is_verified": bool(profile.is_verified),
                    "trip_id": str(trip.get("id")),
                    "trip_name": str(trip.get("name") or ""),
                    "board_city": stretch[0],
                    "alight_city": stretch[1],
                    "cities": route_cities(trip),
                    "duration": trip.get("duration") or None,
                    "price": float(trip.get("night_price") or 0),
                    "capacity": max(int(trip.get("capacity") or 1), 1),
                    "departures": departures,
                }
            )
    results.sort(key=lambda row: (row["price"], row["departures"][0]["time"] or ""))
    return results


def known_cities(db: Session) -> list[str]:
    """Villes citees par les compagnies (suggestions du formulaire de recherche)."""
    from app.models.seller_profile import SellerProfile

    seen: dict[str, str] = {}
    profiles = db.scalars(
        select(SellerProfile).where((SellerProfile.offers_transport.is_(True)) | (SellerProfile.activity_type == "transport"))
    ).all()
    for profile in profiles:
        for trip in profile.room_types or []:
            if isinstance(trip, dict):
                for city in route_cities(trip):
                    seen.setdefault(normalize_city(city), city)
    return sorted(seen.values(), key=normalize_city)[:300]


# ------------------------------------------------------------------ billet : report et annulation par le client

CHANGE_DEADLINE_HOURS = 2
CHANGEABLE_STATUSES = ("pending", "confirmed")


def departure_at(day: date, time: str | None) -> datetime:
    """Heure de depart (Niamey) ; sans heure publiee, on prend 6 h du matin."""
    hours, minutes = (int(part) for part in (time or "06:00").split(":"))
    return datetime(day.year, day.month, day.day, hours, minutes, tzinfo=NIAMEY_TZ)


def can_change(booking: HotelBooking, now: datetime | None = None) -> bool:
    """Le client peut reporter ou annuler jusqu'a 2 h avant le depart, tant que le billet n'est pas utilise."""
    if booking.status not in CHANGEABLE_STATUSES:
        return False
    deadline = departure_at(booking.check_in_date, booking.departure_time) - timedelta(hours=CHANGE_DEADLINE_HOURS)
    return (now or datetime.now(UTC)) < deadline
