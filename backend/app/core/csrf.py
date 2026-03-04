from __future__ import annotations

import secrets

from fastapi import Request

from app.core.exceptions import UnauthorizedError


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def enforce_csrf(request: Request) -> None:
    # Only enforce for cookie-authenticated requests. Bearer token requests skip CSRF.
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return
    access_cookie = request.cookies.get("access_token")
    if not access_cookie:
        return
    cookie_token = request.cookies.get("csrf_token")
    header_token = request.headers.get("x-csrf-token")
    if not cookie_token or not header_token or cookie_token != header_token:
        raise UnauthorizedError("CSRF token missing or invalid")
