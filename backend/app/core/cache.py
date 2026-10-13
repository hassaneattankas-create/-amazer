from __future__ import annotations

import json
import time
from typing import Any

try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency in local dev
    Redis = None  # type: ignore[assignment]

from app.config import get_settings

_CACHE_CLIENT: Redis | None = None

# Cache memoire de secours quand Redis n'est pas configure. Fiable ici car l'API
# tourne en un seul processus (`--workers 1`) : l'invalidation reste coherente.
_MEMORY_CACHE: dict[str, tuple[float, str]] = {}
_MEMORY_CACHE_MAX_ENTRIES = 512


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
        entry = _MEMORY_CACHE.get(key)
        if entry is None:
            return None
        expires_at, raw = entry
        if expires_at <= time.monotonic():
            _MEMORY_CACHE.pop(key, None)
            return None
    else:
        raw = client.get(key)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def cache_set_json(key: str, value: dict[str, Any] | list[Any], ttl_seconds: int) -> None:
    client = _get_cache_client()
    payload = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    if client is None:
        if key not in _MEMORY_CACHE and len(_MEMORY_CACHE) >= _MEMORY_CACHE_MAX_ENTRIES:
            # Memoire bornee : on retire l'entree la plus ancienne.
            _MEMORY_CACHE.pop(next(iter(_MEMORY_CACHE)), None)
        _MEMORY_CACHE[key] = (time.monotonic() + ttl_seconds, payload)
        return
    client.setex(key, ttl_seconds, payload)


def cache_delete_prefix(prefix: str) -> int:
    client = _get_cache_client()
    if client is None:
        stale = [key for key in _MEMORY_CACHE if key.startswith(prefix)]
        for key in stale:
            _MEMORY_CACHE.pop(key, None)
        return len(stale)
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
