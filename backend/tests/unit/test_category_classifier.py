"""Classement automatique des produits sans categorie."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services import category_classifier as clf


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Samsung A17 dernière génération 128g & 256g neuf en carton", "electronique"),
        ("Iphone 13simple 128g batterie 100%", "electronique"),
        ("Riz Basmati Radhika 1121 5kg", "alimentation"),
        ("Thé Vert Buffle 200g", "alimentation"),
        ("Petits Pois Jean Nicolas Très Fins", "alimentation"),
        ("Betteraves Rouges en Dés Jean Nicolas", "alimentation"),
        ("All People Choice Œuf & Banane", "alimentation"),
        ("Savon Protex Pharmapur Herbal", "hygiene"),
        ("Oro Double Action Insecticide", "hygiene"),
        ("Papier Aluminium Naima 30m", "maison"),
        ("Serviettes de Table Okay 100", "maison"),
        ("Ordinateur portable HP 15 pouces", "technologie"),
        ("Sac à main en cuir", "accessoires"),
        ("Taf", None),
    ],
)
def test_guess_category_slug(name, expected) -> None:
    assert clf.guess_category_slug(name) == expected


def test_backfill_only_fills_missing_categories() -> None:
    riz = SimpleNamespace(name="Riz parfumé 5 kg", description=None, category_id=None)
    inconnu = SimpleNamespace(name="Taf", description=None, category_id=None)
    db = Mock()
    db.execute.return_value.all.return_value = [("alimentation", "cat-alim")]
    db.scalars.return_value.all.return_value = [riz, inconnu]
    assert clf.assign_missing_categories(db) == 1
    assert riz.category_id == "cat-alim" and inconnu.category_id is None
    db.commit.assert_called_once()
