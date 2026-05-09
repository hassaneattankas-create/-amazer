from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

from app.models.seller_profile import SellerProfile
from app.models.vendor import Vendor
from app.routes import seller as seller_route
from app.services import seller_profile_service


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
    assert status.subscription_active is False


def test_build_subscription_status_requires_first_payment_validation(monkeypatch) -> None:
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

    assert status.subscription_active is False


def test_resolve_seller_plan_bucket_distinguishes_formulas() -> None:
    assert seller_profile_service.resolve_seller_plan_bucket("shop", "basic") == "shop"
    assert seller_profile_service.resolve_seller_plan_bucket("restaurant", "basic") == "restaurant"
    assert seller_profile_service.resolve_seller_plan_bucket("enterprise", "premium") == "premium"
    assert seller_profile_service.resolve_seller_plan_bucket("hotel", "basic") == "premium"


def test_create_or_update_seller_profile_resets_subscription_after_formula_change() -> None:
    db = Mock()
    vendor = Vendor(id="vendor-1", name="Boutique Test", slug="boutique-test", is_active=True)
    profile = SellerProfile(
        user_id="user-1",
        vendor_id="vendor-1",
        business_name="Boutique Test",
        city="Niamey",
        activity_type="shop",
        storefront_tier="basic",
        onboarding_fee_paid_at=datetime.now(UTC) - timedelta(days=20),
        subscription_paid_until=datetime.now(UTC) + timedelta(days=20),
        subscription_last_payment_reference="PAY-123",
    )
    db.get.return_value = vendor

    updated = seller_profile_service.create_or_update_seller_profile(
        db,
        user=SimpleNamespace(id="user-1", full_name="User Test"),
        payload={
            "business_name": "Restaurant Test",
            "city": "Niamey",
            "activity_type": "restaurant",
            "storefront_tier": "basic",
        },
        existing_profile=profile,
    )

    assert updated.subscription_paid_until is None
    assert updated.subscription_last_payment_reference is None
    assert vendor.is_active is False
