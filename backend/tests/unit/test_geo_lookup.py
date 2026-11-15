"""Placement sur la carte des lignes des listes officielles (pharmacies de garde, stations approvisionnées)."""

from app.data.official_lists_2026_11 import LISTS as NOVEMBER
from app.data.niamey_places import PHARMACIES
from app.services.geo_lookup import locate


def test_known_pharmacy_gets_its_exact_osm_position():
    spot = locate("pharmacy_duty", "Niamey", "Gobi", None, "Koira Kano, en face du CEG 14")
    assert spot is not None and not spot.approximate
    assert (spot.latitude, spot.longitude) == PHARMACIES["Pharmacie Gobi"]


def test_spelling_variants_still_match():
    # « Château I » (affiche) = « Pharmacie chateau 1 » (OSM) ; « Goroual » = « Pharmacie le Gorouol ».
    assert locate("pharmacy_duty", "Niamey", "Château I").approximate is False
    assert locate("pharmacy_duty", "Niamey", "Goroual").approximate is False


def test_unknown_pharmacy_falls_back_to_its_quartier():
    spot = locate("pharmacy_duty", "Niamey", "Pharmacie Inconnue", None, "Talladjé, près du marché")
    assert spot is not None and spot.approximate and spot.area == "Talladjé"


def test_station_is_placed_in_its_quartier_and_other_cities_are_skipped():
    spot = locate("fuel_supply", "Niamey", "Banifandou 2")
    assert spot is not None and spot.approximate and spot.area == "Banifandou 2"
    assert locate("pharmacy_duty", "Zinder", "Gobi") is None
    assert locate("pharmacy_duty", "Niamey", "Nulle Part", None, "Sans indication") is None


def test_most_of_this_week_is_on_the_map():
    duty = NOVEMBER[0]
    placed = [locate(duty["kind"], duty["city"], e[1], e[2], e[3]) for e in duty["entries"]]
    assert sum(1 for s in placed if s) >= 35
    assert sum(1 for s in placed if s and not s.approximate) >= 20
