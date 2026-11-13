"""Chaine de gestion des stations : proprietaire -> responsable de ville -> gerant.

- station_access : LE role d'un compte sur une station (« owner » > « city » > « manager »), ou None.
- log_activity : journal (qui a fait quoi, ou, quand), appele par TOUTES les ecritures.
- Fiche de la station (adresse, telephone, horaires, services, position) et analyse des liens Google Maps.
- Gerants, retours clients, livraisons : regles partagees par les espaces proprietaire, ville et gerant.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Literal
from urllib.parse import unquote

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError, ValidationDomainError
from app.models.fuel_activity import FuelActivity, FuelDelivery
from app.models.fuel_history import StationReport
from app.models.fuel_outlet import FuelOutlet, FuelOutletManager, FuelRegionManager
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.local_services import (
    STATION_SERVICES,
    ActivityItem,
    DeliveryItem,
    FuelOutletUpdate,
    StationInfo,
    StationInfoUpdate,
    StationManagerRef,
    StationReportItem,
)
from app.services import local_services as svc

Role = Literal["owner", "city", "manager"]
ROLE_RANK: dict[str, int] = {"manager": 1, "city": 2, "owner": 3}
NIGER_CITIES = ("Niamey", "Agadez", "Diffa", "Dosso", "Maradi", "Tahoua", "Tillabéri", "Zinder")
MAX_CITY_MANAGERS = 50
MAX_MANAGERS_PER_OUTLET = 5
ACTIVITY_DAYS = 90
ACTIVITY_LIMIT = 200
REPORT_DAYS = 30
DELIVERY_DAYS = 30
FUEL_LABELS = {"super": "Super", "gasoil": "Gasoil", "gaz": "Gaz"}
STATE_LABELS = {"available": "disponible", "low": "stock faible", "out": "rupture"}
POSITION_ERROR = "Position introuvable au Niger. Activez la localisation et réessayez sur place."
LINK_ERROR = (
    "Lien sans coordonnées. Ouvrez le lien dans Google Maps, appuyez longuement sur la station "
    "puis copiez les coordonnées (ex. 13.5137, 2.1098)."
)
SUSPENDED_BRAND = "Mises à jour suspendues : l'abonnement de la marque a expiré."
SUSPENDED_CLOSED = "Mises à jour suspendues : la station est fermée."


# ---------------------------------------------------------------- roles

def owner_profile(db: Session, user: User) -> SellerProfile | None:
    """Vitrine « station-essence » de ce compte (proprietaire d'une marque), sinon None."""
    return db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id, SellerProfile.service_kind == "fuel_station"))


def region_cities(db: Session, user: User) -> dict[str, dict[str, str]]:
    """Villes confiees a ce compte : {vendor_id: {ville normalisee: orthographe enregistree}}."""
    access: dict[str, dict[str, str]] = {}
    for row in db.scalars(select(FuelRegionManager).where(FuelRegionManager.user_id == user.id).order_by(FuelRegionManager.created_at)).all():
        access.setdefault(row.vendor_id, {}).setdefault(svc.normalize_city(row.city), row.city)
    return access


def station_access(db: Session, user: User, outlet: FuelOutlet) -> Role | None:
    """Role le plus eleve du compte sur cette station (proprietaire > ville > gerant), ou None."""
    owner = db.scalar(
        select(SellerProfile.id).where(
            SellerProfile.user_id == user.id, SellerProfile.vendor_id == outlet.vendor_id, SellerProfile.service_kind == "fuel_station"
        )
    )
    if owner is not None:
        return "owner"
    wanted = svc.normalize_city(outlet.city)
    cities = db.scalars(select(FuelRegionManager.city).where(FuelRegionManager.vendor_id == outlet.vendor_id, FuelRegionManager.user_id == user.id)).all()
    if any(svc.normalize_city(c) == wanted for c in cities):
        return "city"
    direct = db.scalar(select(FuelOutletManager.id).where(FuelOutletManager.outlet_id == outlet.id, FuelOutletManager.user_id == user.id))
    return "manager" if direct is not None else None


def require_station(db: Session, user: User, outlet_id: str, roles: Iterable[str] = ("owner", "city", "manager")) -> tuple[FuelOutlet, Role]:
    """La station et le role du compte ; une station inconnue ou d'une autre marque est « introuvable »."""
    outlet = db.get(FuelOutlet, outlet_id)
    role = station_access(db, user, outlet) if outlet is not None else None
    if outlet is None or role is None:
        raise NotFoundError("Station introuvable.")
    if role not in tuple(roles):
        raise ForbiddenError("Action réservée au responsable de ville ou au propriétaire de la marque.")
    return outlet, role


def brand_can_publish(db: Session, vendor_id: str, now: datetime) -> bool:
    """Abonnement de la marque en cours : sinon les mises a jour de son equipe sont suspendues."""
    vendor = db.get(Vendor, vendor_id)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
    paid_until = svc._aware(profile.subscription_paid_until) if profile is not None else None
    return bool(vendor is not None and vendor.is_active and paid_until is not None and paid_until > now)


def ensure_writable(db: Session, outlet: FuelOutlet, role: str, now: datetime, *, allow_closed: bool = False) -> None:
    """Ecritures suspendues si l'abonnement de la marque a expire, ou si la station est fermee (a rouvrir d'abord)."""
    if not brand_can_publish(db, outlet.vendor_id, now):
        raise ForbiddenError(SUSPENDED_BRAND)
    if not allow_closed and not outlet.is_active:
        raise ForbiddenError(SUSPENDED_CLOSED)


def notify_station_report(db: Session, vendor_id: str, outlet_id: str | None) -> None:
    """Previent ceux qui traitent le retour : les gerants, sinon les responsables de la ville, sinon le proprietaire."""
    from app.services.local_services import normalize_city
    from app.services.station_tasks import _notify

    outlet = db.get(FuelOutlet, outlet_id) if outlet_id else None
    name = outlet.name if outlet is not None else None
    title, body = "Nouveau retour client", f"Un client signale une erreur sur la station « {name} »." if name else "Un client signale une erreur sur votre station."
    users: set[str] = set()
    if outlet is not None:
        users = set(db.scalars(select(FuelOutletManager.user_id).where(FuelOutletManager.outlet_id == outlet.id)).all())
        if not users:
            wanted = normalize_city(outlet.city)
            users = {r.user_id for r in db.scalars(select(FuelRegionManager).where(FuelRegionManager.vendor_id == vendor_id)).all() if normalize_city(r.city) == wanted}
    tag = f"station-report-{outlet_id or vendor_id}"
    for user_id in users:
        _notify(db, user_id, title, body, tag, "/gerant-station")
    if not users:
        owner_id = db.scalar(select(SellerProfile.user_id).where(SellerProfile.vendor_id == vendor_id))
        if owner_id:
            _notify(db, owner_id, title, body, tag, "/seller/dashboard")


# ---------------------------------------------------------------- journal

def actor_name(user: User | None) -> str | None:
    """Nom affiche dans le journal : nom complet, sinon e-mail."""
    if user is None:
        return None
    name = (user.full_name or "").strip() or (user.email or "").strip()
    return name[:140] or None


def log_activity(
    db: Session,
    *,
    vendor_id: str,
    outlet: FuelOutlet | None,
    user: User | None,
    role: str,
    action: str,
    detail: str | None = None,
    city: str | None = None,
    link: bool = True,
) -> None:
    """Une ligne de journal. link=False : station en cours de suppression (nom et ville gardes en copie)."""
    db.add(
        FuelActivity(
            vendor_id=vendor_id,
            outlet_id=outlet.id if outlet is not None and link else None,
            outlet_name=outlet.name[:140] if outlet is not None else None,
            city=(outlet.city if outlet is not None else city) or None,
            user_id=user.id if user is not None else None,
            actor_name=actor_name(user),
            role=role,
            action=action,
            detail=detail[:300] if detail else None,
        )
    )


def fuel_detail(before: dict | None, after: dict | None) -> str | None:
    """« Super : rupture · Gaz : disponible » (seulement ce qui a change), None si rien n'a change."""
    changes = svc.fuel_changes(before, after)
    if not changes:
        return None
    return " · ".join(f"{FUEL_LABELS[fuel]} : {STATE_LABELS[new]}" for fuel, _old, new in changes)


def log_fuel_activity(db: Session, *, vendor_id: str, outlet: FuelOutlet | None, user: User, role: str, before: dict | None, after: dict | None, city: str | None = None) -> None:
    detail = fuel_detail(before, after)
    if detail:
        log_activity(db, vendor_id=vendor_id, outlet=outlet, user=user, role=role, action="fuel", detail=detail, city=city)
    else:
        log_activity(db, vendor_id=vendor_id, outlet=outlet, user=user, role=role, action="confirm", detail="Rien n'a changé", city=city)


def _since(days: int, now: datetime | None = None) -> datetime:
    return (now or datetime.now(UTC)) - timedelta(days=days)


def activity_items(rows: Iterable[FuelActivity]) -> list[ActivityItem]:
    items: list[ActivityItem] = []
    for r in rows:
        if r.role not in ROLE_RANK:
            continue
        created = svc._aware(r.created_at)
        items.append(
            ActivityItem(
                id=r.id,
                created_at=created.isoformat() if created else "",
                role=r.role,  # type: ignore[arg-type]  # verifie juste au-dessus
                action=r.action,
                detail=r.detail,
                actor_name=r.actor_name,
                outlet_id=r.outlet_id,
                outlet_name=r.outlet_name,
                city=r.city,
            )
        )
    return items


def recent_activity(
    db: Session,
    vendor_id: str,
    *,
    city: str | None = None,
    outlet_id: str | None = None,
    role: str | None = None,
    limit: int = ACTIVITY_LIMIT,
) -> list[ActivityItem]:
    """Journal des 90 derniers jours, le plus recent d'abord (200 lignes au plus)."""
    limit = max(1, min(limit, ACTIVITY_LIMIT))
    stmt = select(FuelActivity).where(FuelActivity.vendor_id == vendor_id, FuelActivity.created_at >= _since(ACTIVITY_DAYS))
    if outlet_id:
        stmt = stmt.where(FuelActivity.outlet_id == outlet_id)
    if role:
        stmt = stmt.where(FuelActivity.role == role)
    if city:
        # Ville comparee sans accents ni majuscules : on retrouve d'abord les orthographes
        # enregistrees pour la marque, puis on filtre en SQL (fenetre complete de 90 jours).
        wanted = svc.normalize_city(city)
        spellings = db.scalars(
            select(FuelActivity.city).where(FuelActivity.vendor_id == vendor_id, FuelActivity.city.is_not(None)).distinct()
        ).all()
        matches = [c for c in spellings if svc.normalize_city(c) == wanted]
        if not matches:
            return []
        stmt = stmt.where(FuelActivity.city.in_(matches))
    rows = db.scalars(stmt.order_by(FuelActivity.created_at.desc()).limit(limit)).all()
    return activity_items(rows)


def last_activity_by_user(db: Session, vendor_id: str) -> dict[str, datetime]:
    rows = db.execute(
        select(FuelActivity.user_id, func.max(FuelActivity.created_at))
        .where(FuelActivity.vendor_id == vendor_id, FuelActivity.user_id.is_not(None))
        .group_by(FuelActivity.user_id)
    ).all()
    out: dict[str, datetime] = {}
    for user_id, when in rows:
        aware = svc._aware(when)
        if user_id and aware is not None:
            out[user_id] = aware
    return out


# ---------------------------------------------------------------- fiche de la station

_NUM = r"([-+]?\d{1,3}(?:\.\d+)?)"
_LINK_PATTERNS = (
    re.compile(r"!3d" + _NUM + r"!4d" + _NUM),
    re.compile(r"[?&](?:q|query|destination|ll)=(?:loc:)?\s*" + _NUM + r"\s*,\s*" + _NUM),
    re.compile(r"@" + _NUM + r"\s*,\s*" + _NUM),
    re.compile(r"^\s*" + _NUM + r"\s*(?:,|;|\s)\s*" + _NUM + r"\s*$"),
)


def parse_maps_link(text: str) -> tuple[float, float]:
    """Coordonnees d'un lien Google Maps (@lat,lng ; q= ; query= ; destination= ; ll= ; !3d!4d) ou « lat, lng »."""
    raw = unquote((text or "").strip().replace("+", " "))
    for pattern in _LINK_PATTERNS:
        match = pattern.search(raw)
        if match:
            try:
                return float(match.group(1)), float(match.group(2))
            except ValueError:
                continue
    raise ValidationDomainError(LINK_ERROR)


def resolve_position(payload: StationInfoUpdate | FuelOutletUpdate) -> tuple[float, float] | None:
    """Position demandee (GPS ou lien), verifiee au Niger ; None si la position n'est pas modifiee."""
    lat, lng = payload.latitude, payload.longitude
    if lat is None and lng is None:
        link = (payload.maps_link or "").strip()
        if not link:
            return None
        lat, lng = parse_maps_link(link)
    if lat is None or lng is None or not svc.valid_position(lat, lng):
        raise ValidationDomainError(POSITION_ERROR)
    return lat, lng


def apply_info_update(outlet: FuelOutlet, payload: StationInfoUpdate | FuelOutletUpdate, now: datetime) -> tuple[bool, list[str], bool]:
    """Applique la fiche. Renvoie (fiche touchee, libelles modifies, position modifiee).

    La position est verifiee AVANT toute modification : une erreur ne laisse rien a moitie change.
    """
    position = resolve_position(payload)
    touched, changed = False, []
    for field, label in (("address", "adresse"), ("phone", "téléphone"), ("opening_hours", "horaires")):
        value = getattr(payload, field)
        if value is None:
            continue
        touched = True
        new = value or None
        if new != getattr(outlet, field):
            setattr(outlet, field, new)
            changed.append(label)
    if payload.services is not None:
        touched = True
        services = list(payload.services)
        if services != list(outlet.services or []):
            outlet.services = services
            changed.append("services")
    moved = False
    if position is not None:
        touched = True
        if (outlet.latitude, outlet.longitude) != position:
            outlet.latitude, outlet.longitude = position
            moved = True
    duty = apply_duty_update(outlet, payload, now)
    if duty:
        touched = True
        changed.append(duty)
    if touched:
        outlet.info_updated_at = now
    return touched, changed, moved


def apply_duty_update(outlet: FuelOutlet, payload: StationInfoUpdate | FuelOutletUpdate, now: datetime) -> str | None:
    """Garde : renvoie le libelle du changement (pour le journal) ou None si rien ne change.

    duty_until doit etre aujourd'hui ou plus tard (heure de Niamey) : sinon la garde serait deja finie.
    """
    if payload.on_duty is None:
        return None
    until = payload.duty_until if payload.on_duty else None
    if until is not None and until < svc.niamey_today(now):
        raise ValidationDomainError("La date de fin de garde est déjà passée : choisissez aujourd'hui ou plus tard.")
    if (bool(outlet.on_duty), outlet.duty_until) == (payload.on_duty, until):
        return None
    outlet.on_duty = payload.on_duty
    outlet.duty_until = until
    outlet.duty_updated_at = now
    if not payload.on_duty:
        return "garde arrêtée"
    return f"de garde jusqu'au {until.strftime('%d/%m/%Y')}" if until else "de garde"



def log_info_activity(db: Session, outlet: FuelOutlet, user: User, role: str, touched: bool, changed: list[str], moved: bool) -> None:
    if touched and (changed or not moved):
        detail = ("Modifié : " + ", ".join(changed)) if changed else "Informations confirmées"
        log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=user, role=role, action="info", detail=detail)
    if moved and outlet.latitude is not None and outlet.longitude is not None:
        detail = f"Position enregistrée : {outlet.latitude:.5f}, {outlet.longitude:.5f}"
        log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=user, role=role, action="position", detail=detail)


def clean_services(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [code for code in dict.fromkeys(raw) if code in STATION_SERVICES]


def station_info(outlet: FuelOutlet) -> StationInfo:
    updated = svc._aware(outlet.info_updated_at)
    return StationInfo(
        address=outlet.address,
        phone=outlet.phone,
        opening_hours=outlet.opening_hours,
        services=clean_services(outlet.services),
        latitude=outlet.latitude,
        longitude=outlet.longitude,
        maps_url=svc.maps_url(outlet),
        info_updated_at=updated.isoformat() if updated else None,
        on_duty=bool(outlet.on_duty),
        duty_until=outlet.duty_until.isoformat() if outlet.duty_until else None,
        on_duty_now=svc.outlet_on_duty(outlet),
    )


def canonical_city(db: Session, vendor_id: str, raw: str) -> str:
    """Orthographe enregistree : celle des stations de la marque, sinon la liste du Niger, sinon la saisie."""
    name = " ".join((raw or "").split())
    if not 2 <= len(name) <= 80:
        raise ValidationDomainError("Indiquez une ville (2 à 80 caractères).")
    wanted = svc.normalize_city(name)
    for city in db.scalars(select(FuelOutlet.city).where(FuelOutlet.vendor_id == vendor_id).order_by(FuelOutlet.created_at)).all():
        if svc.normalize_city(city) == wanted:
            return city
    for city in NIGER_CITIES:
        if svc.normalize_city(city) == wanted:
            return city
    return name.title()


# ---------------------------------------------------------------- gerants

def manager_refs(db: Session, outlet_ids: list[str]) -> dict[str, list[StationManagerRef]]:
    grouped: dict[str, list[StationManagerRef]] = {}
    if not outlet_ids:
        return grouped
    rows = db.execute(
        select(FuelOutletManager, User.email, User.full_name)
        .join(User, User.id == FuelOutletManager.user_id)
        .where(FuelOutletManager.outlet_id.in_(outlet_ids))
        .order_by(FuelOutletManager.created_at)
    ).all()
    for row, email, full_name in rows:
        grouped.setdefault(row.outlet_id, []).append(StationManagerRef(id=row.id, email=email, full_name=full_name or None))
    return grouped


def assign_manager(db: Session, *, outlet: FuelOutlet, email: str, actor: User, role: str, brand_name: str) -> FuelOutletManager:
    """Confie une station a un compte AMAZER existant ; journal + notification du gerant."""
    from app.services.station_tasks import _notify

    user = db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))
    if user is None or not user.is_active:
        raise ValidationDomainError(
            "Aucun compte AMAZER avec cet e-mail. Demandez au gérant de créer un compte gratuit sur amazer.store, puis réessayez."
        )
    if user.id == actor.id:
        raise ValidationDomainError("Vous gérez déjà cette station depuis votre espace.")
    existing = db.scalars(select(FuelOutletManager).where(FuelOutletManager.outlet_id == outlet.id)).all()
    if any(m.user_id == user.id for m in existing):
        raise ValidationDomainError("Cette personne gère déjà cette station.")
    if len(existing) >= MAX_MANAGERS_PER_OUTLET:
        raise ValidationDomainError(f"{MAX_MANAGERS_PER_OUTLET} gérants au maximum par station.")
    row = FuelOutletManager(vendor_id=outlet.vendor_id, outlet_id=outlet.id, user_id=user.id, assigned_by=actor.id)
    db.add(row)
    log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=actor, role=role, action="manager_added", detail=f"Gérant ajouté : {user.email}")
    db.commit()
    _notify(
        db,
        user.id,
        "Une station vous est confiée",
        f"{brand_name} vous confie la station « {outlet.name} ». Pour y revenir, connectez-vous à AMAZER avec ce compte : « Espace station » se trouve dans le menu.",
        f"fuel-manager-{outlet.id}",
        "/gerant-station",
    )
    db.commit()
    return row


def remove_manager(db: Session, row: FuelOutletManager, actor: User, role: str) -> None:
    outlet = db.get(FuelOutlet, row.outlet_id)
    removed = db.get(User, row.user_id)
    detail = f"Gérant retiré : {removed.email}" if removed is not None else "Gérant retiré"
    log_activity(db, vendor_id=row.vendor_id, outlet=outlet, user=actor, role=role, action="manager_removed", detail=detail)
    db.delete(row)
    db.commit()


def delete_outlet(db: Session, outlet: FuelOutlet, actor: User, role: str) -> None:
    """Supprime une station (journal garde son nom). Derniere station : la disponibilite de la marque repart de zero."""
    vendor_id = outlet.vendor_id
    log_activity(db, vendor_id=vendor_id, outlet=outlet, user=actor, role=role, action="outlet_deleted", detail=f"Station supprimée : {outlet.name}", link=False)
    db.delete(outlet)
    db.flush()
    remaining = int(db.scalar(select(func.count()).select_from(FuelOutlet).where(FuelOutlet.vendor_id == vendor_id)) or 0)
    if remaining == 0:
        profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
        if profile is not None:
            profile.fuel_status = None
            profile.fuel_updated_at = None
    db.commit()


# ---------------------------------------------------------------- retours clients

def open_report_counts(db: Session, outlet_ids: list[str], now: datetime | None = None) -> dict[str, int]:
    if not outlet_ids:
        return {}
    rows = db.execute(
        select(StationReport.outlet_id, func.count())
        .where(StationReport.outlet_id.in_(outlet_ids), StationReport.resolved_at.is_(None), StationReport.created_at >= _since(REPORT_DAYS, now))
        .group_by(StationReport.outlet_id)
    ).all()
    return {outlet_id: int(count) for outlet_id, count in rows if outlet_id}


def report_items(db: Session, rows: Iterable[StationReport]) -> list[StationReportItem]:
    rows = list(rows)
    outlet_ids = {r.outlet_id for r in rows if r.outlet_id}
    names = {o.id: o.name for o in db.scalars(select(FuelOutlet).where(FuelOutlet.id.in_(outlet_ids))).all()} if outlet_ids else {}
    user_ids = {r.resolved_by for r in rows if r.resolved_by}
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}
    items: list[StationReportItem] = []
    for r in rows:
        created, resolved = svc._aware(r.created_at), svc._aware(r.resolved_at)
        items.append(
            StationReportItem(
                id=r.id,
                outlet_id=r.outlet_id,
                outlet_name=names.get(r.outlet_id) if r.outlet_id else None,
                kind=r.kind,  # type: ignore[arg-type]  # valeur validee a la creation
                comment=r.comment,
                created_at=created.isoformat() if created else "",
                resolved_at=resolved.isoformat() if resolved else None,
                resolution=r.resolution,
                resolved_by_name=actor_name(users.get(r.resolved_by)) if r.resolved_by else None,
            )
        )
    return items


def recent_reports(db: Session, vendor_id: str, outlet_ids: list[str] | None = None, limit: int = 100) -> list[StationReportItem]:
    """Retours des 30 derniers jours : non traites d'abord, puis les plus recents."""
    stmt = select(StationReport).where(StationReport.vendor_id == vendor_id, StationReport.created_at >= _since(REPORT_DAYS))
    if outlet_ids is not None:
        if not outlet_ids:
            return []
        stmt = stmt.where(StationReport.outlet_id.in_(outlet_ids))
    rows = list(db.scalars(stmt.order_by(StationReport.created_at.desc()).limit(limit)).all())
    rows.sort(key=lambda r: r.resolved_at is not None)
    return report_items(db, rows)


def resolve_report(db: Session, report: StationReport, user: User, role: str, resolution: str | None, now: datetime) -> StationReportItem:
    if report.resolved_at is None:
        report.resolved_at = now
        report.resolved_by = user.id
        report.resolution = resolution or None
        outlet = db.get(FuelOutlet, report.outlet_id) if report.outlet_id else None
        log_activity(
            db,
            vendor_id=report.vendor_id,
            outlet=outlet,
            user=user,
            role=role,
            action="report_resolved",
            detail=f"Retour traité : {resolution}" if resolution else "Retour traité",
        )
        db.commit()
    return report_items(db, [report])[0]


# ---------------------------------------------------------------- livraisons

def format_quantity(liters: int) -> str:
    return f"{liters:,}".replace(",", " ")


def record_delivery(
    db: Session,
    *,
    outlet: FuelOutlet,
    user: User,
    role: str,
    fuel: str,
    liters: int,
    reference: str | None,
    delivered_at: datetime | None,
    now: datetime,
) -> FuelDelivery:
    when = now
    if delivered_at is not None:
        when = delivered_at if delivered_at.tzinfo else delivered_at.replace(tzinfo=UTC)
        if when > now + timedelta(minutes=10):
            raise ValidationDomainError("La date de livraison ne peut pas être dans le futur.")
        if when < now - timedelta(days=DELIVERY_DAYS):
            raise ValidationDomainError(f"Livraison trop ancienne : {DELIVERY_DAYS} jours au plus.")
    row = FuelDelivery(vendor_id=outlet.vendor_id, outlet_id=outlet.id, fuel=fuel, liters=liters, reference=reference or None, delivered_at=when, user_id=user.id)
    db.add(row)
    detail = f"Livraison {FUEL_LABELS.get(fuel, fuel)} {format_quantity(liters)} L" + (f" (bon {reference})" if reference else "")
    log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=user, role=role, action="delivery", detail=detail)
    db.commit()
    return row


def delivery_items(db: Session, rows: Iterable[FuelDelivery]) -> list[DeliveryItem]:
    rows = list(rows)
    outlet_ids = {r.outlet_id for r in rows}
    names = {o.id: o.name for o in db.scalars(select(FuelOutlet).where(FuelOutlet.id.in_(outlet_ids))).all()} if outlet_ids else {}
    user_ids = {r.user_id for r in rows if r.user_id}
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}
    items: list[DeliveryItem] = []
    for r in rows:
        if r.fuel not in FUEL_LABELS:
            continue
        delivered = svc._aware(r.delivered_at)
        items.append(
            DeliveryItem(
                id=r.id,
                outlet_id=r.outlet_id,
                outlet_name=names.get(r.outlet_id, ""),
                fuel=r.fuel,  # type: ignore[arg-type]  # verifie juste au-dessus
                liters=r.liters,
                reference=r.reference,
                delivered_at=delivered.isoformat() if delivered else "",
                recorded_by=actor_name(users.get(r.user_id)) if r.user_id else None,
            )
        )
    return items


def recent_deliveries(db: Session, vendor_id: str, outlet_ids: list[str] | None = None, limit: int = 200) -> list[DeliveryItem]:
    stmt = select(FuelDelivery).where(FuelDelivery.vendor_id == vendor_id, FuelDelivery.delivered_at >= _since(DELIVERY_DAYS))
    if outlet_ids is not None:
        if not outlet_ids:
            return []
        stmt = stmt.where(FuelDelivery.outlet_id.in_(outlet_ids))
    return delivery_items(db, db.scalars(stmt.order_by(FuelDelivery.delivered_at.desc()).limit(limit)).all())


def deliveries_count(db: Session, vendor_id: str) -> int:
    return int(
        db.scalar(select(func.count()).select_from(FuelDelivery).where(FuelDelivery.vendor_id == vendor_id, FuelDelivery.delivered_at >= _since(DELIVERY_DAYS))) or 0
    )
