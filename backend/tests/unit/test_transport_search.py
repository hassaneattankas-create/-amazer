"""Recherche de trajets toutes compagnies : lecture du nom, arrets, sens du voyage."""

from app.services.transport_service import match_route, normalize_city, route_cities

DIFFA = {"name": "Niamey - Diffa", "stops": ["Dosso", "Konni", "Maradi", "Zinder"]}


def test_route_reads_name_and_stops_in_order() -> None:
    assert route_cities(DIFFA) == ["Niamey", "Dosso", "Konni", "Maradi", "Zinder", "Diffa"]
    assert route_cities({"name": "Niamey → Ouagadougou"}) == ["Niamey", "Ouagadougou"]
    assert route_cities({"name": "Agadez-Arlit"}) == ["Agadez", "Arlit"]


def test_partial_stretch_matches_in_travel_direction_only() -> None:
    assert match_route(DIFFA, "niamey", "zinder") == ("Niamey", "Zinder")
    assert match_route(DIFFA, "Maradi", "") == ("Maradi", "Diffa")
    assert match_route(DIFFA, "Zinder", "Niamey") is None
    assert match_route(DIFFA, "Diffa", "") is None


def test_city_names_ignore_case_and_accents() -> None:
    assert normalize_city("  TILLABÉRI ") == "tillaberi"
    assert match_route({"name": "Niamey - Tillabéri"}, "NIAMEY", "tillaberi") == ("Niamey", "Tillabéri")


def test_customer_can_change_until_two_hours_before_departure() -> None:
    from datetime import UTC, date, datetime
    from types import SimpleNamespace

    from app.services.transport_service import can_change

    ticket = SimpleNamespace(status="confirmed", check_in_date=date(2026, 12, 1), departure_time="14:00")
    # 14:00 a Niamey = 13:00 UTC ; limite = 11:00 UTC.
    assert can_change(ticket, datetime(2026, 12, 1, 10, 59, tzinfo=UTC)) is True
    assert can_change(ticket, datetime(2026, 12, 1, 11, 0, tzinfo=UTC)) is False
    used = SimpleNamespace(status="checked_in", check_in_date=date(2026, 12, 5), departure_time="14:00")
    assert can_change(used, datetime(2026, 12, 1, tzinfo=UTC)) is False


def test_names_without_dash_and_lowercase_cities() -> None:
    assert route_cities({"name": "Niamey agadez"}) == ["Niamey", "Agadez"]
    assert route_cities({"name": "diffa"}) == ["Diffa"]
    assert route_cities({"name": "Birni N'Konni - Niamey"}) == ["Birni N'Konni", "Niamey"]
