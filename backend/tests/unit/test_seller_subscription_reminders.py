from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from app.services import seller_subscription_reminder_service as reminders


def _patch_notification(monkeypatch: pytest.MonkeyPatch) -> list[MagicMock]:
    captured: list[MagicMock] = []

    class FakeNotificationService:
        def __init__(self, db):  # noqa: ANN001
            mock = MagicMock()
            captured.append(mock)
            self._mock = mock

        def send_to_user(self, **kwargs):  # noqa: ANN003
            return self._mock.send_to_user(**kwargs)

    monkeypatch.setattr(reminders, "NotificationService", FakeNotificationService)
    return captured


def test_reminders_skip_without_onboarding(monkeypatch: pytest.MonkeyPatch) -> None:
    mocks = _patch_notification(monkeypatch)
    db = MagicMock()
    profile = MagicMock()
    profile.onboarding_fee_paid_at = None
    profile.subscription_paid_until = datetime.now(UTC) + timedelta(days=30)
    profile.id = "p1"

    reminders.maybe_send_seller_subscription_reminders(db, user_id="u1", profile=profile)

    assert mocks == []
    db.commit.assert_not_called()


def test_reminders_expired_notifies_when_not_yet_logged(monkeypatch: pytest.MonkeyPatch) -> None:
    mocks = _patch_notification(monkeypatch)
    db = MagicMock()
    expired = datetime.now(UTC) - timedelta(hours=2)
    expiry_key = expired.strftime("%Y%m%d")
    profile = MagicMock()
    profile.onboarding_fee_paid_at = datetime.now(UTC) - timedelta(days=40)
    profile.subscription_paid_until = expired
    profile.id = "p99"

    db.scalar.return_value = None

    reminders.maybe_send_seller_subscription_reminders(db, user_id="u9", profile=profile)

    assert mocks
    mocks[0].send_to_user.assert_called_once()
    payload = mocks[0].send_to_user.call_args.kwargs["payload"]
    assert (payload.data or {}).get("tag") == f"seller_sub_expired_{profile.id}_{expiry_key}"
    db.commit.assert_called_once()


def test_reminders_expired_skips_if_tag_exists(monkeypatch: pytest.MonkeyPatch) -> None:
    mocks = _patch_notification(monkeypatch)
    db = MagicMock()
    expired = datetime.now(UTC) - timedelta(days=2)
    profile = MagicMock()
    profile.onboarding_fee_paid_at = datetime.now(UTC) - timedelta(days=40)
    profile.subscription_paid_until = expired
    profile.id = "pz"

    db.scalar.return_value = "existing-row"

    reminders.maybe_send_seller_subscription_reminders(db, user_id="u2", profile=profile)

    assert mocks == []
    db.commit.assert_not_called()


def test_reminders_7d_bucket_idempotent_by_tag(monkeypatch: pytest.MonkeyPatch) -> None:
    mocks = _patch_notification(monkeypatch)
    db = MagicMock()
    until = datetime.now(UTC) + timedelta(days=5)
    expiry_key = until.strftime("%Y%m%d")
    profile = MagicMock()
    profile.onboarding_fee_paid_at = datetime.now(UTC)
    profile.subscription_paid_until = until
    profile.id = "p55"

    db.scalar.return_value = None

    reminders.maybe_send_seller_subscription_reminders(db, user_id="u5", profile=profile)

    assert mocks
    payload = mocks[0].send_to_user.call_args.kwargs["payload"]
    assert (payload.data or {}).get("tag") == f"seller_sub_remind_7d_{profile.id}_{expiry_key}"
    assert mocks[0].send_to_user.call_count == 1
    db.commit.assert_called_once()

    db.scalar.return_value = "existing-row"

    reminders.maybe_send_seller_subscription_reminders(db, user_id="u5", profile=profile)

    assert mocks[0].send_to_user.call_count == 1
    db.commit.assert_called_once()
