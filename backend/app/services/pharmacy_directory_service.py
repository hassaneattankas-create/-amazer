"""Annuaire permanent des pharmacies du Niger (positions et numéros gardés, de garde ou non).

- Au démarrage : les pharmacies de Niamey connues d'OpenStreetMap (position exacte), celles de tout le Niger
  (Zinder, Maradi, Tahoua…), puis toutes les lignes des affiches de garde déjà publiées (nom officiel,
  quartier, numéro).
- À chaque affiche publiée : ses pharmacies sont ajoutées ou complétées (le numéro le plus récent est gardé).
- L'admin peut corriger une position : elle n'est plus jamais remplacée automatiquement.
"""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.data.niamey_places import PHARMACIES
from app.data.niger_pharmacies import PHARMACIES as NIGER_PHARMACIES
from app.models.official_list import OfficialList, OfficialListEntry
from app.models.pharmacy_directory import PharmacyListing
from app.services import geo_lookup
from app.services import local_services as svc


def name_key(value: str | None) -> str:
    """Même clé que la liste de garde : « Pharmacie Ar Rahma » = « AR RAHMA »."""
    text = svc.normalize_city(value).replace("-", " ").replace("'", " ").replace("’", " ")
    text = re.sub(r"^(pharmacie|phamacie|pharamcie)\s+(de\s+la\s+|de\s+l\s+|du\s+|des\s+|de\s+|le\s+|la\s+)?", "", text)
    return " ".join(text.split())


def _display(osm_name: str) -> str:
    """Nom affiché sans « Pharmacie » (comme sur les affiches) : « Pharmacie du Temple » → « Temple »."""
    text = re.sub(r"^(pharmacie|phamacie|pharamcie)\s+(de\s+la\s+|de\s+l'|du\s+|des\s+|de\s+|le\s+|la\s+)?", "", osm_name.strip(), flags=re.I)
    text = text.strip() or osm_name.strip()
    return text[:1].upper() + text[1:]


# Deux fiches à moins de ~50 m l'une de l'autre : la même pharmacie.
SAME_SPOT = 0.0005


def _rows(db: Session, city: str | None) -> list[PharmacyListing]:
    query = select(PharmacyListing)
    if city:
        query = query.where(PharmacyListing.city_key == svc.normalize_city(city))
    return list(db.scalars(query).all())


def find(db: Session, city: str, name: str) -> PharmacyListing | None:
    key = name_key(name)
    if not key:
        return None
    return db.scalar(select(PharmacyListing).where(PharmacyListing.city_key == svc.normalize_city(city), PharmacyListing.name_key == key))


def _seed_osm(db: Session, city: str = "Niamey") -> int:
    """Pharmacies OpenStreetMap de Niamey (une seule fois)."""
    ck = svc.normalize_city(city)
    if db.scalar(select(PharmacyListing.id).where(PharmacyListing.city_key == ck, PharmacyListing.position_source == "osm").limit(1)):
        return 0
    known = {row.name_key for row in _rows(db, city)}
    added = 0
    for osm_name, (lat, lng) in sorted(PHARMACIES.items()):
        key = name_key(osm_name)
        if not key or key in known:
            continue
        known.add(key)
        db.add(PharmacyListing(city=city, city_key=ck, name=_display(osm_name)[:140], name_key=key[:140], latitude=lat, longitude=lng, position_source="osm"))
        added += 1
    db.flush()
    return added


def _seed_niger(db: Session) -> int:
    """Pharmacies OpenStreetMap de tout le Niger : ajoute celles qui manquent (idempotent).

    Une fiche déjà présente (même identifiant OSM, même endroit, ou même nom dans la ville) n'est jamais
    dupliquée : elle reçoit seulement son identifiant OSM, pour que la vérification suivante soit immédiate.
    """
    rows = _rows(db, None)
    by_osm = {row.osm_id for row in rows if row.osm_id}
    by_name = {(row.city_key, row.name_key): row for row in rows}
    added = 0
    for osm_id, osm_name, city, lat, lng in NIGER_PHARMACIES:
        if osm_id in by_osm:
            continue
        ck = svc.normalize_city(city)
        key = name_key(osm_name)
        same = next(
            (
                row
                for row in rows
                if row.latitude is not None
                and row.longitude is not None
                and abs(row.latitude - lat) < SAME_SPOT
                and abs(row.longitude - lng) < SAME_SPOT
            ),
            None,
        ) or (by_name.get((ck, key)) if key else None)
        if same is not None:
            if not same.osm_id:
                same.osm_id = osm_id
            by_osm.add(osm_id)
            continue
        # Sans nom dans OpenStreetMap : « Pharmacie », avec une clé propre (jamais confondue avec une affiche).
        row = PharmacyListing(
            city=city[:80],
            city_key=ck[:80],
            name=(_display(osm_name) if key else "Pharmacie")[:140],
            name_key=(key or f"osm {osm_id}")[:140],
            latitude=lat,
            longitude=lng,
            position_source="osm",
            osm_id=osm_id,
        )
        db.add(row)
        rows.append(row)
        by_name[(row.city_key, row.name_key)] = row
        by_osm.add(osm_id)
        added += 1
    db.flush()
    return added


def upsert_entries(db: Session, city: str, entries: list) -> int:
    """Ajoute ou complète les pharmacies d'une affiche (dicts ou OfficialListEntry). Renvoie le nombre d'ajouts."""
    ck = svc.normalize_city(city)
    added = 0
    for entry in entries:
        get = (lambda k: entry.get(k)) if isinstance(entry, dict) else (lambda k: getattr(entry, k, None))
        name = (get("name") or "").strip()
        key = name_key(name)
        if not key:
            continue
        row = find(db, city, name)
        spot = None
        if row is None:
            spot = geo_lookup.locate("pharmacy_duty", city, name, get("district"), get("location"))
            if spot and not spot.approximate:
                # Même pharmacie qu'une fiche OpenStreetMap écrite autrement (« Goroual » = « le Gorouol »).
                row = db.scalar(
                    select(PharmacyListing).where(
                        PharmacyListing.city_key == ck,
                        PharmacyListing.latitude == spot.latitude,
                        PharmacyListing.longitude == spot.longitude,
                    )
                )
                if row is not None and row.position_source == "osm":
                    row.name, row.name_key = name[:140], key[:140]
        if row is None:
            row = PharmacyListing(city=city, city_key=ck, name=name[:140], name_key=key[:140])
            if spot:
                row.latitude, row.longitude = spot.latitude, spot.longitude
                row.position_source = "quartier" if spot.approximate else "osm"
                row.area = spot.area
            db.add(row)
            added += 1
        # Le quartier, le repère et le numéro de la dernière affiche.
        if get("district"):
            row.district = str(get("district"))[:120]
        if get("location"):
            row.location = str(get("location"))[:240]
        if get("phone"):
            row.phone = str(get("phone"))[:40]
        db.flush()
    return added


def ensure_seeded(db: Session) -> int:
    """OpenStreetMap (Niamey puis tout le Niger) et toutes les affiches de garde déjà publiées (idempotent)."""
    added = _seed_osm(db)
    added += _seed_niger(db)
    lists = db.scalars(select(OfficialList).where(OfficialList.kind == "pharmacy_duty").order_by(OfficialList.starts_at)).all()
    for row in lists:
        entries = db.scalars(select(OfficialListEntry).where(OfficialListEntry.list_id == row.id).order_by(OfficialListEntry.position)).all()
        added += upsert_entries(db, row.city, list(entries))
    db.commit()
    return added


def directory(db: Session, city: str | None) -> list[PharmacyListing]:
    """Pharmacies de la ville (ou de tout le Niger sans ville), par ordre alphabétique."""
    return sorted(_rows(db, city), key=lambda r: (r.name.lower(), r.city_key))


def position_of(db: Session, city: str, name: str) -> tuple[float, float, bool, str | None] | None:
    """Position connue d'une pharmacie de l'annuaire : (lat, lng, approximative, quartier)."""
    row = find(db, city, name)
    if row is None or row.latitude is None or row.longitude is None:
        return None
    return row.latitude, row.longitude, row.position_source == "quartier", row.area


def set_position(row: PharmacyListing, latitude: float, longitude: float) -> None:
    """Position corrigée par l'admin : définitive."""
    row.latitude, row.longitude = round(latitude, 6), round(longitude, 6)
    row.position_source = "admin"
    row.area = None
