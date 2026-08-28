"""Gateway authentication tests."""

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.config import Settings
from app.security import require_backend


def _request(secret: str, client_ip: str = "74.220.48.10") -> Request:
    return Request(
        {
            "type": "http",
            "headers": [(b"x-amazer-gateway-secret", secret.encode())],
            "client": (client_ip, 12345),
        }
    )


def test_backend_request_is_accepted() -> None:
    settings = Settings(gateway_shared_secret="a" * 32, allowed_backend_ips="74.220.48.10")

    require_backend(_request("a" * 32), settings)


def test_backend_request_rejects_wrong_secret() -> None:
    settings = Settings(gateway_shared_secret="a" * 32)

    with pytest.raises(HTTPException, match="Unauthorized"):
        require_backend(_request("b" * 32), settings)
