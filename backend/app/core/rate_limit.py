from __future__ import annotations

from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from fastapi import Request

from app.core.exceptions import UnauthorizedError

_RATE_BUCKETS: dict[str, deque[datetime]] = defaultdict(deque)


def enforce_rate_limit(request: Request, *, key: str, limit: int, window_seconds: int) -> None:
    client_ip = request.client.host if request.client else "unknown"
    bucket_key = f"{key}:{client_ip}"
    now = datetime.now(UTC)
    threshold = now - timedelta(seconds=window_seconds)
    bucket = _RATE_BUCKETS[bucket_key]
    while bucket and bucket[0] < threshold:
        bucket.popleft()
    if len(bucket) >= limit:
        raise UnauthorizedError("Too many attempts, please try again later")
    bucket.append(now)
