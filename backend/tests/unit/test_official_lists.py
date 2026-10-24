from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationDomainError
from app.database import Base
from app.models.official_list import OfficialList, OfficialListEntry
from app.routes import official_lists as route
from app.routes.official_lists import OfficialListCreate


@pytest.fixture
def db(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[OfficialList.__table__, OfficialListEntry.__table__])
    monkeypatch.setattr(route, "cache_get_json", lambda _key: None)
    monkeypatch.setattr(route, "cache_set_json", lambda *_a, **_k: None)
    monkeypatch.setattr(route, "cache_delete_prefixes", lambda *_a: None)
    monkeypatch.setattr(route, "enforce_csrf", lambda _request: None)
    with Session(engine) as session:
        yield session


def test_received_lists_are_seeded_once_with_every_line() -> None:
    from app.data.official_lists_2026_10 import ORIBA_FUEL, PHARMACY_DUTY

    assert len(PHARMACY_DUTY["entries"]) == 42 and len(ORIBA_FUEL["entries"]) == 56
    assert {e[0] for e in PHARMACY_DUTY["entries"]} == {"1", "2", "3", "4", "5"}


def test_seed_is_idempotent_and_each_list_has_its_own_period(db: Session) -> None:
    assert route.seed_official_lists(db) == 2
    assert route.seed_official_lists(db) == 0
    rows = {r.kind: r for r in db.scalars(select(OfficialList)).all()}
    duty, fuel = rows["pharmacy_duty"], rows["fuel_supply"]
    # Garde : du samedi 24/10 08 h au samedi 31/10 08 h (Niamey = UTC+1) ; communique Oriba : la journee du 24/10.
    assert duty.starts_at.replace(tzinfo=UTC) == datetime(2026, 10, 24, 7, 0, tzinfo=UTC)
    assert duty.ends_at.replace(tzinfo=UTC) == datetime(2026, 10, 31, 7, 0, tzinfo=UTC)
    assert fuel.ends_at.replace(tzinfo=UTC) == datetime(2026, 10, 24, 23, 0, tzinfo=UTC)
    assert db.scalar(select(func.count()).select_from(OfficialListEntry).where(OfficialListEntry.list_id == fuel.id)) == 56


def test_admin_publishes_a_pasted_list(db: Session) -> None:
    now = datetime.now(UTC)
    payload = OfficialListCreate(
        kind="pharmacy_duty",
        title="Pharmacies de garde · Niamey · Groupe n°3",
        source="Comité de garde",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(days=7),
        lines="1 | Issa-Beri | Plateau | En face CEG 5 | 20 74 28 98\n\n2 | Lazaret | Lazaret | Non loin de Bab Salam | 90 58 37 76\n",
    )
    created = route.admin_create_official_list(payload, None, db, None)
    assert [(e.group_label, e.name, e.phone) for e in created.entries] == [("1", "Issa-Beri", "20 74 28 98"), ("2", "Lazaret", "90 58 37 76")]
    current = route.current_official_lists(db, kind="pharmacy_duty", city="niamey")
    assert [c.title for c in current] == ["Pharmacies de garde · Niamey · Groupe n°3"]
    assert route.current_official_lists(db, kind="fuel_supply", city=None) == []
    with pytest.raises(ValidationDomainError):
        route.admin_create_official_list(payload.model_copy(update={"ends_at": now - timedelta(days=1)}), None, db, None)
    with pytest.raises(ValidationDomainError):
        route.admin_create_official_list(payload.model_copy(update={"lines": "1 | Pharma | Plateau | x | appeler-moi"}), None, db, None)
    route.admin_delete_official_list(created.id, None, db, None)
    assert route.current_official_lists(db, kind="pharmacy_duty", city=None) == []


def test_fuel_list_lines_are_names_with_an_optional_detail() -> None:
    assert route.parse_lines("fuel_supply", "Bonkaney 2 | Ex-Arewa\nPlateau") == [
        {"group_label": None, "name": "Bonkaney 2", "district": None, "location": "Ex-Arewa", "phone": None},
        {"group_label": None, "name": "Plateau", "district": None, "location": None, "phone": None},
    ]
