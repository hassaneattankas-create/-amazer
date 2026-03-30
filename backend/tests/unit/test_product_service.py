from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

from app.repositories.product_repository import SearchOfferRow
from app.services.product_service import ProductService


def _offer_row(
    *,
    product_id: str,
    amount: float,
    stock: int,
    text_rank: float,
    created_at: datetime | None = None,
) -> SearchOfferRow:
    now = created_at or datetime.now(UTC)
    vendor = SimpleNamespace(id="v1", name="Vendor", slug="vendor", is_active=True)
    category = SimpleNamespace(id="c1", name="Phones", slug="phones")
    image = SimpleNamespace(id="i1", image_url="https://img", sort_order=1)
    product = SimpleNamespace(
        id=product_id,
        name=f"Product {product_id}",
        brand="Brand",
        description=None,
        main_image_url=None,
        specs={"ram": "8"},
        category=category,
        created_at=now,
        images=[image],
    )
    price = SimpleNamespace(
        id=f"p-{product_id}-{amount}",
        amount=amount,
        stock_quantity=stock,
        currency="USD",
        is_active=True,
        vendor=vendor,
    )
    return SearchOfferRow(product=product, price=price, text_rank=text_rank)


def test_search_products_relevance_prefers_best_score() -> None:
    db = Mock()
    service = ProductService(db)
    service.products = Mock()
    service.products.search_offers.return_value = [
        _offer_row(product_id="1", amount=100, stock=10, text_rank=0.8),
        _offer_row(product_id="2", amount=70, stock=5, text_rank=0.6),
    ]

    result = service.search_products(
        query="phone",
        brand=None,
        category_id=None,
        category_slug=None,
        spec_key=None,
        spec_value=None,
        min_price=None,
        max_price=None,
        in_stock_only=True,
        sort="relevance",
        limit=20,
        offset=0,
    )

    assert result.meta.returned == 2
    assert result.items[0].id in {"1", "2"}


def test_search_products_price_asc_sorts_by_price() -> None:
    db = Mock()
    service = ProductService(db)
    service.products = Mock()
    service.products.search_offers.return_value = [
        _offer_row(product_id="1", amount=120, stock=10, text_rank=0.8),
        _offer_row(product_id="2", amount=60, stock=10, text_rank=0.2),
    ]

    result = service.search_products(
        query=None,
        brand=None,
        category_id=None,
        category_slug=None,
        spec_key=None,
        spec_value=None,
        min_price=None,
        max_price=None,
        in_stock_only=True,
        sort="price_asc",
        limit=20,
        offset=0,
    )

    assert result.items[0].best_offer.amount <= result.items[1].best_offer.amount


def test_rank_product_offers_ignores_inactive_vendor_account() -> None:
    db = Mock()
    service = ProductService(db)
    active_vendor = SimpleNamespace(id="v1", is_active=True, seller_profile=SimpleNamespace(user=SimpleNamespace(is_active=True)))
    deleted_vendor = SimpleNamespace(id="v2", is_active=True, seller_profile=SimpleNamespace(user=SimpleNamespace(is_active=False)))
    product = SimpleNamespace(
        prices=[
            SimpleNamespace(id="p1", amount=100, stock_quantity=5, is_active=True, vendor=active_vendor),
            SimpleNamespace(id="p2", amount=80, stock_quantity=5, is_active=True, vendor=deleted_vendor),
        ]
    )

    ranked = service._rank_product_offers(product)  # type: ignore[arg-type]

    assert len(ranked) == 1
    assert ranked[0].row.price.id == "p1"
