from __future__ import annotations

import json
from typing import Any

try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency in local dev
    Redis = None  # type: ignore[assignment]

from app.config import get_settings

_CACHE_CLIENT: Redis | None = None


def _get_cache_client() -> Redis | None:
    if Redis is None:
        return None
    global _CACHE_CLIENT
    if _CACHE_CLIENT is not None:
        return _CACHE_CLIENT
    redis_url = get_settings().redis_url
    if not redis_url:
        return None
    try:
        _CACHE_CLIENT = Redis.from_url(redis_url, decode_responses=True)
        _CACHE_CLIENT.ping()
        return _CACHE_CLIENT
    except Exception:
        _CACHE_CLIENT = None
        return None


def cache_get_json(key: str) -> dict[str, Any] | list[Any] | None:
    client = _get_cache_client()
    if client is None:
        return None
    raw = client.get(key)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def cache_set_json(key: str, value: dict[str, Any] | list[Any], ttl_seconds: int) -> None:
    client = _get_cache_client()
    if client is None:
        return
    payload = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    client.setex(key, ttl_seconds, payload)


def cache_delete_prefix(prefix: str) -> int:
    client = _get_cache_client()
    if client is None:
        return 0
    deleted = 0
    try:
        for key in client.scan_iter(match=f"{prefix}*"):
            deleted += int(client.delete(key) or 0)
    except Exception:
        return 0
    return deleted


def cache_delete_prefixes(*prefixes: str) -> None:
    seen: set[str] = set()
    for prefix in prefixes:
        normalized = prefix.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        cache_delete_prefix(normalized)


def build_cache_key(prefix: str, **params: Any) -> str:
    parts = [prefix]
    for key in sorted(params):
        parts.append(f"{key}={params[key]}")
    return "|".join(parts)
