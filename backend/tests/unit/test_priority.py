"""Visibilité prioritaire choisie par l'admin."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from app.services import priority_service as priority

NOW = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)


def test_priority_runs_until_the_end_of_the_last_day_in_niamey() -> None:
    until = priority.until_for(7, NOW)
    # 22 novembre 23 h 59 à Niamey (UTC+1) = 22 h 59 UTC.
    assert until == datetime(2026, 11, 22, 22, 59, tzinfo=UTC)
    assert priority.is_priority(SimpleNamespace(priority_until=until), NOW + timedelta(days=7))
    assert not priority.is_priority(SimpleNamespace(priority_until=until), until + timedelta(minutes=2))


def test_zero_days_removes_priority_and_missing_profile_is_not_priority() -> None:
    assert priority.until_for(0, NOW) is None
    assert not priority.is_priority(SimpleNamespace(priority_until=None), NOW)
    assert not priority.is_priority(None, NOW)


def test_naive_dates_from_the_database_are_read_as_utc() -> None:
    naive = datetime(2026, 11, 20, 10, 0)
    assert priority.is_priority(SimpleNamespace(priority_until=naive), NOW)
