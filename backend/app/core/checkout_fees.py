"""Frais plateforme alignés sur le panier (commission % + frais de service fixe)."""

from __future__ import annotations

from app.models.global_settings import GlobalSettings
from app.models.seller_profile import SellerProfile
from app.services.seller_finance_service import build_effective_seller_finance_settings


def platform_commission_and_service_fee(
    settings: GlobalSettings,
    profile: SellerProfile | None,
    items_subtotal: float,
    has_order_lines: bool,
) -> tuple[float, float]:
    if not has_order_lines or items_subtotal <= 0:
        return 0.0, 0.0
    eff = build_effective_seller_finance_settings(settings, profile)
    commission = float(items_subtotal) * float(eff.commission_rate)
    service = float(eff.service_fee)
    return commission, service


def marketplace_fees(db, settings: GlobalSettings, vendor_subtotals: dict[str, float]) -> tuple[float, float]:
    """Commande de produits : la commission de chaque boutique suit son tarif (personnalise ou global).

    Frais de service : ceux de la boutique pour une commande a une seule boutique, sinon le tarif global.
    """
    from sqlalchemy import select

    subtotals = {vendor_id: float(amount) for vendor_id, amount in vendor_subtotals.items() if float(amount) > 0}
    if not subtotals:
        return 0.0, 0.0
    profiles = {
        profile.vendor_id: profile
        for profile in db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_(list(subtotals)))).all()
    }
    commission = 0.0
    for vendor_id, amount in subtotals.items():
        commission += amount * float(build_effective_seller_finance_settings(settings, profiles.get(vendor_id)).commission_rate)
    if len(subtotals) == 1:
        service = float(build_effective_seller_finance_settings(settings, profiles.get(next(iter(subtotals)))).service_fee)
    else:
        service = float(build_effective_seller_finance_settings(settings, None).service_fee)
    return commission, service
