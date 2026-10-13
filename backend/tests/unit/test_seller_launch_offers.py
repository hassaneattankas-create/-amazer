"""Offres de lancement : essai gratuit et reduction, desactives par defaut, reglables par l'admin."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.schemas.finance import FinanceSettingsUpdateRequest
from app.services.seller_finance_service import build_effective_seller_finance_settings
from app.services.seller_profile_service import apply_seller_onboarding_and_trial


def _settings(**overrides) -> SimpleNamespace:
    values = {
        "commission_rate": 0.0,
        "launch_mode_zero_commission": False,
        "service_fee": 0.0,
        "seller_subscription_fee": 1000.0,
        "seller_subscription_fee_shop": 500.0,
        "seller_subscription_fee_restaurant": 1000.0,
        "seller_subscription_fee_premium": 5000.0,
        "seller_launch_discount_percent": 0,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _profile(**overrides) -> SimpleNamespace:
    values = {
        "activity_type": "shop",
        "storefront_tier": "basic",
        "commission_rate_override": None,
        "service_fee_override": None,
        "seller_subscription_fee_override": None,
        "onboarding_fee_paid_at": None,
        "subscription_paid_until": None,
        "subscription_last_payment_reference": None,
        "is_enterprise": False,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_no_discount_by_default() -> None:
    fee = build_effective_seller_finance_settings(_settings(), _profile()).seller_subscription_fee
    assert fee == 500.0


def test_launch_discount_halves_standard_fee() -> None:
    fee = build_effective_seller_finance_settings(_settings(seller_launch_discount_percent=50), _profile()).seller_subscription_fee
    assert fee == 250.0


def test_launch_discount_never_applies_to_negotiated_fee() -> None:
    profile = _profile(seller_subscription_fee_override=3000.0)
    fee = build_effective_seller_finance_settings(_settings(seller_launch_discount_percent=50), profile).seller_subscription_fee
    assert fee == 3000.0


def test_trial_grants_configured_days_once() -> None:
    profile = _profile()
    apply_seller_onboarding_and_trial(profile, allow_subscription_trial=True, trial_days=30)
    assert profile.subscription_paid_until is not None
    assert profile.subscription_paid_until - datetime.now(UTC) > timedelta(days=29)

    first_end = profile.subscription_paid_until
    apply_seller_onboarding_and_trial(profile, allow_subscription_trial=True, trial_days=30)
    assert profile.subscription_paid_until == first_end  # pas de second essai


def test_no_trial_when_disabled() -> None:
    profile = _profile()
    apply_seller_onboarding_and_trial(profile, allow_subscription_trial=True, trial_days=0)
    assert profile.subscription_paid_until is None
    assert profile.onboarding_fee_paid_at is not None


@pytest.mark.parametrize(("field", "value"), [("seller_trial_days", 400), ("seller_launch_discount_percent", 120)])
def test_admin_settings_are_bounded(field, value) -> None:
    base = dict(
        commission_rate=0, service_fee=0, default_delivery_fee=0, seller_subscription_fee_shop=500,
        seller_subscription_fee_restaurant=1000, seller_subscription_fee_premium=5000, ad_boost_price=0,
        ad_boost_duration_days=7, urban_delivery_fee=0, peripheral_delivery_fee=0, ad_boost_price_24h=0,
        ad_boost_price_7d=0,
    )
    with pytest.raises(ValueError):
        FinanceSettingsUpdateRequest(**base, **{field: value})
