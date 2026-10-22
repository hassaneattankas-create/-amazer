"""Abonnement expire : le vendeur ne publie plus, mais traite encore les commandes deja payees."""

from types import SimpleNamespace

import pytest

from app.core import deps
from app.core.exceptions import ForbiddenError


def test_expired_seller_keeps_access_to_existing_orders(monkeypatch) -> None:
    user = SimpleNamespace(id="u1")

    def expired(_user, _db):
        raise ForbiddenError("Abonnement vendeur requis ou expiré")

    monkeypatch.setattr(deps, "get_seller_user", expired)
    with pytest.raises(ForbiddenError):
        deps.get_seller_user(user, None)
    assert deps.get_seller_user_any(user, None) is user
