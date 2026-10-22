"""Utilisateurs <-> Vendeurs et tarifs : memes regles de remise en ligne."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import ValidationDomainError
from app.routes import admin_finance as route
from app.services.vendor_visibility import reactivate_vendor_listings

NOW = datetime(2026, 10, 22, tzinfo=UTC)


def _price(specs=None):
    return SimpleNamespace(is_active=False, product=SimpleNamespace(specs=specs or {}))


def test_reactivation_keeps_deleted_and_paused_products_offline() -> None:
    kept, deleted, paused = _price(), _price({"seller_deleted": True}), _price({"seller_paused": True})
    db = Mock()
    db.scalars.return_value = SimpleNamespace(all=lambda: [kept, deleted, paused])
    assert reactivate_vendor_listings(db, "v-1") == 1
    assert (kept.is_active, deleted.is_active, paused.is_active) == (True, False, False)


@pytest.mark.parametrize(
    "paid_until, onboarding, expected",
    [(NOW + timedelta(days=3), NOW, True), (NOW - timedelta(days=1), NOW, False), (None, NOW, False), (NOW + timedelta(days=3), None, False)],
)
def test_subscription_running(paid_until, onboarding, expected) -> None:
    profile = SimpleNamespace(subscription_paid_until=paid_until, onboarding_fee_paid_at=onboarding)
    assert route._subscription_running(profile, NOW) is expected


def test_gift_month_does_not_silently_restore_a_retired_account(monkeypatch) -> None:
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(route, "_require_finance_pin", lambda *_a, **_k: None)
    profile = SimpleNamespace(user_id="u-1", vendor_id="v-1", subscription_paid_until=None, onboarding_fee_paid_at=None)
    db = Mock()
    db.get.side_effect = lambda model, _id: profile if model is route.SellerProfile else SimpleNamespace(is_active=False)
    with pytest.raises(ValidationDomainError, match="restaurez-le"):
        route.grant_seller_subscription("p-1", SimpleNamespace(), db, SimpleNamespace(id="admin"), months=1)
    db.commit.assert_not_called()
