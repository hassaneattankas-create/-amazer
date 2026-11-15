"""Visibilité prioritaire d'un établissement, choisie par l'admin (Admin › Vendeurs et tarifs).

Pendant la période choisie, l'établissement passe en tête des listes (boutiques, Premium, restaurants,
pharmacies et stations, après la garde ou la disponibilité) et dans « À la une » de l'accueil, avec un badge.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def is_priority(profile: object | None, now: datetime | None = None) -> bool:
    """Vrai si la visibilité prioritaire court encore."""
    until = _aware(getattr(profile, "priority_until", None)) if profile is not None else None
    return until is not None and until > (now or datetime.now(UTC))


def until_for(days: int, now: datetime | None = None) -> datetime | None:
    """Fin de la visibilité prioritaire pour `days` jours (fin de journée, heure de Niamey) ; 0 = aucune."""
    if days <= 0:
        return None
    start = now or datetime.now(UTC)
    # Jusqu'à 23 h 59 (Niamey = UTC+1) du dernier jour : « 7 jours » couvre bien 7 journées entières.
    end = (start + timedelta(hours=1) + timedelta(days=days)).replace(hour=23, minute=59, second=0, microsecond=0)
    return end - timedelta(hours=1)
