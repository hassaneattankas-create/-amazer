"""Frais de livraison par quartier : le tarif configure par l'admin est celui facture."""

from types import SimpleNamespace
from unittest.mock import Mock

from app.routes import orders as orders_route


def _db(zone_fee, settings=None) -> Mock:
    db = Mock()
    db.scalar.side_effect = [zone_fee, settings]
    return db


def test_known_district_uses_its_fee() -> None:
    assert orders_route._resolve_checkout_delivery_fee(_db(2500.0), "standard", "Plateau") == 2500.0


def test_unknown_district_falls_back_to_default_fee() -> None:
    settings = SimpleNamespace(default_delivery_fee=1500.0, urban_delivery_fee=2000.0)
    assert orders_route._resolve_checkout_delivery_fee(_db(None, settings), "standard", "Inconnu") == 1500.0


def test_express_keeps_express_fee_even_with_district() -> None:
    db = Mock()
    db.scalar.return_value = SimpleNamespace(default_delivery_fee=1500.0, urban_delivery_fee=3000.0)
    assert orders_route._resolve_checkout_delivery_fee(db, "express_niamey", "Plateau") == 3000.0


def test_no_district_keeps_previous_behaviour() -> None:
    db = Mock()
    db.scalar.return_value = SimpleNamespace(default_delivery_fee=1500.0, urban_delivery_fee=3000.0)
    assert orders_route._resolve_checkout_delivery_fee(db, "standard") == 1500.0


def test_marketplace_fees_follow_each_shop_negotiated_rate(monkeypatch) -> None:
    """Commission par boutique : le tarif personnalise d'une boutique s'applique a ses articles."""
    from types import SimpleNamespace

    from app.core import checkout_fees

    profiles = [SimpleNamespace(vendor_id="v-a", rate=0.02, fee=100.0), SimpleNamespace(vendor_id="v-b", rate=None, fee=None)]
    db = SimpleNamespace(scalars=lambda _q: SimpleNamespace(all=lambda: profiles))

    def effective(_settings, profile):
        if profile is None or profile.rate is None:
            return SimpleNamespace(commission_rate=0.05, service_fee=200.0)
        return SimpleNamespace(commission_rate=profile.rate, service_fee=profile.fee)

    monkeypatch.setattr(checkout_fees, "build_effective_seller_finance_settings", effective)
    # Deux boutiques : 2 % sur A, 5 % (global) sur B, frais de service globaux.
    assert checkout_fees.marketplace_fees(db, SimpleNamespace(), {"v-a": 10000, "v-b": 10000}) == (700.0, 200.0)
    # Une seule boutique : ses propres frais de service.
    assert checkout_fees.marketplace_fees(db, SimpleNamespace(), {"v-a": 10000}) == (200.0, 100.0)
