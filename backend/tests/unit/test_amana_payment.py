import pytest

from app.core.exceptions import ValidationDomainError
from app.routes.orders import _amana_phone


def test_amana_phone_normalizes_niger_formats() -> None:
    assert _amana_phone("+227 92 65 75 09") == "0022792657509"
    assert _amana_phone("92657509") == "0022792657509"


def test_amana_phone_rejects_invalid_number() -> None:
    with pytest.raises(ValidationDomainError):
        _amana_phone("123")
