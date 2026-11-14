"""Pharmacies de garde : liste officielle de la semaine, noms, numéros et garde automatique des pharmacies inscrites."""

from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models.official_list import OfficialList, OfficialListEntry
from app.routes.official_lists import create_list, parse_lines
from app.services import pharmacy_duty_service as duty

NIAMEY = timezone(timedelta(hours=1))


def test_same_name_ignores_case_accents_and_prefix() -> None:
    assert duty.same_name("Pharmacie Ar Rahma", "AR RAHMA")
    assert duty.same_name("Lamordé", "LAMORDE")
    assert duty.same_name("Pharmacie de la Référence", "REFERENCE")
    assert not duty.same_name("Château I", "Château Bi")
    assert not duty.same_name("", "")


def test_phone_link_adds_niger_prefix() -> None:
    assert duty.phone_link("20 73 68 58") == "+22720736858"
    assert duty.phone_link("+227 91 26 87 18") == "+22791268718"
    assert duty.phone_link("00227 90 00 00 00") == "+22790000000"
    assert duty.phone_link("########") is None


def test_labels_use_niamey_time() -> None:
    end = datetime(2026, 11, 21, 7, 0, tzinfo=UTC)  # 8 h à Niamey
    assert duty.until_label(end) == "jusqu'au samedi 21 nov. à 8 h"
    start = datetime(2026, 11, 14, 8, 0, tzinfo=NIAMEY)
    assert duty.period_label(start, end) == "du samedi 14 nov. 8 h au samedi 21 nov. 8 h"


def test_listed_registered_pharmacy_is_on_duty_automatically() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[OfficialList.__table__, OfficialListEntry.__table__])
    now = datetime(2026, 11, 16, 12, 0, tzinfo=UTC)
    with Session(engine) as db:
        lines = "Commune IV | AR RAHMA |  | Niamey 2000, face au CSP Assifa | 91 01 01 84\nCommune V | LAMORDE |  | Derrière l'ex-CHU | 92 19 80 95"
        base = {"kind": "pharmacy_duty", "city": "Niamey", "source": "MS/HP", "brand": None, "fuel": None, "contact_phone": None, "contact_address": None}
        create_list(db, {**base, "title": "Cette semaine", "starts_at": datetime(2026, 11, 14, 8, tzinfo=NIAMEY), "ends_at": datetime(2026, 11, 21, 8, tzinfo=NIAMEY)}, parse_lines("pharmacy_duty", lines))
        # Liste passée : ne compte plus
        create_list(db, {**base, "title": "Ancienne", "starts_at": datetime(2026, 10, 24, 8, tzinfo=NIAMEY), "ends_at": datetime(2026, 10, 31, 8, tzinfo=NIAMEY)}, parse_lines("pharmacy_duty", "1 | Issa-Beri |  |  | 20 74 28 98"))
        db.commit()
        official = duty.official_duty(db, now)
        listed = SimpleNamespace(city="Niamey", business_name="Pharmacie Ar Rahma")
        other = SimpleNamespace(city="Niamey", business_name="Pharmacie Issa-Beri")
        ends = duty.official_end_for(listed, official)
        assert ends is not None and duty.until_label(ends) == "jusqu'au samedi 21 nov. à 8 h"
        assert duty.official_end_for(other, official) is None


def test_photo_rows_become_publishable_lines() -> None:
    lines = duty.rows_to_lines([{"group": "Commune I", "name": "Gobi", "location": "Koira Kano | CEG 14", "phone": "80 06 31 26"}])
    entries = parse_lines("pharmacy_duty", lines)
    assert entries == [{"group_label": "Commune I", "name": "Gobi", "district": None, "location": "Koira Kano / CEG 14", "phone": "80 06 31 26"}]
