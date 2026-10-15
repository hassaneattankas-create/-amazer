"""Limite par compte : 10 essais de connexion par quart d'heure, quelle que soit l'adresse IP."""

import pytest

from app.core import rate_limit
from app.core.exceptions import TooManyRequestsError


def test_identity_limit_blocks_after_limit_even_from_many_ips(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit, "_get_redis_client", lambda: None)
    rate_limit._RATE_BUCKETS.clear()
    for _ in range(3):
        rate_limit.enforce_identity_rate_limit(key="t_login", identity="Awa@Test.ne ", limit=3, window_seconds=900)
    with pytest.raises(TooManyRequestsError, match="Trop de tentatives"):
        rate_limit.enforce_identity_rate_limit(key="t_login", identity="awa@test.ne", limit=3, window_seconds=900)
    # un autre compte n'est pas touche
    rate_limit.enforce_identity_rate_limit(key="t_login", identity="other@test.ne", limit=3, window_seconds=900)


def test_empty_identity_is_ignored(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit, "_get_redis_client", lambda: None)
    for _ in range(10):
        rate_limit.enforce_identity_rate_limit(key="t_empty", identity="", limit=1, window_seconds=900)
