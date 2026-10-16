"""Hotels : pas de surreservation (nuit par nuit), dates valides, etapes du sejour."""

from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.core.exceptions import ValidationDomainError
from app.services import hotel_service as svc

NOW = datetime(2026, 10, 16, 10, tzinfo=UTC)
D = date(2026, 10, 20)


def booking(room: str, start: int, nights: int) -> SimpleNamespace:
    return SimpleNamespace(room_type_id=room, check_in_date=D + timedelta(days=start), check_out_date=D + timedelta(days=start + nights))


def test_peak_occupancy_is_counted_night_by_night() -> None:
    # 2 chambres « std » : une reservation 20->22, une autre 21->23. La nuit du 21, les deux sont prises.
    bookings = [booking("std", 0, 2), booking("std", 1, 2), booking("suite", 5, 1)]
    assert svc.occupied_by_night(bookings, D, D + timedelta(days=3)) == {"std": 2}
    # Un client qui part le 22 libere la chambre pour une arrivee le 22.
    assert svc.occupied_by_night(bookings, D + timedelta(days=3), D + timedelta(days=4)) == {}


def test_room_count_defaults_to_one() -> None:
    assert svc.room_count({"id": "a"}) == 1
    assert svc.room_count({"id": "a", "room_count": 5}) == 5
    assert svc.room_count({"id": "a", "room_count": "x"}) == 1


def test_stay_dates_are_validated() -> None:
    today = date(2026, 10, 16)
    assert svc.validate_stay(today, today + timedelta(days=2), NOW) == 2
    with pytest.raises(ValidationDomainError, match="passée"):
        svc.validate_stay(today - timedelta(days=1), today + timedelta(days=1), NOW)
    with pytest.raises(ValidationDomainError, match="après"):
        svc.validate_stay(today, today, NOW)
    with pytest.raises(ValidationDomainError, match="nuits"):
        svc.validate_stay(today, today + timedelta(days=61), NOW)


def test_stay_steps_follow_the_hotel_flow() -> None:
    svc.check_transition("pending", "confirmed")
    svc.check_transition("confirmed", "checked_in")
    svc.check_transition("confirmed", "no_show")
    svc.check_transition("checked_in", "checked_out")
    for current, target in [("pending", "checked_in"), ("checked_out", "pending"), ("cancelled", "confirmed")]:
        with pytest.raises(ValidationDomainError):
            svc.check_transition(current, target)
