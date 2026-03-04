from starlette.requests import Request

from app.core.csrf import enforce_csrf
from app.core.exceptions import UnauthorizedError


def _request(*, cookie_header: str = "", auth_header: str = "") -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if cookie_header:
        headers.append((b"cookie", cookie_header.encode("utf-8")))
    if auth_header:
        headers.append((b"authorization", auth_header.encode("utf-8")))
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/orders/checkout",
        "headers": headers,
        "client": ("127.0.0.1", 1234),
    }
    return Request(scope)


def test_csrf_skips_for_bearer_auth() -> None:
    request = _request(auth_header="Bearer test-token")
    enforce_csrf(request)


def test_csrf_allows_matching_cookie_and_header() -> None:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/orders/checkout",
        "headers": [
            (b"cookie", b"access_token=a; csrf_token=abc123"),
            (b"x-csrf-token", b"abc123"),
        ],
        "client": ("127.0.0.1", 1234),
    }
    request = Request(scope)
    enforce_csrf(request)


def test_csrf_rejects_missing_or_invalid_token() -> None:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/orders/checkout",
        "headers": [
            (b"cookie", b"access_token=a; csrf_token=abc123"),
            (b"x-csrf-token", b"wrong"),
        ],
        "client": ("127.0.0.1", 1234),
    }
    request = Request(scope)
    try:
        enforce_csrf(request)
        assert False, "Expected UnauthorizedError"
    except UnauthorizedError as exc:
        assert exc.status_code == 401
