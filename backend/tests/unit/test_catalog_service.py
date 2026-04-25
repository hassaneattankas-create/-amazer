from types import SimpleNamespace
from unittest.mock import Mock

from app.services.catalog_service import CatalogService


def _vendor(*, vendor_id: str, activity_type: str, storefront_tier: str = "basic") -> SimpleNamespace:
    profile = SimpleNamespace(
        business_name=f"{vendor_id}-business",
        activity_type=activity_type,
        storefront_tier=storefront_tier,
        city="Niamey",
        phone=None,
        address="Plateau",
        description="Demo",
        logo_url=None,
        cover_image_url=None,
        is_verified=True,
        service_offerings=[],
        room_types=[],
    )
    return SimpleNamespace(
        id=vendor_id,
        name=vendor_id,
        slug=vendor_id,
        is_active=True,
        seller_profile=profile,
    )


def test_list_vendor_storefronts_keeps_empty_shop_visible_without_products() -> None:
    db = Mock()
    service = CatalogService(db)
    service.catalog = Mock()
    empty_shop = _vendor(vendor_id="shop-empty", activity_type="shop")
    service.catalog.list_vendor_storefronts.return_value = [empty_shop]
    service.catalog.list_vendor_prices.return_value = []

    result = service.list_vendor_storefronts(limit=20, offset=0, activity_type="shop")

    assert len(result.items) == 1
    assert result.items[0].id == "shop-empty"
    assert result.items[0].product_count == 0


def test_list_vendor_storefronts_keeps_premium_store_with_services_even_without_products() -> None:
    db = Mock()
    service = CatalogService(db)
    service.catalog = Mock()
    premium = _vendor(vendor_id="premium-store", activity_type="enterprise", storefront_tier="premium")
    premium.seller_profile.service_offerings = [
        {"title": "Conseil VIP", "description": "Service premium", "display_mode": "consult_only"}
    ]
    service.catalog.list_vendor_storefronts.return_value = [premium]
    service.catalog.list_vendor_prices.return_value = []

    result = service.list_vendor_storefronts(limit=20, offset=0, storefront_tier="premium")

    assert len(result.items) == 1
    assert result.items[0].id == "premium-store"
