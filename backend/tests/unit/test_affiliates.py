"""Affiliation : code, parrainage, part d'abonnement, bonus nouveau client, gains."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.routes import affiliates as route
from app.services import affiliate_service as svc


@pytest.fixture(autouse=True)
def _terms(monkeypatch):
    monkeypatch.setattr(svc, "affiliate_terms", lambda _db: (20.0, 12, 250.0))


def test_code_is_short_and_easy_to_dictate() -> None:
    code = svc._new_code()
    assert len(code) == 6 and not set(code) & set("01OI")


def test_nobody_can_refer_themselves() -> None:
    db = Mock()
    db.scalar.return_value = SimpleNamespace(user_id="u-1", code="ABC234")
    assert svc.resolve_affiliate(db, "abc234", "u-1") is None
    assert svc.resolve_affiliate(db, "abc234", "u-2") == "u-1"


def test_new_customer_gets_fixed_bonus_only_on_first_order() -> None:
    db = Mock()
    db.get.return_value = None  # pas de parrainage a l'inscription
    db.scalar.side_effect = [SimpleNamespace(user_id="aff", code="ABC234"), None]  # code valide, aucune commande avant
    assert svc.customer_bonus_for_order(db, "client", "ABC234") == ("aff", 250.0)
    db.scalar.side_effect = [SimpleNamespace(user_id="aff", code="ABC234"), "ancienne-commande"]
    assert svc.customer_bonus_for_order(db, "client", "ABC234") == (None, 0.0)


def test_referral_from_signup_counts_without_link_at_checkout() -> None:
    db = Mock()
    db.get.return_value = SimpleNamespace(affiliate_user_id="aff")
    db.scalar.return_value = None  # aucune commande precedente
    assert svc.customer_bonus_for_order(db, "client", None) == ("aff", 250.0)


def test_subscription_share_within_period_once_per_payment() -> None:
    db = Mock()
    db.get.return_value = SimpleNamespace(affiliate_user_id="aff", created_at=datetime.now(UTC) - timedelta(days=10))
    db.scalar.return_value = None  # paiement pas encore credite
    earning = svc.credit_subscription_share(db, "vendeur", 5000, "seller-sub:p1")
    assert earning.affiliate_user_id == "aff" and earning.amount == 1000.0
    db.scalar.return_value = "deja-credite"
    assert svc.credit_subscription_share(db, "vendeur", 5000, "seller-sub:p1") is None


def test_no_share_after_the_period_or_without_referral() -> None:
    db = Mock()
    db.get.return_value = SimpleNamespace(affiliate_user_id="aff", created_at=datetime.now(UTC) - timedelta(days=400))
    assert svc.credit_subscription_share(db, "vendeur", 5000, "seller-sub:p2") is None
    db.get.return_value = None
    assert svc.credit_subscription_share(db, "vendeur", 5000, "seller-sub:p3") is None


def test_earnings_combine_subscription_shares_and_delivered_bonuses() -> None:
    db = Mock()
    db.execute.return_value.all.return_value = [("recu", 250.0), ("preparation", 250.0)]
    db.scalar.return_value = 2000.0  # parts d'abonnements
    result = route.compute_affiliate_earnings(db, "aff")
    assert (result.earned, result.pending, result.from_sellers, result.from_customers) == (2250.0, 250.0, 2000.0, 250.0)
