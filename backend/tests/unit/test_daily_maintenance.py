"""Entretien lancé par le serveur : rappels en journée seulement, nettoyage toujours."""

from datetime import UTC, datetime

from app.services import daily_maintenance as dm


def test_reminders_only_during_the_day(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(dm, "delete_expired_codes", lambda db, now: calls.append("nettoyage") or 0)
    monkeypatch.setattr(dm, "send_subscription_reminders", lambda db: calls.append("rappels") or 0)
    dm.run(None, datetime(2026, 11, 25, 2, 0, tzinfo=UTC))  # 3 h à Niamey
    assert calls == ["nettoyage"]
    calls.clear()
    dm.run(None, datetime(2026, 11, 25, 9, 0, tzinfo=UTC))  # 10 h à Niamey
    assert calls == ["nettoyage", "rappels"]
    calls.clear()
    dm.run(None, datetime(2026, 11, 25, 2, 0, tzinfo=UTC), force=True)
    assert calls == ["nettoyage", "rappels"]
