"""Validation du paiement avant activation boost."""

import pytest
from pydantic import ValidationError

from app.schemas.seller import SellerInventoryUpdateRequest


def test_boost_requires_payment_reference_and_mode() -> None:
    SellerInventoryUpdateRequest(
        boost_duration_hours=24,
        boost_payment_reference="abcd",
        boost_payment_mode="nita",
    )
    SellerInventoryUpdateRequest(
        boost_duration_hours=168,
        boost_payment_reference="ref-9876-z",
        boost_payment_mode="amana",
    )


@pytest.mark.parametrize(
    ("ref", "mode", "expected_substring"),
    [
        ("ab", "nita", "paiement boost obligatoire"),
        ("", "amana", "paiement boost obligatoire"),
        ("validref", None, "Mode de paiement boost obligatoire"),
    ],
)
def test_boost_without_proof_raises(
    ref: str | None, mode: str | None, expected_substring: str
) -> None:
    with pytest.raises(ValidationError) as exc:
        SellerInventoryUpdateRequest(
            boost_duration_hours=24,
            boost_payment_reference=ref,
            boost_payment_mode=mode,  # type: ignore[arg-type]
        )
    assert expected_substring in str(exc.value)


def test_non_boost_update_does_not_require_payment_fields() -> None:
    SellerInventoryUpdateRequest(amount=100.0, stock_quantity=5)
    SellerInventoryUpdateRequest(is_active=True)
