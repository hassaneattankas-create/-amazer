"""Place sur la carte les établissements des listes officielles (affiches de garde, communiqués de stations).

Les affiches ne donnent pas de coordonnées : on retrouve la pharmacie par son nom dans OpenStreetMap (position exacte),
sinon on la place au centre de son quartier (position approximative, signalée comme telle aux clients).
Seulement pour Niamey, la seule ville dont l'extrait OSM est embarqué (app/data/niamey_places.py).
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from functools import lru_cache

from app.data.niamey_places import PHARMACIES, PLACES

_STOP = r"pharmacie|phamacie|pharamcie|pharmacy|station|service|ph|de|du|la|le|les|des|l|d|au|aux|a|en|face|cote|pres"
# Noms courants des affiches absents d'OSM sous cette forme.
_ALIASES = {"ryad": "Riyad", "tchangarey": "Tchangarey II", "yantala": "Yantala Haut", "kouara kano": "Koira Kano"}


@dataclass(frozen=True)
class Spot:
    latitude: float
    longitude: float
    approximate: bool
    area: str | None


def _key(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\b(\d+)\s*(?:e|eme|er|ere)\b", r"\1", text)  # 6e, 6ème -> 6
    text = re.sub(r"\bii\b", "2", re.sub(r"\bi\b", "1", text))  # Château I -> chateau 1
    text = re.sub(rf"\b(?:{_STOP})\b", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _compact(value: str) -> str:
    return value.replace(" ", "")


@lru_cache(maxsize=1)
def _pharmacies() -> list[tuple[str, tuple[float, float]]]:
    return [(_compact(_key(name)), at) for name, at in PHARMACIES.items() if _key(name)]


@lru_cache(maxsize=1)
def _places() -> list[tuple[str, str, tuple[float, float]]]:
    rows = [(_key(name), name, at) for name, at in PLACES.items() if len(_key(name)) >= 4]
    rows += [(alias, name, PLACES[name]) for alias, name in _ALIASES.items() if name in PLACES]
    return sorted(rows, key=lambda r: -len(r[0]))  # « Koira Kano » avant « Koira »


def _pharmacy(name: str) -> tuple[float, float] | None:
    wanted = _compact(_key(name))
    if not wanted:
        return None
    exact = [at for k, at in _pharmacies() if k == wanted]
    if exact:
        return exact[0]
    if len(wanted) < 5:  # noms courts : seulement l'égalité exacte
        return None
    scored = sorted(
        ((SequenceMatcher(None, wanted, k).ratio(), at) for k, at in _pharmacies() if k[:1] == wanted[:1]),
        key=lambda s: -s[0],
    )
    if scored and scored[0][0] >= 0.84 and (len(scored) == 1 or scored[1][0] < scored[0][0]):
        return scored[0][1]
    return None


def _place(*texts: str | None) -> tuple[str, tuple[float, float]] | None:
    for text in texts:
        spaced = f" {_key(text)} "
        if not spaced.strip():
            continue
        for key, name, at in _places():
            if f" {key} " in spaced:
                return name, at
    return None


def _nudge(at: tuple[float, float], seed: str) -> tuple[float, float]:
    """Décale un peu (≤ 250 m) les établissements placés au centre d'un même quartier, pour qu'ils ne se cachent pas."""
    digest = hashlib.sha1(seed.encode()).digest()
    angle = digest[0] / 255 * 2 * math.pi
    radius = 0.0008 + digest[1] / 255 * 0.0015
    return round(at[0] + radius * math.sin(angle), 5), round(at[1] + radius * math.cos(angle), 5)


def locate(kind: str, city: str | None, name: str, district: str | None = None, location: str | None = None) -> Spot | None:
    """Position d'une ligne de liste officielle ; None si on ne sait pas où la placer."""
    if _key(city or "Niamey") != "niamey":
        return None
    if kind == "pharmacy_duty":
        found = _pharmacy(name)
        if found:
            return Spot(found[0], found[1], approximate=False, area=None)
    hit = _place(district, location, name)
    if not hit:
        return None
    area, at = hit
    lat, lng = _nudge(at, f"{kind}:{name}")
    return Spot(lat, lng, approximate=True, area=area)
