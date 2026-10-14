"""Abonnement revendeur et commission AMAZER sur la marge."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import ConflictError
from app.services import reseller_account_service as svc
from app.routes import resellers as route

NOW = datetime(2026, 10, 14, tzinfo=UTC)


def _settings(fee=500, percent=10, trial=0):
    return SimpleNamespace(reseller_subscription_fee=fee, reseller_commission_percent=percent, seller_trial_days=trial)


@pytest.mark.parametrize(("margin", "percent", "expected"), [(1500, 10, (150.0, 1350.0)), (0, 10, (0.0, 0.0)), (1000, 0, (0.0, 1000.0))])
def test_commission_is_taken_from_the_margin(margin, percent, expected) -> None:
    assert svc.split_margin(margin, percent) == expected


def test_subscription_states(monkeypatch) -> None:
    db = Mock()
    monkeypatch.setattr(svc, "get_or_create_global_settings", lambda _db: _settings())
    db.get.return_value = SimpleNamespace(paid_until=NOW + timedelta(days=3))
    assert svc.subscription_active(db, "u-1", NOW) is True
    db.get.return_value = SimpleNamespace(paid_until=NOW - timedelta(days=1))
    assert svc.subscription_active(db, "u-1", NOW) is False
    db.get.return_value = None
    assert svc.subscription_active(db, "u-1", NOW) is False
    monkeypatch.setattr(svc, "get_or_create_global_settings", lambda _db: _settings(fee=0))
    assert svc.subscription_active(db, "u-1", NOW) is True  # abonnement gratuit decide par l'admin


def test_payment_extends_from_current_end_date() -> None:
    account = SimpleNamespace(paid_until=NOW + timedelta(days=10))
    svc.extend_subscription(account, 2, NOW)
    assert account.paid_until == NOW + timedelta(days=70)
    expired = SimpleNamespace(paid_until=NOW - timedelta(days=5))
    svc.extend_subscription(expired, 1, NOW)
    assert expired.paid_until == NOW + timedelta(days=30)


def test_new_account_gets_the_free_trial(monkeypatch) -> None:
    monkeypatch.setattr(svc, "get_or_create_global_settings", lambda _db: _settings(trial=14))
    db = Mock()
    db.get.return_value = None
    account = svc.ensure_account(db, "u-1")
    assert account.paid_until is not None and account.paid_until > datetime.now(UTC) + timedelta(days=13)


def test_publishing_requires_an_active_subscription(monkeypatch) -> None:
    monkeypatch.setattr(route, "ensure_account", lambda _db, _uid: None)
    monkeypatch.setattr(route, "subscription_active", lambda _db, _uid: False)
    monkeypatch.setattr(route, "reseller_terms", lambda _db: (500.0, 10.0))
    with pytest.raises(ConflictError, match="Abonnement revendeur requis"):
        route._require_subscription(Mock(), "u-1")


def test_inactive_reseller_shop_shows_no_products(monkeypatch) -> None:
    monkeypatch.setattr(route, "subscription_active", lambda _db, _uid: False)
    db = Mock()
    db.get.return_value = SimpleNamespace(id="r-1", is_active=True, full_name="Awa Diallo")
    shop = route.reseller_shop("r-1", db)
    assert shop.active is False and shop.items == []
