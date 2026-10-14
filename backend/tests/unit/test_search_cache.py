"""La recherche produits est mise en cache brievement (accueil rapide)."""

from unittest.mock import Mock

from app.core.cache import cache_delete_prefixes
from app.routes import products as route
from app.schemas.product import ProductSearchResult


def test_second_identical_search_is_served_from_cache(monkeypatch) -> None:
    cache_delete_prefixes("catalog:")
    calls: list[int] = []
    empty = ProductSearchResult.model_validate({"items": [], "meta": {"limit": 24, "offset": 0, "returned": 0}})

    class FakeService:
        def __init__(self, _db):
            pass

        def search_products(self, **_kwargs):
            calls.append(1)
            return empty

    monkeypatch.setattr(route, "ProductService", FakeService)
    args = dict(query=None, barcode=None, brand=None, category_id=None, category_slug="riz-test", spec_key=None,
                spec_value=None, min_price=None, max_price=None, in_stock_only=True, sort="newest", limit=24, offset=0)
    first = route.search_products(Mock(), **args)
    second = route.search_products(Mock(), **args)
    assert first == second and len(calls) == 1
    cache_delete_prefixes("catalog:")
