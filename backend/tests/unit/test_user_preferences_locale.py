"""Preferences internationales : pays, region, devise, langue."""

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.routes import auth as route
from app.schemas.auth import RegisterRequest, UserPreferencesUpdateRequest


def _row(**kw):
    base = {"preferred_currency": "XOF", "country_code": "NE", "region": None, "preferred_language": "fr"}
    return SimpleNamespace(**{**base, **kw})


def test_partial_update_keeps_other_values() -> None:
    row = _row()
    route._apply_preferences(row, {"preferred_currency": "EUR", "region": "  Paris  "})
    assert (row.preferred_currency, row.country_code, row.region, row.preferred_language) == ("EUR", "NE", "Paris", "fr")


def test_response_falls_back_on_unknown_currency() -> None:
    response = route._preferences_response(_row(preferred_currency="ZZZ", country_code=None))
    assert response.preferred_currency == "XOF" and response.country_code == "NE"


@pytest.mark.parametrize(
    "payload",
    [{"preferred_currency": "BTC"}, {"country_code": "niger"}, {"preferred_language": "de"}],
)
def test_invalid_values_are_rejected(payload) -> None:
    with pytest.raises(ValidationError):
        UserPreferencesUpdateRequest(**payload)


def test_register_accepts_country_and_region() -> None:
    req = RegisterRequest(
        identifier="client@example.test", full_name="Awa", password="Motdepasse1!", country_code="SN", region="Dakar"
    )
    assert req.country_code == "SN" and req.region == "Dakar"
