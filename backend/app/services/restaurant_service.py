"""Restaurants : horaires, pause des commandes, menu (categories, epuise) et prix verifies cote serveur.

Inspire d'Uber Eats / Glovo : le restaurant peut mettre ses commandes en pause, un plat peut etre
« epuise » pour la journee sans quitter le menu, et le prix d'une option vient toujours du menu
enregistre (jamais du telephone du client).
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone

from app.core.exceptions import ValidationDomainError

# Niamey : UTC+1 toute l'annee (pas d'heure d'ete).
NIAMEY_TZ = timezone(timedelta(hours=1))
DAYS = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")
DEFAULT_CATEGORIES = ("Entrées", "Plats", "Grillades", "Accompagnements", "Desserts", "Boissons")
DEFAULT_CATEGORY = "Plats"

# Statuts d'une commande restaurant et passages autorises (le restaurant ne peut pas sauter d'etape).
NEXT_STATUSES: dict[str, tuple[str, ...]] = {
    "commande": ("preparation", "annulee"),
    "preparation": ("livraison",),
    "livraison": ("recu",),
}


def _minutes(value: str) -> int:
    hours, minutes = value.split(":")
    total = int(hours) * 60 + int(minutes)
    if not (0 <= int(hours) <= 24 and 0 <= int(minutes) < 60 and total <= 24 * 60):
        raise ValueError(value)
    return total


def normalize_weekly_hours(raw: dict | None) -> dict[str, dict[str, str] | None] | None:
    """{jour: {"open": "HH:MM", "close": "HH:MM"} ou None (ferme)}. None = pas d'horaires (toujours ouvert)."""
    if raw is None:
        return None
    result: dict[str, dict[str, str] | None] = {}
    for day in DAYS:
        slot = raw.get(day)
        if not slot:
            result[day] = None
            continue
        try:
            opening, closing = str(slot["open"]), str(slot["close"])
            if _minutes(opening) == _minutes(closing):
                raise ValueError
        except (KeyError, ValueError, TypeError, AttributeError) as exc:
            raise ValidationDomainError(f"Horaires invalides pour {day} (format HH:MM, ouverture ≠ fermeture).") from exc
        result[day] = {"open": opening, "close": closing}
    return result


@dataclass(frozen=True)
class OpenState:
    is_open: bool
    label: str  # texte court pour le client : « Ouvert jusqu'à 22:00 », « Fermé · ouvre à 11:00 », « Pause »


def open_state(weekly_hours: dict | None, orders_paused: bool, now: datetime | None = None) -> OpenState:
    if orders_paused:
        return OpenState(False, "Commandes en pause")
    if not weekly_hours:
        return OpenState(True, "Ouvert")
    local = (now or datetime.now(UTC)).astimezone(NIAMEY_TZ)
    minute = local.hour * 60 + local.minute
    today = DAYS[local.weekday()]
    yesterday = DAYS[(local.weekday() - 1) % 7]

    def window(day: str) -> tuple[int, int] | None:
        slot = weekly_hours.get(day)
        return (_minutes(slot["open"]), _minutes(slot["close"])) if slot else None

    # Service de la veille qui deborde apres minuit (ex. 18:00 -> 02:00).
    prev = window(yesterday)
    if prev and prev[1] < prev[0] and minute < prev[1]:
        return OpenState(True, f"Ouvert jusqu'à {weekly_hours[yesterday]['close']}")
    current = window(today)
    if current:
        start, end = current
        if (start < end and start <= minute < end) or (end < start and minute >= start):
            return OpenState(True, f"Ouvert jusqu'à {weekly_hours[today]['close']}")
        if minute < start:
            return OpenState(False, f"Fermé · ouvre à {weekly_hours[today]['open']}")
    for offset in range(1, 8):
        day = DAYS[(local.weekday() + offset) % 7]
        if weekly_hours.get(day):
            when = "demain" if offset == 1 else day
            return OpenState(False, f"Fermé · ouvre {when} à {weekly_hours[day]['open']}")
    return OpenState(False, "Fermé")


def clean_category(value: str | None) -> str:
    text = " ".join((value or "").split())[:60]
    return text or DEFAULT_CATEGORY


def priced_options(menu_options: list[dict] | None, requested_names: list[str]) -> list[dict]:
    """Options choisies, au prix du MENU. Une option inconnue est refusee."""
    catalog = {
        str(option.get("name", "")).strip().lower(): option
        for option in (menu_options or [])
        if isinstance(option, dict) and option.get("name")
    }
    chosen: list[dict] = []
    seen: set[str] = set()
    for name in requested_names:
        key = (name or "").strip().lower()
        if key in seen:
            continue
        option = catalog.get(key)
        if option is None:
            raise ValidationDomainError(f"Option « {name} » indisponible pour ce plat. Actualisez le menu.")
        price = float(option.get("price") or 0)
        chosen.append({"name": str(option["name"]), "price": max(price, 0.0)})
        seen.add(key)
    return chosen


def check_transition(current: str, target: str) -> None:
    if target == current:
        return
    if target not in NEXT_STATUSES.get(current, ()):
        raise ValidationDomainError("Étape impossible : suivez l'ordre préparation → livraison → livrée.")
