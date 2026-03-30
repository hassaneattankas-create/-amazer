from types import SimpleNamespace

from app.services.seller_finance_service import build_effective_seller_finance_settings


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        commission_rate=0.05,
        service_fee=200,
        seller_subscription_fee=5000,
        seller_subscription_fee_shop=5000,
        seller_subscription_fee_restaurant=7000,
        seller_subscription_fee_premium=12000,
        launch_mode_zero_commission=False,
    )


def test_effective_seller_finance_uses_shop_subscription_by_default() -> None:
    finance = build_effective_seller_finance_settings(_settings(), None)

    assert finance.seller_subscription_fee == 5000


def test_effective_seller_finance_uses_restaurant_subscription_for_restaurants() -> None:
    profile = SimpleNamespace(
        activity_type="restaurant",
        storefront_tier="basic",
        commission_rate_override=None,
        service_fee_override=None,
        seller_subscription_fee_override=None,
    )

    finance = build_effective_seller_finance_settings(_settings(), profile)

    assert finance.seller_subscription_fee == 7000


def test_effective_seller_finance_uses_premium_subscription_for_premium_profiles() -> None:
    profile = SimpleNamespace(
        activity_type="shop",
        storefront_tier="premium",
        commission_rate_override=None,
        service_fee_override=None,
        seller_subscription_fee_override=None,
    )

    finance = build_effective_seller_finance_settings(_settings(), profile)

    assert finance.seller_subscription_fee == 12000


def test_effective_seller_finance_keeps_profile_override() -> None:
    profile = SimpleNamespace(
        activity_type="restaurant",
        storefront_tier="basic",
        commission_rate_override=None,
        service_fee_override=None,
        seller_subscription_fee_override=2500,
    )

    finance = build_effective_seller_finance_settings(_settings(), profile)

    assert finance.seller_subscription_fee == 2500
    assert finance.subscription_overridden is True
