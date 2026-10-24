"""Services de proximite : pharmacies de garde et stations-essence.

Une pharmacie ou une station est une vitrine Premium dont l'admin a choisi le type (service_kind).
- Pharmacie : « de garde » si l'interrupteur est allume OU si aujourd'hui (heure de Niamey) est dans
  la periode programmee. La periode s'eteint toute seule apres la date de fin : pas d'oubli.
- Station : Super / Gasoil / Gaz, chacun « disponible », « stock faible » ou « rupture », avec l'heure de mise a jour.
  Au-dela du delai de fraicheur (regle par l'admin, 4 h par defaut), l'information est « non confirmee »
  (jamais presentee comme sure). Aucun carburant n'est disponible par defaut : il faut une declaration.
Itineraire : Google Maps (position exacte si enregistree, sinon recherche nom + adresse + ville).
Livraison : AMAZER s'en charge, via le numero regle par l'admin, seulement dans les villes desservies.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta, timezone
from urllib.parse import quote

from app.models.seller_profile import SellerProfile

NIAMEY_TZ = timezone(timedelta(hours=1))
SERVICE_KINDS = ("pharmacy", "fuel_station")
FUELS = ("super", "gasoil", "gaz")
FUEL_STATES = ("available", "low", "out")
# « Stock faible » : il en reste, la station est donc utile au client.
HAS_FUEL_STATES = ("available", "low")
DEFAULT_FUEL_FRESH_HOURS = 4
# Villes livrees par defaut ; l'admin regle la liste dans Tarifs (local_delivery_cities).
DEFAULT_DELIVERY_CITIES = "Niamey"


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def niamey_today(now: datetime | None = None) -> date:
    return (now or datetime.now(UTC)).astimezone(NIAMEY_TZ).date()


def normalize_city(value: str | None) -> str:
    table = str.maketrans("éèêëàâäîïôöùûüç", "eeeeaaaiioouuuc")
    return " ".join((value or "").strip().lower().translate(table).split())


def is_on_duty(profile: SellerProfile, now: datetime | None = None) -> bool:
    if getattr(profile, "service_kind", None) != "pharmacy":
        return False
    if bool(getattr(profile, "on_duty", False)):
        return True
    start, end = getattr(profile, "duty_start", None), getattr(profile, "duty_end", None)
    if start is None or end is None:
        return False
    return start <= niamey_today(now) <= end


def duty_label(profile: SellerProfile, now: datetime | None = None) -> str | None:
    """Texte court pour le client : « De garde jusqu'au 27 oct. » ou None."""
    if not is_on_duty(profile, now):
        return None
    end = getattr(profile, "duty_end", None)
    if end is not None and end >= niamey_today(now):
        months = ("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.")
        return f"De garde jusqu'au {end.day} {months[end.month - 1]}"
    return "De garde"


def clean_fuel_status(raw: dict | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for fuel in FUELS:
        state = (raw or {}).get(fuel)
        if state in FUEL_STATES:
            out[fuel] = state
    return out


def fresh_hours(settings: object | None) -> int:
    """Delai (heures) au-dela duquel une disponibilite n'est plus confirmee, regle par l'admin."""
    value = getattr(settings, "fuel_fresh_hours", None) if settings is not None else None
    return int(value) if isinstance(value, int) and 1 <= value <= 48 else DEFAULT_FUEL_FRESH_HOURS


def fuel_is_fresh(profile: SellerProfile, now: datetime | None = None, hours: int | None = None) -> bool:
    updated = _aware(getattr(profile, "fuel_updated_at", None))
    if updated is None:
        return False
    return (now or datetime.now(UTC)) - updated <= timedelta(hours=hours or DEFAULT_FUEL_FRESH_HOURS)


def has_fuel(profile: SellerProfile, fuel: str | None = None, now: datetime | None = None, hours: int | None = None) -> bool:
    """Au moins un carburant (ou celui demande) disponible ou en stock faible, avec une information recente."""
    if getattr(profile, "service_kind", None) != "fuel_station" or not fuel_is_fresh(profile, now, hours):
        return False
    status = clean_fuel_status(getattr(profile, "fuel_status", None))
    if fuel:
        return status.get(fuel) in HAS_FUEL_STATES
    return any(state in HAS_FUEL_STATES for state in status.values())


def fuel_changes(before: dict | None, after: dict | None) -> list[tuple[str, str | None, str]]:
    """Changements reels de disponibilite (carburant, ancien, nouveau) pour l'historique."""
    old, new = clean_fuel_status(before), clean_fuel_status(after)
    return [(fuel, old.get(fuel), new[fuel]) for fuel in FUELS if fuel in new and new[fuel] != old.get(fuel)]


def maps_url(profile: SellerProfile) -> str:
    lat, lng = getattr(profile, "latitude", None), getattr(profile, "longitude", None)
    if lat is not None and lng is not None:
        return f"https://www.google.com/maps/dir/?api=1&destination={lat:.6f},{lng:.6f}"
    parts = [getattr(profile, "business_name", None), getattr(profile, "address", None), getattr(profile, "city", None), "Niger"]
    query = ", ".join(p.strip() for p in parts if p and str(p).strip())
    return f"https://www.google.com/maps/search/?api=1&query={quote(query)}"


def parse_cities(raw: str | None) -> list[str]:
    """« Niamey, maradi ;Zinder » -> ["Niamey", "maradi", "Zinder"] (sans vides ni doublons)."""
    seen: dict[str, str] = {}
    for part in (raw or "").replace(";", ",").split(","):
        name = " ".join(part.split())
        if name and normalize_city(name) not in seen:
            seen[normalize_city(name)] = name
    return list(seen.values())


def delivery_cities(settings: object | None) -> list[str]:
    """Villes livrees reglees par l'admin (Niamey par defaut)."""
    raw = getattr(settings, "local_delivery_cities", None) if settings is not None else None
    return parse_cities(raw) or parse_cities(DEFAULT_DELIVERY_CITIES)


def delivery_phone(profile: SellerProfile, settings: object | None, now: datetime | None = None) -> str | None:
    """Numero AMAZER de livraison pour ce commerce, ou None si la ville n'est pas encore desservie.

    Stations : seul le gaz s'achete et se livre ; le numero n'est donne que si la station
    indique du gaz disponible, avec une information recente.
    """
    served = {normalize_city(name) for name in delivery_cities(settings)}
    if normalize_city(getattr(profile, "city", None)) not in served:
        return None
    kind = getattr(profile, "service_kind", None)
    if kind == "fuel_station" and not has_fuel(profile, "gaz", now, fresh_hours(settings)):
        return None
    field = "pharmacy_delivery_phone" if kind == "pharmacy" else "fuel_delivery_phone" if kind == "fuel_station" else None
    value = (getattr(settings, field, None) if field and settings is not None else None) or None
    return value.strip() if isinstance(value, str) and value.strip() else None


def valid_position(latitude: float | None, longitude: float | None) -> bool:
    """Position plausible au Niger (avec une marge) : evite une position tapee au hasard."""
    if latitude is None or longitude is None:
        return False
    return 10.0 <= latitude <= 24.5 and -0.5 <= longitude <= 16.5
