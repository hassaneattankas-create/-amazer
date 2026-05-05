"""Logique boost catalogue (fenêtre boost_until, expiration, affichage public)."""

from __future__ import annotations

from datetime import UTC, datetime

from app.models.product import Product

BOOST_SPEC_KEYS = (
    "boost_until",
    "boost_payment_reference",
    "boost_payment_mode",
    "boost_requested_at",
    "boost_price_tariff",
)


def parse_boost_until_datetime(product: Product) -> datetime | None:
    specs = getattr(product, "specs", None) or {}
    raw = specs.get("boost_until")
    if not isinstance(raw, str):
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def product_boost_active_for_display(product: Product, *, now: datetime | None = None) -> bool:
    """Produits sans boost_until (seed / ancien) : on respecte uniquement is_boosted."""
    now = now or datetime.now(UTC)
    if not bool(getattr(product, "is_boosted", False)):
        return False
    until = parse_boost_until_datetime(product)
    if until is None:
        return True
    return until > now


def clear_expired_boost_from_product(product: Product, *, now: datetime | None = None) -> bool:
    """Désactive un boost daté expiré et nettoie les clés associées. Retourne True si le produit a changé."""
    now = now or datetime.now(UTC)
    until = parse_boost_until_datetime(product)
    if until is None or until > now:
        return False
    product.is_boosted = False
    specs = dict(product.specs or {})
    for key in BOOST_SPEC_KEYS:
        specs.pop(key, None)
    product.specs = specs
    return True
