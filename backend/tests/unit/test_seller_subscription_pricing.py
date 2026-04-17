from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

from app.routes import seller as seller_route


def test_seller_subscription_amount_due_excludes_creation_fee() -> None:
    assert seller_route._seller_subscription_amount_due(monthly_fee=5000, months=3) == 15000


def test_build_subscription_status_does_not_add_creation_fee(monkeypatch) -> None:
    db = Mock()
    db.scalar.return_value = None
    profile = SimpleNamespace(
        id="profile-1",
        onboarding_fee_paid_at=None,
        subscription_paid_until=datetime.now(UTC) + timedelta(days=30),
    )

    monkeypatch.setattr(
        seller_route,
        "get_or_create_global_settings",
        lambda _db: SimpleNamespace(),
    )
    monkeypatch.setattr(
        seller_route,
        "build_effective_seller_finance_settings",
        lambda _settings, _profile: SimpleNamespace(seller_subscription_fee=5000),
    )

    status = seller_route._build_subscription_status(profile, db)

    assert status.monthly_fee == 5000
    assert status.onboarding_fee == 0
    assert status.amount_due_now == 5000
