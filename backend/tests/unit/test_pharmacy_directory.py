"""Annuaire permanent des pharmacies : OpenStreetMap + affiches, position gardée hors garde, correction admin."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models.official_list import OfficialList, OfficialListEntry
from app.models.pharmacy_directory import PharmacyListing
from app.services import pharmacy_directory_service as directory


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[OfficialList.__table__, OfficialListEntry.__table__, PharmacyListing.__table__])
    with Session(engine) as session:
        yield session


def _list(db: Session, entries: list[tuple[str, str | None, str | None]]) -> None:
    from app.routes.official_lists import create_list

    now = datetime.now(UTC)
    create_list(
        db,
        {"kind": "pharmacy_duty", "city": "Niamey", "title": "Garde test", "source": "Test", "starts_at": now - timedelta(days=1), "ends_at": now + timedelta(days=6)},
        [{"group_label": "Commune I", "name": n, "district": None, "location": loc, "phone": p} for n, loc, p in entries],
    )
    db.commit()


def test_osm_seed_then_poster_completes_the_same_pharmacy(db: Session) -> None:
    directory.ensure_seeded(db)
    gobi = directory.find(db, "Niamey", "Gobi")
    assert gobi is not None and gobi.position_source == "osm" and gobi.phone is None
    _list(db, [("Gobi", "Koira Kano, en face du CEG 14", "80 06 31 26")])
    gobi = directory.find(db, "Niamey", "Pharmacie Gobi")
    assert gobi.phone == "80 06 31 26" and gobi.location.startswith("Koira Kano")
    # Pas de doublon : une seule fiche « Gobi ».
    assert len([r for r in directory.directory(db, "Niamey") if r.name_key == "gobi"]) == 1


def test_spelling_variant_reuses_the_osm_listing(db: Session) -> None:
    directory.ensure_seeded(db)
    before = len(directory.directory(db, "Niamey"))
    _list(db, [("Goroual", "Bobiel, devant la Fenifoot", "96 33 71 76")])
    row = directory.find(db, "Niamey", "Goroual")
    assert row is not None and row.position_source == "osm" and row.phone == "96 33 71 76"
    assert len(directory.directory(db, "Niamey")) == before


def test_unknown_pharmacy_kept_with_its_quartier_and_number(db: Session) -> None:
    _list(db, [("Inconnue Test", "Talladjé, près du marché", "90 00 00 01")])
    row = directory.find(db, "Niamey", "Inconnue Test")
    assert row.position_source == "quartier" and row.area == "Talladjé" and row.phone == "90 00 00 01"
    # Toujours là la semaine suivante, même sans garde.
    assert directory.position_of(db, "Niamey", "Inconnue Test") is not None


def test_admin_position_is_never_overwritten(db: Session) -> None:
    _list(db, [("Inconnue Test", "Talladjé", None)])
    row = directory.find(db, "Niamey", "Inconnue Test")
    directory.set_position(row, 13.5, 2.11)
    db.commit()
    _list(db, [("Inconnue Test", "Talladjé, près du marché", "90 00 00 02")])
    row = directory.find(db, "Niamey", "Inconnue Test")
    assert (row.latitude, row.longitude, row.position_source) == (13.5, 2.11, "admin")
    assert row.phone == "90 00 00 02"
    assert directory.position_of(db, "Niamey", "Inconnue Test") == (13.5, 2.11, False, None)
