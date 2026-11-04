"""Palier d'une marque de stations : il sert uniquement au prix de l'ajout de stations.

Le palier suit le nombre de stations actives (seuils reglables dans Admin > Tarifs) :
- 1 « Essentiel » : jusqu'a la fin du palier 1 (10 par defaut) ;
- 2 « Reseau » : jusqu'a la fin du palier 2 (30) ;
- 3 « Entreprise » : au-dela, ou tarif negocie.

Tous les outils de gestion, export compris, sont ouverts a toutes les marques.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.fuel_outlet import FuelOutlet
from app.models.seller_profile import SellerProfile
from app.services.fuel_network_pricing import tier_limits

PLAN_NAMES = {1: "Essentiel", 2: "Réseau", 3: "Entreprise"}


@dataclass(frozen=True)
class FuelPlan:
    level: int
    name: str
    stations: int
    network_from: int
    enterprise_from: int

    @property
    def network_tools(self) -> bool:
        """Historique (compatibilite API) : les outils reseau sont ouverts a tous les paliers."""
        return True

    @property
    def export(self) -> bool:
        """Historique (compatibilite API) : l'export est ouvert a tous les paliers."""
        return True


def fuel_plan(db: Session, profile: SellerProfile, settings: object) -> FuelPlan:
    stations = int(
        db.scalar(select(func.count()).select_from(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id, FuelOutlet.is_active.is_(True))) or 0
    )
    tier1, tier2 = tier_limits(settings)
    if profile.seller_subscription_fee_override is not None or stations > tier2:
        level = 3
    elif stations > tier1:
        level = 2
    else:
        level = 1
    return FuelPlan(level=level, name=PLAN_NAMES[level], stations=stations, network_from=tier1 + 1, enterprise_from=tier2 + 1)
