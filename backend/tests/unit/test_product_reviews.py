"""Avis produit verifies : achat recu obligatoire, un avis par client, lien photo web uniquement."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from pydantic import ValidationError

from app.core.exceptions import ConflictError, ForbiddenError
from app.routes import reviews as route
from app.schemas.review import ReviewCreateRequest


@pytest.fixture(autouse=True)
def _no_csrf(monkeypatch):
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)


def _db(received, existing):
    db = Mock()
    db.get.return_value = SimpleNamespace(id="p-1")
    db.scalar.side_effect = [received, existing]
    return db


def test_review_requires_a_received_order() -> None:
    with pytest.raises(ForbiddenError):
        route.create_review(ReviewCreateRequest(rating=5, comment="Très bien"), "p-1", SimpleNamespace(), _db(None, None), SimpleNamespace(id="u-1"))


def test_one_review_per_customer() -> None:
    with pytest.raises(ConflictError):
        route.create_review(ReviewCreateRequest(rating=4, comment="Bien"), "p-1", SimpleNamespace(), _db("o-1", "r-1"), SimpleNamespace(id="u-1"))


def test_photo_link_must_be_a_web_address() -> None:
    with pytest.raises(ValidationError):
        ReviewCreateRequest(rating=5, comment="Super", photo_url="javascript:alert(1)")
    assert ReviewCreateRequest(rating=5, comment="Super", photo_url="").photo_url is None
