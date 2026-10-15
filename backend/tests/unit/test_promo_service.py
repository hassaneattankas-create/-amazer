"""Promotions vendeur : duree choisie, prix promo < prix normal, retrait, retour automatique au prix normal."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.core.exceptions import ValidationDomainError
from app.services import promo_service as svc

NOW = datetime(2026, 10, 15, 12, tzinfo=UTC)


def offer(amount: float = 10000, specs: dict | None = None) -> SimpleNamespace:
    return SimpleNamespace(amount=amount, product=SimpleNamespace(specs=dict(specs or {})))


def test_start_promo_for_chosen_days_keeps_normal_price() -> None:
    price = offer()
    svc.apply_price_and_promo(price, amount=None, promo_amount=8000, promo_days=3, clear_promo=False, now=NOW)
    specs = price.product.specs
    assert price.amount == 8000 and specs["original_price"] == 10000 and specs["promo_price"] == 8000
    assert specs["promo_until"] == (NOW + timedelta(days=3)).isoformat()
    assert svc.normal_price(price) == 10000


def test_promo_must_be_lower_than_normal_price() -> None:
    with pytest.raises(ValidationDomainError, match="inférieur au prix normal"):
        svc.apply_price_and_promo(offer(), amount=None, promo_amount=10000, promo_days=7, clear_promo=False, now=NOW)


def test_clear_promo_restores_normal_price() -> None:
    price = offer()
    svc.apply_price_and_promo(price, amount=None, promo_amount=8000, promo_days=7, clear_promo=False, now=NOW)
    svc.apply_price_and_promo(price, amount=None, promo_amount=None, promo_days=None, clear_promo=True, now=NOW)
    assert price.amount == 10000 and price.product.specs == {}


def test_changing_normal_price_during_promo_keeps_promo() -> None:
    price = offer()
    svc.apply_price_and_promo(price, amount=None, promo_amount=8000, promo_days=7, clear_promo=False, now=NOW)
    svc.apply_price_and_promo(price, amount=12000, promo_amount=None, promo_days=None, clear_promo=False, now=NOW)
    assert price.amount == 8000 and price.product.specs["original_price"] == 12000
    # nouveau prix normal sous la promo : la promo n'a plus de sens, elle s'arrete
    svc.apply_price_and_promo(price, amount=7000, promo_amount=None, promo_days=None, clear_promo=False, now=NOW)
    assert price.amount == 7000 and "promo_price" not in price.product.specs


def test_resaving_same_promo_keeps_its_end_date() -> None:
    price = offer()
    svc.apply_price_and_promo(price, amount=None, promo_amount=8000, promo_days=3, clear_promo=False, now=NOW)
    end = price.product.specs["promo_until"]
    later = NOW + timedelta(days=1)
    svc.apply_price_and_promo(price, amount=10000, promo_amount=8000, promo_days=None, clear_promo=False, now=later)
    assert price.product.specs["promo_until"] == end


def test_expired_promo_returns_to_normal_price() -> None:
    price = offer()
    svc.apply_price_and_promo(price, amount=None, promo_amount=8000, promo_days=1, clear_promo=False, now=NOW)
    assert svc.promo_active(price.product.specs, NOW + timedelta(hours=23))
    assert not svc.promo_active(price.product.specs, NOW + timedelta(days=1, seconds=1))
    assert svc.end_promo(price) is True
    assert price.amount == 10000 and price.product.specs == {}
    assert svc.end_promo(price) is False


def test_old_promo_without_original_price_is_cleaned_safely() -> None:
    # ancienne promo (avant correctif) : prix reste au prix promo, aucune trace du prix d'origine
    price = offer(8000, {"promo_price": 8000, "promo_until": (NOW - timedelta(days=2)).isoformat()})
    assert svc.end_promo(price) is True
    assert price.amount == 8000 and price.product.specs == {}


def test_plain_price_change_without_promo() -> None:
    price = offer()
    svc.apply_price_and_promo(price, amount=11000, promo_amount=None, promo_days=None, clear_promo=False, now=NOW)
    assert price.amount == 11000 and price.product.specs == {}
