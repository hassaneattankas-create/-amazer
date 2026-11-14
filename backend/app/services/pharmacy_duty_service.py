"""Pharmacies de garde : la liste officielle de la semaine, rendue utile pour les clients.

- La liste officielle (affiche du ministère, publiée par l'admin) dit qui est de garde, du samedi 8 h au samedi 8 h.
- Une pharmacie inscrite sur AMAZER qui figure sur la liste est de garde automatiquement (rien à faire).
- Une pharmacie inscrite peut aussi se déclarer de garde elle-même (garde exceptionnelle).
- L'admin publie la liste en envoyant la photo de l'affiche : elle est lue automatiquement (Gemini, offre gratuite),
  il vérifie puis publie.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import UTC, datetime
from urllib.parse import quote_plus

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.official_list import OfficialList, OfficialListEntry
from app.models.seller_profile import SellerProfile
from app.services import local_services as svc

logger = logging.getLogger(__name__)

DAYS = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")
MONTHS = ("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.")
PHOTO_MODELS = ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest")


def name_key(value: str | None) -> str:
    text = svc.normalize_city(value).replace("-", " ").replace("'", " ").replace("’", " ")
    text = re.sub(r"^pharmacie\s+(de\s+la\s+|de\s+l\s+|du\s+|des\s+|de\s+)?", "", text)
    return " ".join(text.split())


def same_name(a: str | None, b: str | None) -> bool:
    """Deux écritures d'un même nom (« Pharmacie Ar Rahma » = « AR RAHMA »)."""
    return bool(name_key(a)) and name_key(a) == name_key(b)


def phone_link(phone: str | None) -> str | None:
    """Numéro composable : chiffres seuls, +227 ajouté aux numéros nigériens à 8 chiffres."""
    digits = "".join(c for c in (phone or "") if c.isdigit() or c == "+")
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    if not digits.strip("+"):
        return None
    if not digits.startswith("+") and len(digits) == 8:
        digits = "+227" + digits
    return digits


def local(moment: datetime) -> datetime:
    return svc._aware(moment).astimezone(svc.NIAMEY_TZ)


def _hour(moment: datetime) -> str:
    return f"{moment.hour} h" + (f"{moment.minute:02d}" if moment.minute else "")


def until_label(moment: datetime) -> str:
    """« jusqu'au samedi 21 nov. à 8 h » (heure de Niamey)."""
    t = local(moment)
    return f"jusqu'au {DAYS[t.weekday()]} {t.day} {MONTHS[t.month - 1]} à {_hour(t)}"


def period_label(start: datetime, end: datetime) -> str:
    a, b = local(start), local(end)
    return f"du {DAYS[a.weekday()]} {a.day} {MONTHS[a.month - 1]} {_hour(a)} au {DAYS[b.weekday()]} {b.day} {MONTHS[b.month - 1]} {_hour(b)}"


def _lists(db: Session, city: str | None, now: datetime) -> tuple[list[OfficialList], list[OfficialList]]:
    """Listes de pharmacies de garde en cours et à venir (la plus proche d'abord)."""
    rows = db.scalars(
        select(OfficialList).where(OfficialList.kind == "pharmacy_duty", OfficialList.ends_at > now).order_by(OfficialList.starts_at)
    ).all()
    if city:
        wanted = svc.normalize_city(city)
        rows = [r for r in rows if svc.normalize_city(r.city) == wanted]
    current = [r for r in rows if svc._aware(r.starts_at) <= now]
    upcoming = [r for r in rows if svc._aware(r.starts_at) > now]
    return current, upcoming


def _entries(db: Session, lists: list[OfficialList]) -> dict[str, list[OfficialListEntry]]:
    if not lists:
        return {}
    grouped: dict[str, list[OfficialListEntry]] = {}
    for entry in db.scalars(
        select(OfficialListEntry).where(OfficialListEntry.list_id.in_([r.id for r in lists])).order_by(OfficialListEntry.position)
    ).all():
        grouped.setdefault(entry.list_id, []).append(entry)
    return grouped


def official_duty(db: Session, now: datetime | None = None) -> dict[str, list[tuple[str, datetime]]]:
    """Ville (normalisée) → [(nom de pharmacie, fin de garde)] d'après les listes officielles en cours."""
    now = now or datetime.now(UTC)
    current, _ = _lists(db, None, now)
    result: dict[str, list[tuple[str, datetime]]] = {}
    for row in current:
        for entry in _entries(db, [row]).get(row.id, []):
            result.setdefault(svc.normalize_city(row.city), []).append((entry.name, svc._aware(row.ends_at)))
    return result


def official_end_for(profile: SellerProfile, duty: dict[str, list[tuple[str, datetime]]]) -> datetime | None:
    """Fin de garde si cette pharmacie inscrite figure sur la liste officielle de sa ville."""
    for name, ends in duty.get(svc.normalize_city(profile.city or "Niamey"), []):
        if same_name(name, profile.business_name):
            return ends
    return None


@dataclass
class BoardItem:
    name: str
    commune: str | None
    district: str | None
    location: str | None
    phone: str | None
    phone_link: str | None
    whatsapp_link: str | None
    latitude: float | None
    longitude: float | None
    maps_url: str
    vendor_id: str | None
    logo_url: str | None
    is_verified: bool
    until_label: str
    official: bool


@dataclass
class BoardWeek:
    title: str
    source: str
    starts_at: datetime
    ends_at: datetime
    items: list[BoardItem] = field(default_factory=list)


def _maps(name: str, location: str | None, city: str, lat: float | None, lng: float | None) -> str:
    if lat is not None and lng is not None:
        return f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"
    return "https://www.google.com/maps/search/?api=1&query=" + quote_plus(f"Pharmacie {name}, {location or ''}, {city}, Niger")


def _wa(profile: SellerProfile | None) -> str | None:
    raw = getattr(profile, "whatsapp_contact", None) if profile else None
    link = phone_link(raw)
    return f"https://wa.me/{link.lstrip('+')}" if link else None


def _week(db: Session, row: OfficialList, profiles: list[SellerProfile], decrypt) -> BoardWeek:
    week = BoardWeek(title=row.title, source=row.source, starts_at=svc._aware(row.starts_at), ends_at=svc._aware(row.ends_at))
    for entry in _entries(db, [row]).get(row.id, []):
        profile = next((p for p in profiles if same_name(p.business_name, entry.name)), None)
        lat = getattr(profile, "latitude", None)
        lng = getattr(profile, "longitude", None)
        phone = entry.phone or (decrypt(profile.phone) if profile else None)
        week.items.append(
            BoardItem(
                name=entry.name, commune=entry.group_label, district=entry.district, location=entry.location,
                phone=phone, phone_link=phone_link(phone), whatsapp_link=_wa(profile),
                latitude=lat, longitude=lng, maps_url=_maps(entry.name, entry.location, row.city, lat, lng),
                vendor_id=profile.vendor_id if profile else None,
                logo_url=getattr(profile, "logo_url", None), is_verified=bool(getattr(profile, "is_verified", False)),
                until_label=until_label(row.ends_at), official=True,
            )
        )
    return week


def board(db: Session, city: str, profiles: list[SellerProfile], decrypt, now: datetime | None = None) -> tuple[BoardWeek | None, BoardWeek | None, list[BoardItem]]:
    """Semaine en cours, semaine suivante (si publiée) et gardes déclarées par les pharmacies inscrites."""
    now = now or datetime.now(UTC)
    wanted = svc.normalize_city(city)
    in_city = [p for p in profiles if svc.normalize_city(p.city or "Niamey") == wanted]
    current, upcoming = _lists(db, city, now)
    this_week = _week(db, current[-1], in_city, decrypt) if current else None
    next_week = _week(db, upcoming[0], in_city, decrypt) if upcoming else None
    listed = {name_key(i.name) for i in (this_week.items if this_week else [])}
    extra: list[BoardItem] = []
    for p in in_city:
        if name_key(p.business_name) in listed or not svc.is_on_duty(p, now):
            continue
        phone = decrypt(p.phone)
        end = getattr(p, "duty_end", None)
        extra.append(
            BoardItem(
                name=p.business_name, commune=None, district=None, location=p.address, phone=phone, phone_link=phone_link(phone),
                whatsapp_link=_wa(p), latitude=p.latitude, longitude=p.longitude,
                maps_url=_maps(p.business_name, p.address, p.city or city, p.latitude, p.longitude),
                vendor_id=p.vendor_id, logo_url=p.logo_url, is_verified=bool(p.is_verified),
                until_label=f"jusqu'au {end.day} {MONTHS[end.month - 1]}" if end else "de garde maintenant", official=False,
            )
        )
    return this_week, next_week, extra


# ---------------------------------------------------------------- lecture de la photo de l'affiche
PHOTO_PROMPT = """Tu lis l'affiche officielle des pharmacies de garde d'une ville du Niger.
Réponds UNIQUEMENT en JSON, sans texte autour :
{"city": "Niamey", "starts_at": "AAAA-MM-JJTHH:MM", "ends_at": "AAAA-MM-JJTHH:MM",
 "rows": [{"group": "Commune I", "name": "Nom de la pharmacie", "location": "Localisation", "phone": "20 73 68 58"}]}
Règles : une ligne par pharmacie, dans l'ordre de l'affiche ; recopie exactement les noms, localisations et numéros ;
"group" = la commune ou le groupe indiqué à gauche (ex. « Commune I ») ; heures de Niamey ;
écris les noms en majuscules et minuscules normales (ex. « Cité Caisse ») ; n'invente rien : champ vide si illisible."""


class PhotoReadError(Exception):
    pass


def read_duty_photo(image: bytes, mime: str) -> dict:
    """Lit l'affiche : ville, période et lignes. Lève PhotoReadError avec un message clair."""
    api_key = (os.getenv("ASSISTANT_API_KEY") or "").strip()
    if not api_key:
        raise PhotoReadError("La lecture automatique n'est pas activée (clé Gemini absente). Collez la liste à la place.")
    payload = {
        "contents": [{"role": "user", "parts": [{"text": PHOTO_PROMPT}, {"inline_data": {"mime_type": mime, "data": base64.b64encode(image).decode()}}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "maxOutputTokens": 8192},
    }
    last = "réponse vide"
    for model in PHOTO_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            text = "".join(part.get("text", "") for part in data["candidates"][0]["content"]["parts"])
            result = json.loads(text[text.find("{") : text.rfind("}") + 1])
            rows = [r for r in result.get("rows", []) if isinstance(r, dict) and str(r.get("name", "")).strip()]
            if rows:
                result["rows"] = rows
                return result
            last = "aucune pharmacie lue"
        except urllib.error.HTTPError as err:
            last = f"erreur {err.code}"
        except (urllib.error.URLError, KeyError, IndexError, ValueError, TimeoutError) as err:
            last = type(err).__name__
        logger.warning("Lecture de l'affiche des gardes avec %s impossible : %s", model, last)
    raise PhotoReadError("La photo n'a pas pu être lue. Réessayez avec une photo nette et droite, ou collez la liste.")


def rows_to_lines(rows: list[dict]) -> str:
    """Lignes « commune | nom | quartier | localisation | téléphone » (format de publication)."""
    clean = lambda v: str(v or "").replace("|", "/").strip()  # noqa: E731
    return "\n".join(f"{clean(r.get('group'))} | {clean(r.get('name'))} |  | {clean(r.get('location'))} | {clean(r.get('phone'))}" for r in rows)
