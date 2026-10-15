"""PIN finance admin : le jeton de verification est signe, lie a l'admin et expire (plus de cookie « 1 » falsifiable)."""

from types import SimpleNamespace

import pytest

from app.core.exceptions import UnauthorizedError
from app.routes import admin_finance as route


def _request(cookie: str | None) -> SimpleNamespace:
    return SimpleNamespace(cookies={"finance_pin_verified": cookie} if cookie is not None else {})


def test_signed_token_is_accepted_for_its_admin_only() -> None:
    token = route.issue_finance_pin_token("admin-1", now=1_000_000)
    assert route.finance_pin_token_valid(token, "admin-1", now=1_000_000)
    assert not route.finance_pin_token_valid(token, "admin-2", now=1_000_000)


def test_token_expires_after_thirty_minutes() -> None:
    token = route.issue_finance_pin_token("admin-1", now=1_000_000)
    assert route.finance_pin_token_valid(token, "admin-1", now=1_000_000 + 30 * 60)
    assert not route.finance_pin_token_valid(token, "admin-1", now=1_000_000 + 30 * 60 + 1)


@pytest.mark.parametrize("forged", ["1", "", "admin-1.9999999999.deadbeef", "admin-1.9999999999." + "0" * 48, "a.b.c"])
def test_forged_or_legacy_cookies_are_refused(forged: str) -> None:
    assert not route.finance_pin_token_valid(forged, "admin-1")
    with pytest.raises(UnauthorizedError):
        route._require_finance_pin(_request(forged), SimpleNamespace(id="admin-1"))


def test_changing_the_expiry_breaks_the_signature() -> None:
    user, _exp, sig = route.issue_finance_pin_token("admin-1", now=1_000_000).rsplit(".", 2)
    assert not route.finance_pin_token_valid(f"{user}.9999999999.{sig}", "admin-1", now=1_000_000)


def test_valid_cookie_passes_the_guard() -> None:
    token = route.issue_finance_pin_token("admin-1")
    route._require_finance_pin(_request(token), SimpleNamespace(id="admin-1"))
    with pytest.raises(UnauthorizedError):
        route._require_finance_pin(_request(None))
