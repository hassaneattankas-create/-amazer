from __future__ import annotations

from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from fastapi import Request
try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency in local dev
    Redis = None  # type: ignore[assignment]

from app.config import get_settings
from app.core.exceptions import UnauthorizedError

_RATE_BUCKETS: dict[str, deque[datetime]] = defaultdict(deque)
_REDIS_CLIENT: Redis | None = None


def _get_redis_client() -> Redis | None:
    if Redis is None:
        return None
    global _REDIS_CLIENT
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    redis_url = get_settings().redis_url
    if not redis_url:
        return None
    try:
        _REDIS_CLIENT = Redis.from_url(redis_url, decode_responses=True)
        _REDIS_CLIENT.ping()
        return _REDIS_CLIENT
    except Exception:
        _REDIS_CLIENT = None
        return None


def enforce_rate_limit(request: Request, *, key: str, limit: int, window_seconds: int) -> None:
    client_ip = request.client.host if request.client else "unknown"
    bucket_key = f"{key}:{client_ip}"
    redis_client = _get_redis_client()
    if redis_client is not None:
        count = redis_client.incr(bucket_key)
        if count == 1:
            redis_client.expire(bucket_key, window_seconds)
        if count > limit:
            raise UnauthorizedError("Too many attempts, please try again later")
        return

    now = datetime.now(UTC)
    threshold = now - timedelta(seconds=window_seconds)
    bucket = _RATE_BUCKETS[bucket_key]
    while bucket and bucket[0] < threshold:
        bucket.popleft()
    if len(bucket) >= limit:
        raise UnauthorizedError("Too many attempts, please try again later")
    bucket.append(now)
