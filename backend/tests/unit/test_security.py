import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_password_and_verify() -> None:
    plain = "StrongP@ssw0rd!"
    hashed = hash_password(plain)

    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPass123!", hashed) is False


def test_access_token_generation_and_decode() -> None:
    token = create_access_token("user-123")
    payload = decode_token(token)

    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"
    assert "jti" in payload


def test_refresh_token_generation_and_decode() -> None:
    token, jti, expires_at = create_refresh_token("user-123")
    payload = decode_token(token)

    assert payload["sub"] == "user-123"
    assert payload["type"] == "refresh"
    assert payload["jti"] == jti
    assert expires_at is not None


def test_decode_invalid_token_raises_value_error() -> None:
    with pytest.raises(ValueError):
        decode_token("not-a-jwt")
