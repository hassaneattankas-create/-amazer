"""Pharmacies de garde et stations-essence : listes publiques + mise a jour par le gerant."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.cache import build_cache_key, cache_delete_prefixes, cache_get_json, cache_set_json
from app.core.crypto import decrypt_phone_value
from app.core.csrf import enforce_csrf
from app.core.deps import get_seller_user
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.fuel_history import FuelStatusChange, StationReport
from app.models.fuel_outlet import FuelOutlet
from app.models.fuel_outlet_stat import FuelOutletDailyStat
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.repositories.catalog_repository import active_subscription_clause
from app.schemas.local_services import (
    CityCount,
    FuelChangeItem,
    FuelNetworkResponse,
    FuelOutletCreate,
    FuelOutletResponse,
    FuelOutletsBulkUpdate,
    FuelOutletUpdate,
    OutletEvent,
    FuelStatusSchema,
    LocalServiceItem,
    LocalServiceListResponse,
    ServiceStatusResponse,
    ServiceStatusUpdate,
    StationReportCreate,
    StationReportItem,
)
from app.services import local_services as svc
from app.services.seller_finance_service import get_or_create_global_settings

router = APIRouter(tags=["services"])
CACHE_PREFIX = "services:"
MAX_DUTY_DAYS = 31


def invalidate_services_cache() -> None:
    cache_delete_prefixes(CACHE_PREFIX, "catalog:")


def _visible_profiles(db: Session, kind: str) -> list[SellerProfile]:
    stmt = (
        select(SellerProfile)
        .join(Vendor, Vendor.id == SellerProfile.vendor_id)
        .join(User, User.id == SellerProfile.user_id)
        .options(selectinload(SellerProfile.vendor))
        .where(SellerProfile.service_kind == kind, Vendor.is_active.is_(True), User.is_active.is_(True))
        .where(active_subscription_clause())
    )
    return list(db.scalars(stmt).all())


def build_item(profile: SellerProfile, settings: object, now: datetime) -> LocalServiceItem:
    vendor = profile.vendor
    updated = svc._aware(profile.fuel_updated_at)
    return LocalServiceItem(
        vendor_id=profile.vendor_id,
        vendor_slug=getattr(vendor, "slug", None) or profile.vendor_id,
        service_kind=profile.service_kind,
        business_name=profile.business_name,
        city=profile.city,
        address=profile.address,
        phone=decrypt_phone_value(profile.phone),
        whatsapp_contact=profile.whatsapp_contact,
        logo_url=profile.logo_url,
        is_verified=bool(profile.is_verified),
        latitude=profile.latitude,
        longitude=profile.longitude,
        maps_url=svc.maps_url(profile),
        delivery_phone=svc.delivery_phone(profile, settings, now),
        on_duty=svc.is_on_duty(profile, now),
        duty_label=svc.duty_label(profile, now),
        fuel=FuelStatusSchema(**svc.clean_fuel_status(profile.fuel_status)),
        fuel_fresh=svc.fuel_is_fresh(profile, now, svc.fresh_hours(settings)),
        fuel_updated_at=updated.isoformat() if updated else None,
    )


def build_outlet_item(profile: SellerProfile, outlet: FuelOutlet, settings: object, now: datetime, brand_outlets: int = 0) -> LocalServiceItem:
    """Une station d'une marque : ses propres ville, adresse, position et disponibilites."""
    vendor = profile.vendor
    updated = svc._aware(outlet.fuel_updated_at)
    return LocalServiceItem(
        vendor_id=profile.vendor_id,
        vendor_slug=getattr(vendor, "slug", None) or profile.vendor_id,
        service_kind="fuel_station",
        business_name=f"{profile.business_name} · {outlet.name}",
        outlet_id=outlet.id,
        brand_name=profile.business_name,
        brand_outlets=brand_outlets,
        city=outlet.city,
        address=outlet.address,
        phone=outlet.phone or decrypt_phone_value(profile.phone),
        whatsapp_contact=profile.whatsapp_contact,
        logo_url=profile.logo_url,
        is_verified=bool(profile.is_verified),
        latitude=outlet.latitude,
        longitude=outlet.longitude,
        maps_url=svc.maps_url(outlet),
        delivery_phone=svc.delivery_phone(outlet, settings, now),
        fuel=FuelStatusSchema(**svc.clean_fuel_status(outlet.fuel_status)),
        fuel_fresh=svc.fuel_is_fresh(outlet, now, svc.fresh_hours(settings)),
        fuel_updated_at=updated.isoformat() if updated else None,
    )


def active_outlets(db: Session, vendor_ids: list[str]) -> dict[str, list[FuelOutlet]]:
    grouped: dict[str, list[FuelOutlet]] = {}
    if not vendor_ids:
        return grouped
    rows = db.scalars(
        select(FuelOutlet)
        .where(FuelOutlet.vendor_id.in_(vendor_ids), FuelOutlet.is_active.is_(True))
        .order_by(FuelOutlet.sort_order, FuelOutlet.created_at)
    ).all()
    for row in rows:
        grouped.setdefault(row.vendor_id, []).append(row)
    return grouped


def _list(db: Session, kind: str, city: str | None, keep, sort_key) -> LocalServiceListResponse:
    now = datetime.now(UTC)
    settings = get_or_create_global_settings(db)
    profiles = _visible_profiles(db, kind)
    outlets = active_outlets(db, [p.vendor_id for p in profiles]) if kind == "fuel_station" else {}
    # Une marque avec des points de vente : une fiche par station ; sinon la vitrine elle-meme.
    entries: list[tuple[str | None, LocalServiceItem]] = []
    for profile in profiles:
        if outlets.get(profile.vendor_id):
            network = outlets[profile.vendor_id]
            entries.extend((o.city, build_outlet_item(profile, o, settings, now, len(network))) for o in network)
        else:
            entries.append((profile.city, build_item(profile, settings, now)))
    counts: dict[str, list] = {}
    for place, _item in entries:
        name = (place or "").strip() or "Niamey"
        entry = counts.setdefault(svc.normalize_city(name), [name, 0])
        entry[1] += 1
    wanted = svc.normalize_city(city) if city else None
    items = [item for place, item in entries if (wanted is None or svc.normalize_city(place) == wanted)]
    items = [i for i in items if keep(i)]
    items.sort(key=sort_key)
    return LocalServiceListResponse(
        items=items,
        cities=[CityCount(city=name, count=n) for name, n in sorted(counts.values(), key=lambda e: (-e[1], e[0]))],
        delivery_cities=svc.delivery_cities(settings),
        fresh_hours=svc.fresh_hours(settings),
    )


@router.get("/services/pharmacies", response_model=LocalServiceListResponse)
def list_pharmacies(
    db: Annotated[Session, Depends(get_db)],
    city: Annotated[str | None, Query(max_length=80)] = None,
    on_duty: Annotated[bool, Query()] = False,
) -> LocalServiceListResponse:
    """Pharmacies, celles de garde d'abord. on_duty=true : seulement celles de garde maintenant."""
    key = build_cache_key(CACHE_PREFIX + "pharmacies", city=svc.normalize_city(city), on_duty=on_duty)
    cached = cache_get_json(key)
    if cached is not None:
        return LocalServiceListResponse(**cached)
    response = _list(
        db,
        "pharmacy",
        city,
        keep=lambda i: i.on_duty or not on_duty,
        sort_key=lambda i: (not i.on_duty, not i.is_verified, i.business_name.lower()),
    )
    cache_set_json(key, response.model_dump(), ttl_seconds=60)
    return response


@router.get("/services/stations", response_model=LocalServiceListResponse)
def list_stations(
    db: Annotated[Session, Depends(get_db)],
    city: Annotated[str | None, Query(max_length=80)] = None,
    fuel: Annotated[Literal["super", "gasoil", "gaz"] | None, Query()] = None,
    available: Annotated[bool, Query()] = False,
) -> LocalServiceListResponse:
    """Stations : disponibles et a jour d'abord. available=true : seulement celles qui en ont (info recente)."""
    key = build_cache_key(CACHE_PREFIX + "stations", city=svc.normalize_city(city), fuel=fuel or "", available=available)
    cached = cache_get_json(key)
    if cached is not None:
        return LocalServiceListResponse(**cached)

    def has(i: LocalServiceItem) -> bool:
        if not i.fuel_fresh:
            return False
        states = i.fuel.model_dump()
        return states.get(fuel) in svc.HAS_FUEL_STATES if fuel else any(s in svc.HAS_FUEL_STATES for s in states.values())

    def recency(i: LocalServiceItem) -> float:
        return -datetime.fromisoformat(i.fuel_updated_at).timestamp() if i.fuel_updated_at else 0.0

    response = _list(
        db,
        "fuel_station",
        city,
        keep=lambda i: has(i) or not available,
        sort_key=lambda i: (not has(i), not i.fuel_fresh, recency(i), i.business_name.lower()),
    )
    # Court : une disponibilite change vite pendant une penurie.
    cache_set_json(key, response.model_dump(), ttl_seconds=30)
    return response


def _log_fuel_changes(db: Session, vendor_id: str, outlet_id: str | None, before: dict | None, after: dict | None, user_id: str) -> None:
    """Historique immuable : un enregistrement par changement reel (une simple confirmation n'en cree pas)."""
    for fuel, old, new in svc.fuel_changes(before, after):
        db.add(FuelStatusChange(vendor_id=vendor_id, outlet_id=outlet_id, fuel=fuel, old_state=old, new_state=new, user_id=user_id))


def _own_profile(db: Session, user: User) -> SellerProfile:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    if profile is None:
        raise NotFoundError("Profil vendeur introuvable.")
    return profile


def _status(profile: SellerProfile, settings: object) -> ServiceStatusResponse:
    now = datetime.now(UTC)
    updated = svc._aware(profile.fuel_updated_at)
    return ServiceStatusResponse(
        service_kind=profile.service_kind if profile.service_kind in svc.SERVICE_KINDS else None,
        on_duty=bool(profile.on_duty),
        on_duty_now=svc.is_on_duty(profile, now),
        duty_start=profile.duty_start,
        duty_end=profile.duty_end,
        duty_label=svc.duty_label(profile, now),
        fuel=FuelStatusSchema(**svc.clean_fuel_status(profile.fuel_status)),
        fuel_fresh=svc.fuel_is_fresh(profile, now, svc.fresh_hours(settings)),
        fuel_updated_at=updated.isoformat() if updated else None,
        latitude=profile.latitude,
        longitude=profile.longitude,
        maps_url=svc.maps_url(profile),
        delivery_phone=svc.delivery_phone(profile, settings, now),
    )


@router.get("/seller/service-status", response_model=ServiceStatusResponse)
def get_service_status(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> ServiceStatusResponse:
    return _status(_own_profile(db, current_user), get_or_create_global_settings(db))


@router.put("/seller/service-status", response_model=ServiceStatusResponse)
def update_service_status(
    payload: ServiceStatusUpdate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> ServiceStatusResponse:
    """De garde (pharmacie), disponibilites (station) et position sur place."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"service-status:{current_user.id}", limit=60, window_seconds=600)
    profile = _own_profile(db, current_user)
    kind = profile.service_kind
    if kind not in svc.SERVICE_KINDS:
        raise ForbiddenError("Cette vitrine n'est ni une pharmacie ni une station. Contactez AMAZER pour l'activer.")
    now = datetime.now(UTC)

    duty_fields = payload.on_duty is not None or payload.duty_start or payload.duty_end or payload.clear_duty_period
    if duty_fields and kind != "pharmacy":
        raise ValidationDomainError("La garde ne concerne que les pharmacies.")
    if payload.fuel is not None and kind != "fuel_station":
        raise ValidationDomainError("Les disponibilités de carburant ne concernent que les stations.")

    if payload.on_duty is not None:
        profile.on_duty = payload.on_duty
        profile.duty_updated_at = now
    if payload.clear_duty_period:
        profile.duty_start = profile.duty_end = None
        profile.duty_updated_at = now
    elif payload.duty_start or payload.duty_end:
        if not (payload.duty_start and payload.duty_end):
            raise ValidationDomainError("Indiquez la date de début et la date de fin de la garde.")
        if payload.duty_end < payload.duty_start:
            raise ValidationDomainError("La date de fin doit être après la date de début.")
        if payload.duty_end < svc.niamey_today(now):
            raise ValidationDomainError("Cette période de garde est déjà terminée.")
        if payload.duty_end - payload.duty_start > timedelta(days=MAX_DUTY_DAYS):
            raise ValidationDomainError(f"Une période de garde ne peut pas dépasser {MAX_DUTY_DAYS} jours.")
        profile.duty_start, profile.duty_end = payload.duty_start, payload.duty_end
        profile.duty_updated_at = now

    if payload.fuel is not None:
        before = svc.clean_fuel_status(profile.fuel_status)
        merged = dict(before)
        merged.update({k: v for k, v in payload.fuel.model_dump().items() if v is not None})
        profile.fuel_status = svc.clean_fuel_status(merged)
        _log_fuel_changes(db, profile.vendor_id, None, before, profile.fuel_status, current_user.id)
        # Meme sans changement, confirmer remet l'information « a jour ».
        profile.fuel_updated_at = now

    if payload.latitude is not None or payload.longitude is not None:
        if not svc.valid_position(payload.latitude, payload.longitude):
            raise ValidationDomainError("Position introuvable au Niger. Activez la localisation et réessayez sur place.")
        profile.latitude, profile.longitude = payload.latitude, payload.longitude

    db.commit()
    invalidate_services_cache()
    return _status(profile, get_or_create_global_settings(db))



# ---------------------------------------------------------------- points de vente (marques)
MAX_OUTLETS = 300


def _station_profile(db: Session, user: User) -> SellerProfile:
    profile = _own_profile(db, user)
    if profile.service_kind != "fuel_station":
        raise ForbiddenError("Seules les stations-essence peuvent gérer des points de vente.")
    return profile


def _outlet_stats(db: Session, outlet_ids: list[str], now: datetime) -> dict[str, tuple[int, int, int]]:
    if not outlet_ids:
        return {}
    since = svc.niamey_today(now) - timedelta(days=29)
    totals: dict[str, list[int]] = {}
    for row in db.scalars(
        select(FuelOutletDailyStat).where(FuelOutletDailyStat.outlet_id.in_(outlet_ids), FuelOutletDailyStat.day >= since)
    ).all():
        entry = totals.setdefault(row.outlet_id, [0, 0, 0])
        entry[0] += row.calls
        entry[1] += row.routes
        entry[2] += row.gas_orders
    return {key: (v[0], v[1], v[2]) for key, v in totals.items()}


def _outlet_response(outlet: FuelOutlet, settings: object, now: datetime, stats: tuple[int, int, int] = (0, 0, 0)) -> FuelOutletResponse:
    updated = svc._aware(outlet.fuel_updated_at)
    return FuelOutletResponse(
        id=outlet.id,
        name=outlet.name,
        city=outlet.city,
        address=outlet.address,
        phone=outlet.phone,
        is_active=bool(outlet.is_active),
        latitude=outlet.latitude,
        longitude=outlet.longitude,
        maps_url=svc.maps_url(outlet),
        delivery_phone=svc.delivery_phone(outlet, settings, now),
        fuel=FuelStatusSchema(**svc.clean_fuel_status(outlet.fuel_status)),
        fuel_fresh=svc.fuel_is_fresh(outlet, now, svc.fresh_hours(settings)),
        fuel_updated_at=updated.isoformat() if updated else None,
        calls_30d=stats[0],
        routes_30d=stats[1],
        gas_orders_30d=stats[2],
    )


def _own_outlet(db: Session, profile: SellerProfile, outlet_id: str) -> FuelOutlet:
    outlet = db.get(FuelOutlet, outlet_id)
    if outlet is None or outlet.vendor_id != profile.vendor_id:
        raise NotFoundError("Point de vente introuvable.")
    return outlet


@router.get("/seller/fuel-outlets", response_model=list[FuelOutletResponse])
def list_my_outlets(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[FuelOutletResponse]:
    profile = _station_profile(db, current_user)
    now, settings = datetime.now(UTC), get_or_create_global_settings(db)
    rows = db.scalars(
        select(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id).order_by(FuelOutlet.sort_order, FuelOutlet.created_at)
    ).all()
    stats = _outlet_stats(db, [o.id for o in rows], now)
    return [_outlet_response(o, settings, now, stats.get(o.id, (0, 0, 0))) for o in rows]


@router.get("/seller/fuel-network", response_model=FuelNetworkResponse)
def my_fuel_network(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> FuelNetworkResponse:
    """Resume du reseau : prix de l'abonnement (inclus, en plus, forfait, negocie) et etat des stations."""
    from app.services.fuel_network_pricing import fuel_base_fee, price_for
    from app.services.seller_finance_service import _base_subscription_fee_for_profile

    profile = _station_profile(db, current_user)
    now, settings = datetime.now(UTC), get_or_create_global_settings(db)
    active = db.scalars(select(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id, FuelOutlet.is_active.is_(True))).all()
    saved_kind = profile.service_kind
    try:
        # Abonnement de base (sans les stations) pour detailler le calcul.
        profile.service_kind = None
        base = _base_subscription_fee_for_profile(settings, profile)
    finally:
        profile.service_kind = saved_kind
    price = price_for(settings, fuel_base_fee(settings, base), len(active))
    negotiated = profile.seller_subscription_fee_override
    return FuelNetworkResponse(
        **price.__dict__,
        negotiated=float(negotiated) if negotiated is not None else None,
        with_gas=sum(1 for o in active if svc.has_fuel(o, "gaz", now, svc.fresh_hours(settings))),
        to_confirm=sum(1 for o in active if not svc.fuel_is_fresh(o, now, svc.fresh_hours(settings))),
    )


@router.put("/seller/fuel-outlets/bulk", response_model=list[FuelOutletResponse])
def bulk_update_outlets(
    payload: FuelOutletsBulkUpdate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[FuelOutletResponse]:
    """Toutes les stations (ou celles d'une ville) en un geste : meme disponibilite, ou « rien n'a change »."""
    enforce_csrf(request)
    profile = _station_profile(db, current_user)
    if payload.fuel is None and not payload.confirm:
        raise ValidationDomainError("Indiquez une disponibilité ou confirmez les informations.")
    now = datetime.now(UTC)
    stmt = select(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id, FuelOutlet.is_active.is_(True))
    rows = [o for o in db.scalars(stmt).all() if not payload.city or svc.normalize_city(o.city) == svc.normalize_city(payload.city)]
    changes = {k: v for k, v in payload.fuel.model_dump().items() if v is not None} if payload.fuel else {}
    for outlet in rows:
        before = svc.clean_fuel_status(outlet.fuel_status)
        merged = dict(before)
        merged.update(changes)
        outlet.fuel_status = svc.clean_fuel_status(merged)
        _log_fuel_changes(db, profile.vendor_id, outlet.id, before, outlet.fuel_status, current_user.id)
        outlet.fuel_updated_at = now
    db.commit()
    invalidate_services_cache()
    return list_my_outlets(db, current_user)


@router.post("/services/outlets/{outlet_id}/event", status_code=204, response_model=None)
def record_outlet_event(
    outlet_id: str,
    payload: OutletEvent,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """Compte un appel, un itineraire ou une commande de gaz (statistiques de la station, sans donnee personnelle)."""
    enforce_rate_limit(request, key="outlet-event", limit=60, window_seconds=600)
    outlet = db.get(FuelOutlet, outlet_id)
    if outlet is None or not outlet.is_active:
        return
    day = svc.niamey_today()
    row = db.get(FuelOutletDailyStat, (outlet_id, day))
    if row is None:
        row = FuelOutletDailyStat(outlet_id=outlet_id, day=day, calls=0, routes=0, gas_orders=0)
        db.add(row)
    column = {"call": "calls", "route": "routes", "gas": "gas_orders"}[payload.kind]
    setattr(row, column, (getattr(row, column) or 0) + 1)
    db.commit()


@router.post("/seller/fuel-outlets", response_model=FuelOutletResponse, status_code=201)
def create_outlet(
    payload: FuelOutletCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> FuelOutletResponse:
    enforce_csrf(request)
    profile = _station_profile(db, current_user)
    count = len(db.scalars(select(FuelOutlet.id).where(FuelOutlet.vendor_id == profile.vendor_id)).all())
    if count >= MAX_OUTLETS:
        raise ValidationDomainError(f"{MAX_OUTLETS} points de vente au maximum.")
    outlet = FuelOutlet(
        vendor_id=profile.vendor_id,
        name=payload.name,
        city=payload.city,
        address=payload.address or None,
        phone=payload.phone or None,
        sort_order=count,
    )
    db.add(outlet)
    db.commit()
    invalidate_services_cache()
    return _outlet_response(outlet, get_or_create_global_settings(db), datetime.now(UTC))


@router.put("/seller/fuel-outlets/{outlet_id}", response_model=FuelOutletResponse)
def update_outlet(
    outlet_id: str,
    payload: FuelOutletUpdate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> FuelOutletResponse:
    """Coordonnees, ouverture, disponibilites (en un geste) et position d'un point de vente."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"fuel-outlet:{current_user.id}", limit=240, window_seconds=600)
    profile = _station_profile(db, current_user)
    outlet = _own_outlet(db, profile, outlet_id)
    now = datetime.now(UTC)
    for field in ("name", "city", "address", "phone", "is_active"):
        value = getattr(payload, field)
        if value is not None:
            setattr(outlet, field, value or (None if field in ("address", "phone") else value))
    if payload.fuel is not None:
        before = svc.clean_fuel_status(outlet.fuel_status)
        merged = dict(before)
        merged.update({k: v for k, v in payload.fuel.model_dump().items() if v is not None})
        outlet.fuel_status = svc.clean_fuel_status(merged)
        _log_fuel_changes(db, profile.vendor_id, outlet.id, before, outlet.fuel_status, current_user.id)
        outlet.fuel_updated_at = now
    if payload.latitude is not None or payload.longitude is not None:
        if not svc.valid_position(payload.latitude, payload.longitude):
            raise ValidationDomainError("Position introuvable au Niger. Activez la localisation et réessayez sur place.")
        outlet.latitude, outlet.longitude = payload.latitude, payload.longitude
    db.commit()
    invalidate_services_cache()
    return _outlet_response(outlet, get_or_create_global_settings(db), now)


@router.delete("/seller/fuel-outlets/{outlet_id}", status_code=204, response_model=None)
def delete_outlet(
    outlet_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> None:
    enforce_csrf(request)
    profile = _station_profile(db, current_user)
    db.delete(_own_outlet(db, profile, outlet_id))
    db.commit()
    invalidate_services_cache()


# ---------------------------------------------------------------- historique et signalements
HISTORY_DAYS = 30


def _outlet_names(db: Session, ids: set[str]) -> dict[str, str]:
    if not ids:
        return {}
    return {o.id: o.name for o in db.scalars(select(FuelOutlet).where(FuelOutlet.id.in_(ids))).all()}


@router.get("/seller/fuel-history", response_model=list[FuelChangeItem])
def my_fuel_history(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[FuelChangeItem]:
    """Changements de disponibilite des 30 derniers jours (les plus recents d'abord)."""
    profile = _own_profile(db, current_user)
    if profile.service_kind != "fuel_station":
        raise ForbiddenError("L'historique des carburants ne concerne que les stations.")
    since = datetime.now(UTC) - timedelta(days=HISTORY_DAYS)
    rows = db.scalars(
        select(FuelStatusChange)
        .where(FuelStatusChange.vendor_id == profile.vendor_id, FuelStatusChange.created_at >= since)
        .order_by(FuelStatusChange.created_at.desc())
        .limit(200)
    ).all()
    names = _outlet_names(db, {r.outlet_id for r in rows if r.outlet_id})
    return [
        FuelChangeItem(
            outlet_id=r.outlet_id,
            outlet_name=names.get(r.outlet_id) if r.outlet_id else None,
            fuel=r.fuel,
            old_state=r.old_state if r.old_state in svc.FUEL_STATES else None,
            new_state=r.new_state,
            created_at=svc._aware(r.created_at).isoformat(),
        )
        for r in rows
        if r.new_state in svc.FUEL_STATES and r.fuel in svc.FUELS
    ]


@router.post("/services/report", status_code=204, response_model=None)
def report_station(
    payload: StationReportCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """« Information incorrecte » signalee par un client ; la station la voit dans son espace."""
    enforce_rate_limit(request, key="station-report", limit=10, window_seconds=3600)
    vendor = db.get(Vendor, payload.vendor_id)
    if vendor is None:
        raise NotFoundError("Station introuvable.")
    outlet_id = None
    if payload.outlet_id:
        outlet = db.get(FuelOutlet, payload.outlet_id)
        if outlet is None or outlet.vendor_id != vendor.id:
            raise NotFoundError("Station introuvable.")
        outlet_id = outlet.id
    db.add(StationReport(vendor_id=vendor.id, outlet_id=outlet_id, kind=payload.kind, comment=payload.comment or None))
    db.commit()


@router.get("/seller/station-reports", response_model=list[StationReportItem])
def my_station_reports(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[StationReportItem]:
    """Signalements des clients des 30 derniers jours."""
    profile = _own_profile(db, current_user)
    since = datetime.now(UTC) - timedelta(days=HISTORY_DAYS)
    rows = db.scalars(
        select(StationReport)
        .where(StationReport.vendor_id == profile.vendor_id, StationReport.created_at >= since)
        .order_by(StationReport.created_at.desc())
        .limit(100)
    ).all()
    names = _outlet_names(db, {r.outlet_id for r in rows if r.outlet_id})
    return [
        StationReportItem(
            outlet_id=r.outlet_id,
            outlet_name=names.get(r.outlet_id) if r.outlet_id else None,
            kind=r.kind,
            comment=r.comment,
            created_at=svc._aware(r.created_at).isoformat(),
        )
        for r in rows
    ]
