import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest


def test_register_schema_accepts_strong_password() -> None:
    payload = RegisterRequest(
        email="user@example.com",
        full_name="Jane Doe",
        whatsapp_phone="+22790000000",
        password="StrongP@ssw0rd!",
    )

    assert payload.email == "user@example.com"


def test_register_schema_rejects_weak_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="user@example.com",
            full_name="Jane Doe",
            whatsapp_phone="+22790000000",
            password="weakpass",
        )


def test_register_schema_forbids_extra_fields() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="user@example.com",
            full_name="Jane Doe",
            whatsapp_phone="+22790000000",
            password="StrongP@ssw0rd!",
            role="admin",
        )
