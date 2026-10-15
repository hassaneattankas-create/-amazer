"""Affiliation : code, attribution, commission, gains."""

from types import SimpleNamespace
from unittest.mock import Mock

from app.routes import affiliates as route
from app.services import affiliate_service as svc


def test_code_is_short_and_easy_to_dictate() -> None:
    code = svc._new_code()
    assert len(code) == 6 and not set(code) & set("01OI")


def test_buyer_cannot_earn_commission_on_own_purchase() -> None:
    db = Mock()
    db.scalar.return_value = SimpleNamespace(user_id="u-1", code="ABC234")
    assert svc.resolve_affiliate(db, "abc234", "u-1") is None
    assert svc.resolve_affiliate(db, "abc234", "u-2") == "u-1"
    assert svc.resolve_affiliate(db, None, "u-2") is None


def test_unknown_code_gives_no_commission() -> None:
    db = Mock()
    db.scalar.return_value = None
    assert svc.resolve_affiliate(db, "ZZZZZZ", "u-2") is None


def test_commission_is_a_percentage_of_items() -> None:
    assert svc.affiliate_commission(20000, 3) == 600.0
    assert svc.affiliate_commission(0, 3) == 0.0


def test_new_account_gets_a_unique_code() -> None:
    db = Mock()
    db.get.return_value = None
    db.scalar.side_effect = ["deja-pris", None]  # premier code deja utilise, second libre
    account = svc.ensure_affiliate_account(db, "u-9")
    assert account.user_id == "u-9" and len(account.code) == 6
    db.add.assert_called_once()


def test_earnings_split_delivered_pending() -> None:
    db = Mock()
    db.execute.return_value.all.return_value = [("recu", 600.0), ("preparation", 300.0), ("CLAIMED", 100.0)]
    result = route.compute_affiliate_earnings(db, "u-1")
    assert (result.earned, result.pending, result.orders_delivered, result.orders_pending) == (700.0, 300.0, 2, 1)
