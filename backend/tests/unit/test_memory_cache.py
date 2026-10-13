"""Cache memoire de secours (sans Redis) : expiration, invalidation, taille bornee."""

import pytest

from app.core import cache


@pytest.fixture(autouse=True)
def _no_redis(monkeypatch):
    monkeypatch.setattr(cache, "_get_cache_client", lambda: None)
    cache._MEMORY_CACHE.clear()
    yield
    cache._MEMORY_CACHE.clear()


def test_set_then_get_returns_value() -> None:
    cache.cache_set_json("catalog:a", {"items": [1]}, ttl_seconds=60)
    assert cache.cache_get_json("catalog:a") == {"items": [1]}


def test_expired_entry_is_ignored(monkeypatch) -> None:
    now = [1000.0]
    monkeypatch.setattr(cache.time, "monotonic", lambda: now[0])
    cache.cache_set_json("catalog:a", {"x": 1}, ttl_seconds=60)
    now[0] += 61
    assert cache.cache_get_json("catalog:a") is None


def test_prefix_invalidation_after_seller_change() -> None:
    cache.cache_set_json("catalog:storefronts|limit=12", {"x": 1}, ttl_seconds=60)
    cache.cache_set_json("content:home", {"y": 2}, ttl_seconds=60)
    cache.cache_set_json("other:z", {"z": 3}, ttl_seconds=60)
    cache.cache_delete_prefixes("catalog:", "content:")
    assert cache.cache_get_json("catalog:storefronts|limit=12") is None
    assert cache.cache_get_json("content:home") is None
    assert cache.cache_get_json("other:z") == {"z": 3}


def test_memory_is_bounded(monkeypatch) -> None:
    monkeypatch.setattr(cache, "_MEMORY_CACHE_MAX_ENTRIES", 3)
    for index in range(5):
        cache.cache_set_json(f"k{index}", {"i": index}, ttl_seconds=60)
    assert len(cache._MEMORY_CACHE) == 3
    assert cache.cache_get_json("k0") is None
    assert cache.cache_get_json("k4") == {"i": 4}
