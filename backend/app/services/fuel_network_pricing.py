"""Prix de l'abonnement d'une marque de carburant selon son nombre de stations.

Modele des grands acteurs (Yext, Shopify POS, logiciels de franchise) : l'abonnement de la marque
inclut quelques stations, chaque station en plus coute un petit montant qui baisse avec le volume.
Il n'y a pas de plafond. Un prix negocie (override admin) remplace tout le calcul.
Tous les montants se reglent dans Admin > Tarifs.
"""

from __future__ import annotations

from dataclasses import dataclass

# Paliers par defaut (reglables dans Admin > Tarifs : fuel_tier1_until, fuel_tier2_until).
TIER1_UNTIL = 10  # de la (inclus + 1)e a la 10e station
TIER2_UNTIL = 30  # de la 11e a la 30e ; au-dela : palier 3


@dataclass(frozen=True)
class FuelNetworkPrice:
    stations: int
    included: int
    base: float
    extra: float
    total: float
    flat: float
    capped: bool
    next_station_price: float


def _num(settings: object, name: str, default: float) -> float:
    value = getattr(settings, name, None)
    return max(0.0, float(default if value is None else value))


def fuel_base_fee(settings: object, premium_fee: float) -> float:
    """Abonnement de base d'une marque : le prix « stations » s'il est regle, sinon le prix Premium."""
    configured = _num(settings, "fuel_base_subscription", 0)
    return configured if configured > 0 else float(premium_fee)


def tier_limits(settings: object) -> tuple[int, int]:
    """Fin des paliers 1 et 2, toujours dans l'ordre (inclus <= palier 1 < palier 2)."""
    included = int(_num(settings, "fuel_included_outlets", 3))
    tier1 = max(int(_num(settings, "fuel_tier1_until", TIER1_UNTIL)), included)
    tier2 = max(int(_num(settings, "fuel_tier2_until", TIER2_UNTIL)), tier1 + 1)
    return tier1, tier2


def price_for(settings: object, base: float, stations: int) -> FuelNetworkPrice:
    """Prix mensuel d'une marque pour `stations` points de vente actifs."""
    included = int(_num(settings, "fuel_included_outlets", 3))
    tiers = (_num(settings, "fuel_tier1_price", 2000), _num(settings, "fuel_tier2_price", 1500), _num(settings, "fuel_tier3_price", 1000))
    tier1_until, tier2_until = tier_limits(settings)

    def station_price(rank: int) -> float:
        """Prix de la station numero `rank` (1 = premiere)."""
        if rank <= included:
            return 0.0
        if rank <= tier1_until:
            return tiers[0]
        if rank <= tier2_until:
            return tiers[1]
        return tiers[2]

    extra = sum(station_price(rank) for rank in range(1, max(0, stations) + 1))
    total = base + extra
    return FuelNetworkPrice(
        stations=max(0, stations),
        included=included,
        base=round(base, 2),
        extra=round(extra, 2),
        total=round(total, 2),
        flat=0.0,
        capped=False,
        next_station_price=round(station_price(stations + 1), 2),
    )


def active_outlet_count(profile: object) -> int:
    """Nombre de stations actives de la marque (0 hors session, ex. tests)."""
    from sqlalchemy import func, select
    from sqlalchemy.orm import object_session

    from app.models.fuel_outlet import FuelOutlet

    session = object_session(profile) if hasattr(profile, "_sa_instance_state") else None
    if session is None or not getattr(profile, "vendor_id", None):
        return 0
    return int(
        session.scalar(
            select(func.count(FuelOutlet.id)).where(FuelOutlet.vendor_id == profile.vendor_id, FuelOutlet.is_active.is_(True))
        )
        or 0
    )
