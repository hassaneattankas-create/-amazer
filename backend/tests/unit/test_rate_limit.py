from starlette.requests import Request

from app.core.exceptions import TooManyRequestsError
from app.core import rate_limit as rate_limit_module


def _request(ip: str = "127.0.0.1") -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "headers": [],
        "client": (ip, 1234),
    }
    return Request(scope)


def test_rate_limit_blocks_after_threshold(monkeypatch) -> None:
    rate_limit_module._RATE_BUCKETS.clear()
    monkeypatch.setattr(rate_limit_module, "_get_redis_client", lambda: None)
    request = _request()

    rate_limit_module.enforce_rate_limit(request, key="auth_login", limit=2, window_seconds=60)
    rate_limit_module.enforce_rate_limit(request, key="auth_login", limit=2, window_seconds=60)

    try:
        rate_limit_module.enforce_rate_limit(request, key="auth_login", limit=2, window_seconds=60)
        assert False, "Expected rate limit exception"
    except TooManyRequestsError as exc:
        assert exc.status_code == 429
