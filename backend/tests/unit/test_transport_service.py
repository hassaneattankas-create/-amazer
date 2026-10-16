"""Transport : departs publies uniquement, pas de depart passe, billet signe infalsifiable."""

from datetime import UTC, date, datetime

import pytest

from app.core.exceptions import ValidationDomainError
from app.services import transport_service as svc

# Jeudi 15 octobre 2026, 10:00 a Niamey (09:00 UTC).
NOW = datetime(2026, 10, 15, 9, 0, tzinfo=UTC)
TRIP = {"id": "nm", "name": "Niamey - Maradi", "capacity": 50, "departure_times": ["06:00", "14:00"], "available_days": ["2026-10-15", "2026-10-17"]}


def test_only_published_days_and_times_are_accepted() -> None:
    assert svc.validate_departure(TRIP, date(2026, 10, 17), "06:00", NOW) == "06:00"
    with pytest.raises(ValidationDomainError, match="Pas de départ ce jour"):
        svc.validate_departure(TRIP, date(2026, 10, 16), "06:00", NOW)
    with pytest.raises(ValidationDomainError, match="heure de départ proposée"):
        svc.validate_departure(TRIP, date(2026, 10, 17), "09:00", NOW)


def test_departures_already_gone_are_refused() -> None:
    with pytest.raises(ValidationDomainError, match="déjà parti"):
        svc.validate_departure(TRIP, date(2026, 10, 15), "06:00", NOW)
    assert svc.validate_departure(TRIP, date(2026, 10, 15), "14:00", NOW) == "14:00"
    with pytest.raises(ValidationDomainError, match="passé"):
        svc.validate_departure(TRIP, date(2026, 10, 14), "14:00", NOW)


def test_trip_without_schedule_accepts_any_future_day() -> None:
    free_trip = {"id": "x", "capacity": 10}
    assert svc.validate_departure(free_trip, date(2026, 10, 20), None, NOW) is None


def test_ticket_is_signed_and_cannot_be_forged() -> None:
    token = svc.ticket_token("booking-123")
    assert svc.read_ticket(token) == "booking-123"
    for forged in ["booking-123.deadbeef", "booking-999." + token.split(".")[-1], "n'importe quoi", ""]:
        with pytest.raises(ValidationDomainError, match="invalide"):
            svc.read_ticket(forged)
