"""Restaurants : horaires (heure de Niamey), pause, prix des options relus dans le menu, ordre des etapes."""

from datetime import UTC, datetime

import pytest

from app.core.exceptions import ValidationDomainError
from app.services import restaurant_service as svc

WEEK = {day: {"open": "11:00", "close": "22:00"} for day in svc.DAYS}


def at(hour: int, minute: int = 0, day: int = 15) -> datetime:
    """Heure de Niamey (UTC+1) le jeudi 15 octobre 2026 (day=15) -> instant UTC."""
    return datetime(2026, 10, day, hour - 1, minute, tzinfo=UTC) if hour >= 1 else datetime(2026, 10, day - 1, 23, minute, tzinfo=UTC)


def test_no_hours_means_always_open_and_pause_closes() -> None:
    assert svc.open_state(None, False).is_open
    paused = svc.open_state(WEEK, True, at(12))
    assert not paused.is_open and paused.label == "Commandes en pause"


def test_open_and_closed_labels_use_niamey_time() -> None:
    assert svc.open_state(WEEK, False, at(12)).label == "Ouvert jusqu'à 22:00"
    early = svc.open_state(WEEK, False, at(9))
    assert not early.is_open and early.label == "Fermé · ouvre à 11:00"
    late = svc.open_state(WEEK, False, at(23))
    assert not late.is_open and late.label == "Fermé · ouvre demain à 11:00"


def test_closed_day_and_service_after_midnight() -> None:
    hours = dict(WEEK)
    hours["jeudi"] = None
    assert svc.open_state(hours, False, at(12)).label == "Fermé · ouvre demain à 11:00"
    night = {day: {"open": "18:00", "close": "02:00"} for day in svc.DAYS}
    assert svc.open_state(night, False, at(23)).is_open
    assert svc.open_state(night, False, at(1, 30, day=16)).is_open  # vendredi 01:30, service du jeudi
    assert not svc.open_state(night, False, at(3, 0, day=16)).is_open


def test_hours_are_validated() -> None:
    with pytest.raises(ValidationDomainError):
        svc.normalize_weekly_hours({"lundi": {"open": "25:00", "close": "10:00"}})
    with pytest.raises(ValidationDomainError):
        svc.normalize_weekly_hours({"lundi": {"open": "10:00", "close": "10:00"}})
    cleaned = svc.normalize_weekly_hours({"lundi": {"open": "08:00", "close": "14:30"}})
    assert cleaned["lundi"] == {"open": "08:00", "close": "14:30"} and cleaned["mardi"] is None


def test_option_prices_come_from_the_menu_not_the_client() -> None:
    menu = [{"name": "Supplément viande", "price": 500}, {"name": "Piment", "price": 0}]
    chosen = svc.priced_options(menu, ["supplément viande", "Piment", "Piment"])
    assert chosen == [{"name": "Supplément viande", "price": 500.0}, {"name": "Piment", "price": 0.0}]
    with pytest.raises(ValidationDomainError, match="indisponible"):
        svc.priced_options(menu, ["Option inventée"])


def test_status_must_follow_the_kitchen_order() -> None:
    svc.check_transition("commande", "preparation")
    svc.check_transition("commande", "annulee")
    svc.check_transition("livraison", "recu")
    for current, target in [("commande", "recu"), ("preparation", "annulee"), ("recu", "commande")]:
        with pytest.raises(ValidationDomainError):
            svc.check_transition(current, target)


def test_category_is_cleaned() -> None:
    assert svc.clean_category("  Boissons   fraîches ") == "Boissons fraîches"
    assert svc.clean_category(None) == "Plats"
