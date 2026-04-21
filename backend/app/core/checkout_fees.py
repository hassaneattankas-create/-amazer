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
