import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest


def test_register_schema_accepts_strong_password() -> None:
    payload = RegisterRequest(
        identifier="user@example.com",
        full_name="Jane Doe",
        password="StrongP@ssw0rd!",
    )

    assert payload.identifier == "user@example.com"


def test_register_schema_rejects_weak_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            identifier="user@example.com",
            full_name="Jane Doe",
            password="weakpass",
        )


def test_register_schema_forbids_extra_fields() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            identifier="+22790000000",
            full_name="Jane Doe",
            password="StrongP@ssw0rd!",
            role="admin",
        )
