"""Prix des compagnies de transport : abonnement par lignes et/ou commission par billet.

L'admin choisit pour chaque compagnie (Admin > Tarifs, fiche vendeur) :
- « subscription » : abonnement mensuel = base (lignes comprises) + prix par ligne en plus ;
- « commission » : pas d'abonnement, AMAZER touche un pourcentage de chaque billet confirme ;
- « both » : abonnement et commission.
Le client paie le billet a la compagnie : la commission est donc due par la compagnie a AMAZER,
calculee par mois de voyage et encaissee par l'admin (page Transport).
"""

from __future__ import annotations

from dataclasses import dataclass

BILLING_MODES = ("subscription", "commission", "both")
# Billets qui comptent pour la commission : confirmes par la compagnie ou deja embarques.
COMMISSIONABLE_STATUSES = ("confirmed", "checked_in")


@dataclass(frozen=True)
class TransportPrice:
    lines: int
    included: int
    base: float
    extra: float
    total: float


def _num(settings: object, name: str, default: float) -> float:
    value = getattr(settings, name, None)
    return max(0.0, float(default if value is None else value))


def is_transport(profile: object | None) -> bool:
    if profile is None:
        return False
    return bool(getattr(profile, "offers_transport", False)) or (getattr(profile, "activity_type", "") or "") == "transport"


def billing_mode(profile: object | None) -> str:
    mode = (getattr(profile, "billing_mode", None) or "subscription").strip().lower()
    return mode if mode in BILLING_MODES else "subscription"


def line_count(profile: object | None) -> int:
    """Lignes (trajets) publiees par la compagnie."""
    rows = getattr(profile, "room_types", None) or []
    return sum(1 for row in rows if isinstance(row, dict) and row.get("id"))


def price_for(settings: object, lines: int) -> TransportPrice:
    base = _num(settings, "transport_base_subscription", 15000)
    included = int(_num(settings, "transport_included_lines", 5))
    per_line = _num(settings, "transport_extra_line_price", 1000)
    extra = max(0, lines - included) * per_line
    return TransportPrice(lines=max(0, lines), included=included, base=round(base, 2), extra=round(extra, 2), total=round(base + extra, 2))


def subscription_fee(settings: object, profile: object) -> float:
    """Abonnement mensuel de la compagnie (0 en mode « commission seule »)."""
    if billing_mode(profile) == "commission":
        return 0.0
    return price_for(settings, line_count(profile)).total


def commission_percent(settings: object, profile: object) -> float:
    """Pourcentage de chaque billet du a AMAZER (0 en mode « abonnement seul »)."""
    if billing_mode(profile) == "subscription":
        return 0.0
    own = getattr(profile, "ticket_commission_percent", None)
    if own is not None:
        return max(0.0, min(90.0, float(own)))
    return min(90.0, _num(settings, "transport_ticket_commission_percent", 8))
