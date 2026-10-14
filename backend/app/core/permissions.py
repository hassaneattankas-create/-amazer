from __future__ import annotations

from typing import Protocol

from app.config import get_settings

ROLE_USER = "user"
ROLE_ADMIN = "admin"
ROLE_COURIER = "courier"
ROLES = (ROLE_USER, ROLE_ADMIN, ROLE_COURIER)


class _UserLike(Protocol):
    email: str


def is_principal_admin(user: _UserLike | None) -> bool:
    """Compte admin principal (ADMIN_EMAIL) : cree au demarrage, jamais retrogradable."""
    if user is None or not user.email:
        return False
    return user.email.strip().lower() == get_settings().admin_email.strip().lower()


def is_courier(user: _UserLike | None) -> bool:
    """Livreur AMAZER : voit et prend en charge les commandes a livrer."""
    return user is not None and getattr(user, "role", ROLE_USER) == ROLE_COURIER


def is_admin(user: _UserLike | None) -> bool:
    """Seule source de verite des droits admin, verifiee cote serveur."""
    if user is None:
        return False
    return getattr(user, "role", ROLE_USER) == ROLE_ADMIN or is_principal_admin(user)
