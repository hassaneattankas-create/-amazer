"""Listes officielles datees : pharmacies de garde et stations approvisionnees (publiees par l'admin, avec source).

Public : seulement les listes en cours (aucune information perimee).
Admin : publier une liste en collant ses lignes, voir les listes, en retirer une.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.cache import build_cache_key, cache_delete_prefixes, cache_get_json, cache_set_json
from app.core.csrf import enforce_csrf
from app.core.deps import get_admin_user
from app.core.exceptions import NotFoundError, ValidationDomainError
from app.database import get_db
from app.models.official_list import OfficialList, OfficialListEntry
from app.models.user import User
from app.services import local_services as svc

router = APIRouter(tags=["official-lists"])
CACHE_PREFIX = "official-lists:"
MAX_ENTRIES = 300
ListKind = Literal["pharmacy_duty", "fuel_supply"]


class OfficialEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    district: str | None
    location: str | None
    phone: str | None
    group_label: str | None


class OfficialListItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    kind: ListKind
    city: str
    title: str
    source: str
    brand: str | None
    fuel: Literal["super", "gasoil", "gaz"] | None
    contact_phone: str | None
    contact_address: str | None
    starts_at: str
    ends_at: str
    entries: list[OfficialEntry]


class OfficialListCreate(BaseModel):
    """Lignes collees : pharmacies « groupe | nom | quartier | localisation | telephone » ; stations « nom | precision »."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    kind: ListKind
    city: str = Field(default="Niamey", min_length=2, max_length=80)
    title: str = Field(min_length=3, max_length=160)
    source: str = Field(min_length=3, max_length=200)
    brand: str | None = Field(default=None, max_length=120)
    fuel: Literal["super", "gasoil", "gaz"] | None = None
    contact_phone: str | None = Field(default=None, max_length=40, pattern=r"^[+0-9 ().-]*$")
    contact_address: str | None = Field(default=None, max_length=200)
    starts_at: datetime
    ends_at: datetime
    lines: str = Field(min_length=2, max_length=40000)


def _iso(value: datetime) -> str:
    return svc._aware(value).isoformat()


def _item(row: OfficialList, entries: list[OfficialListEntry]) -> OfficialListItem:
    return OfficialListItem(
        id=row.id,
        kind=row.kind,
        city=row.city,
        title=row.title,
        source=row.source,
        brand=row.brand,
        fuel=row.fuel if row.fuel in svc.FUELS else None,
        contact_phone=row.contact_phone,
        contact_address=row.contact_address,
        starts_at=_iso(row.starts_at),
        ends_at=_iso(row.ends_at),
        entries=[OfficialEntry(name=e.name, district=e.district, location=e.location, phone=e.phone, group_label=e.group_label) for e in entries],
    )


def _with_entries(db: Session, rows: list[OfficialList]) -> list[OfficialListItem]:
    if not rows:
        return []
    grouped: dict[str, list[OfficialListEntry]] = {}
    for entry in db.scalars(
        select(OfficialListEntry).where(OfficialListEntry.list_id.in_([r.id for r in rows])).order_by(OfficialListEntry.position)
    ).all():
        grouped.setdefault(entry.list_id, []).append(entry)
    return [_item(r, grouped.get(r.id, [])) for r in rows]


def parse_lines(kind: str, raw: str) -> list[dict]:
    """Une ligne par pharmacie ou station, champs separes par « | » (les lignes vides sont ignorees)."""
    entries: list[dict] = []
    for line in raw.splitlines():
        parts = [p.strip() for p in line.split("|")]
        if not any(parts):
            continue
        if kind == "pharmacy_duty":
            parts += [""] * (5 - len(parts))
            group, name, district, location, phone = parts[:5]
            entry = {"group_label": group or None, "name": name, "district": district or None, "location": location or None, "phone": phone or None}
        else:
            parts += [""] * (2 - len(parts))
            entry = {"group_label": None, "name": parts[0], "district": None, "location": parts[1] or None, "phone": None}
        if len(entry["name"]) < 2:
            raise ValidationDomainError(f"Ligne sans nom : « {line.strip()[:60]} ».")
        if entry["phone"] and not all(c in "+0123456789 ().-" for c in entry["phone"]):
            raise ValidationDomainError(f"Téléphone invalide pour « {entry['name']} ».")
        entries.append({k: (v[:240] if isinstance(v, str) else v) for k, v in entry.items()})
    if not entries:
        raise ValidationDomainError("Collez au moins une ligne.")
    if len(entries) > MAX_ENTRIES:
        raise ValidationDomainError(f"{MAX_ENTRIES} lignes au maximum.")
    return entries


def create_list(db: Session, data: dict, entries: list[dict]) -> OfficialList:
    fields = {k: v for k, v in data.items() if k != "entries"}
    # Toujours en UTC : la meme heure quelle que soit la base (et l'heure de Niamey reste juste a l'affichage).
    fields["starts_at"] = svc._aware(fields["starts_at"]).astimezone(UTC)
    fields["ends_at"] = svc._aware(fields["ends_at"]).astimezone(UTC)
    row = OfficialList(**fields)
    db.add(row)
    db.flush()
    for position, entry in enumerate(entries):
        db.add(OfficialListEntry(list_id=row.id, position=position, **entry))
    return row


def seed_official_lists(db: Session) -> int:
    """Listes recues le 24/10/2026 : inserees une seule fois (meme titre et meme debut = deja la)."""
    from app.data.official_lists_2026_10 import LISTS

    added = 0
    for data in LISTS:
        exists = db.scalar(select(OfficialList.id).where(OfficialList.title == data["title"], OfficialList.starts_at == data["starts_at"].astimezone(UTC)))
        if exists:
            continue
        entries = [
            {"group_label": g, "name": n, "district": d, "location": loc, "phone": p}
            for g, n, d, loc, p in data["entries"]
        ]
        create_list(db, data, entries)
        added += 1
    db.commit()
    if added:
        cache_delete_prefixes(CACHE_PREFIX)
    return added


@router.get("/services/official-lists", response_model=list[OfficialListItem])
def current_official_lists(
    db: Annotated[Session, Depends(get_db)],
    kind: Annotated[ListKind, Query()],
    city: Annotated[str | None, Query(max_length=80)] = None,
) -> list[OfficialListItem]:
    """Listes en cours (periode active), les plus recentes d'abord."""
    key = build_cache_key(CACHE_PREFIX + kind, city=svc.normalize_city(city))
    cached = cache_get_json(key)
    if cached is not None:
        return [OfficialListItem(**i) for i in cached]
    now = datetime.now(UTC)
    rows = [
        r
        for r in db.scalars(
            select(OfficialList)
            .where(OfficialList.kind == kind, OfficialList.starts_at <= now, OfficialList.ends_at > now)
            .order_by(OfficialList.starts_at.desc())
        ).all()
        if not city or svc.normalize_city(r.city) == svc.normalize_city(city)
    ]
    items = _with_entries(db, rows)
    cache_set_json(key, [i.model_dump() for i in items], ttl_seconds=60)
    return items


@router.get("/admin/official-lists", response_model=list[OfficialListItem])
def admin_official_lists(
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> list[OfficialListItem]:
    """Toutes les listes (en cours, a venir et passees), les plus recentes d'abord."""
    return _with_entries(db, list(db.scalars(select(OfficialList).order_by(OfficialList.starts_at.desc()).limit(60)).all()))


@router.post("/admin/official-lists", response_model=OfficialListItem, status_code=201)
def admin_create_official_list(
    payload: OfficialListCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> OfficialListItem:
    enforce_csrf(request)
    starts, ends = svc._aware(payload.starts_at), svc._aware(payload.ends_at)
    if ends <= starts:
        raise ValidationDomainError("La fin doit être après le début.")
    if (ends - starts).days > 31:
        raise ValidationDomainError("Une liste couvre 31 jours au maximum.")
    if payload.kind == "fuel_supply" and not payload.fuel:
        raise ValidationDomainError("Indiquez le carburant concerné.")
    entries = parse_lines(payload.kind, payload.lines)
    data = payload.model_dump(exclude={"lines"})
    data.update(starts_at=starts, ends_at=ends, fuel=payload.fuel if payload.kind == "fuel_supply" else None)
    row = create_list(db, data, entries)
    db.commit()
    cache_delete_prefixes(CACHE_PREFIX)
    return _with_entries(db, [row])[0]


@router.delete("/admin/official-lists/{list_id}", status_code=204, response_model=None)
def admin_delete_official_list(
    list_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> None:
    enforce_csrf(request)
    row = db.get(OfficialList, list_id)
    if row is None:
        raise NotFoundError("Liste introuvable.")
    db.delete(row)
    db.commit()
    cache_delete_prefixes(CACHE_PREFIX)
