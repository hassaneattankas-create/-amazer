"""Produits numériques : le vendeur le demande, AMAZER le valide.

Un produit numérique (e-book, formation, code…) n'a pas de frais de livraison et n'est pas livré par
un livreur AMAZER. Pour qu'un objet physique (ex. un téléphone) ne soit pas déclaré « numérique » par
erreur ou pour éviter la livraison, la case du vendeur n'est qu'une demande (`is_digital`) : le produit
reste traité comme physique, avec livraison, tant que l'admin n'a pas validé (`digital_verified`).
"""

from __future__ import annotations

from typing import Any, Mapping

REQUESTED = "is_digital"
VERIFIED = "digital_verified"


def is_requested(specs: Mapping[str, Any] | None) -> bool:
    return bool((specs or {}).get(REQUESTED))


def is_digital(specs: Mapping[str, Any] | None) -> bool:
    """Numérique pour de vrai : demandé par le vendeur ET validé par AMAZER."""
    specs = specs or {}
    return bool(specs.get(REQUESTED)) and bool(specs.get(VERIFIED))


def is_pending(specs: Mapping[str, Any] | None) -> bool:
    return is_requested(specs) and not bool((specs or {}).get(VERIFIED))


def apply_seller_choice(specs: dict[str, Any], wants_digital: bool) -> None:
    """Le vendeur coche ou décoche la case : décocher retire aussi la validation."""
    if wants_digital:
        specs[REQUESTED] = True
    else:
        specs.pop(REQUESTED, None)
        specs.pop(VERIFIED, None)
