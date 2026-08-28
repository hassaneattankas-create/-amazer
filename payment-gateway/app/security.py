"""Authentication primitives for trusted backend-to-gateway requests."""

import hmac

from fastapi import HTTPException, Request, status

from app.config import Settings


def require_backend(request: Request, settings: Settings) -> None:
    """Reject callers without the gateway shared secret or an allowed IP."""
    provided = request.headers.get("X-Amazer-Gateway-Secret", "")
    if not hmac.compare_digest(provided, settings.gateway_shared_secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized gateway request")

    allowed_ips = settings.backend_ips()
    client_ip = request.client.host if request.client else None
    if allowed_ips and client_ip not in allowed_ips:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Backend IP is not allowed")
