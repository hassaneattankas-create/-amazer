from __future__ import annotations

import hashlib
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from ipaddress import ip_address

from fastapi import Request
try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency in local dev
    Redis = None  # type: ignore[assignment]

from app.config import get_settings
from app.core.exceptions import TooManyRequestsError

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


def client_ip(request: Request) -> str:
    """IP du client reel.

    Chaine en production : client -> Cloudflare -> proxy Render (IP privee) -> app.
    - CF-Connecting-IP est ecrase par Cloudflare : non falsifiable par le client.
    - X-Forwarded-For conserve ce que le client envoie en tete (verifie en production
      le 2026-10-12) : seule sa derniere entree, ajoutee par l'infrastructure, est fiable.
    Ces en-tetes ne sont lus que si le pair est une adresse privee (le proxy), jamais
    sur une connexion directe.
    """
    peer = request.client.host if request.client else ""
    if _is_private_address(peer):
        cloudflare_ip = request.headers.get("cf-connecting-ip", "").strip()
        if cloudflare_ip:
            return cloudflare_ip
        forwarded = request.headers.get("x-forwarded-for", "")
        last = forwarded.split(",")[-1].strip() if forwarded else ""
        if last:
            return last
    return peer or "unknown"


def _is_private_address(value: str) -> bool:
    try:
        address = ip_address(value)
    except ValueError:
        return False
    return address.is_private or address.is_loopback


def enforce_rate_limit(request: Request, *, key: str, limit: int, window_seconds: int) -> None:
    _hit(f"{key}:{client_ip(request)}", limit, window_seconds)


def enforce_identity_rate_limit(*, key: str, identity: str, limit: int, window_seconds: int) -> None:
    """Limite par compte vise (et non par IP) : bloque le forcage d'un mot de passe depuis de nombreuses IP."""
    normalized = (identity or "").strip().lower()
    if not normalized:
        return
    digest = hashlib.sha256(normalized.encode()).hexdigest()[:32]
    _hit(f"{key}:id:{digest}", limit, window_seconds)


def _hit(bucket_key: str, limit: int, window_seconds: int) -> None:
    redis_client = _get_redis_client()
    if redis_client is not None:
        count = redis_client.incr(bucket_key)
        if count == 1:
            redis_client.expire(bucket_key, window_seconds)
        if count > limit:
            raise TooManyRequestsError("Trop de tentatives. Réessayez dans quelques minutes.")
        return

    now = datetime.now(UTC)
    threshold = now - timedelta(seconds=window_seconds)
    bucket = _RATE_BUCKETS[bucket_key]
    while bucket and bucket[0] < threshold:
        bucket.popleft()
    if len(bucket) >= limit:
        raise TooManyRequestsError("Trop de tentatives. Réessayez dans quelques minutes.")
    bucket.append(now)
