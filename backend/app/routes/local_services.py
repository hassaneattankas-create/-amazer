"""Pharmacies de garde et stations-essence : listes publiques + mise a jour par le gerant."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.cache import build_cache_key, cache_delete_prefixes, cache_get_json, cache_set_json
from app.core.crypto import decrypt_phone_value
from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user, get_seller_user
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.fuel_history import FuelStatusChange, StationReport
from app.models.fuel_outlet import FuelOutlet, FuelOutletManager, FuelRegionManager
from app.models.fuel_outlet_stat import FuelOutletDailyStat
from app.models.official_list import OfficialList
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.repositories.catalog_repository import active_subscription_clause
from app.schemas.local_services import (
    PharmacyDutyItem,
    PharmacyDutyResponse,
    PharmacyDutyWeek,
    CityCount,
    DashboardCity,
    DashboardOutage,
    DashboardStation,
    FuelDashboardResponse,
    FuelPlanResponse,
    FuelChangeItem,
    FuelManagerCreate,
    FuelManagerItem,
    FuelNetworkResponse,
    FuelOutletCreate,
    FuelOutletResponse,
    FuelOutletsBulkUpdate,
    FuelOutletUpdate,
    OutletEvent,
    FuelStatusSchema,
    LocalServiceItem,
    LocalServiceListResponse,
    ManagedFuelUpdate,
    ManagedOutlet,
    RegionManagerCreate,
    RegionManagerItem,
    ServiceStatusResponse,
    ServiceStatusUpdate,
    StationManagerRef,
    StationReportCreate,
    StationReportItem,
)
from app.services import local_services as svc
from app.services import pharmacy_duty_service as duty_svc
from app.services import station_access as sa
from app.services.fuel_plan import PLAN_NAMES, FuelPlan, fuel_plan
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
        opening_hours=outlet.opening_hours,
        services=sa.clean_services(outlet.services),
        on_duty=svc.outlet_on_duty(outlet, now),
        duty_label=svc.outlet_duty_label(outlet, now),
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
    official = duty_svc.official_duty(db)

    def mark(i: LocalServiceItem) -> LocalServiceItem:
        # Pharmacie inscrite présente sur la liste officielle de la semaine : de garde sans rien faire.
        if not i.on_duty:
            for name, ends in official.get(svc.normalize_city(i.city or "Niamey"), []):
                if duty_svc.same_name(name, i.business_name):
                    i.on_duty, i.duty_label = True, f"De garde {duty_svc.until_label(ends)}"
                    break
        return i

    response = _list(
        db,
        "pharmacy",
        city,
        keep=lambda i: mark(i).on_duty or not on_duty,
        sort_key=lambda i: (not i.on_duty, not i.is_verified, i.business_name.lower()),
    )
    cache_set_json(key, response.model_dump(), ttl_seconds=60)
    return response


def _duty_week(week: duty_svc.BoardWeek | None) -> PharmacyDutyWeek | None:
    if week is None:
        return None
    return PharmacyDutyWeek(
        title=week.title,
        source=week.source,
        starts_at=week.starts_at.isoformat(),
        ends_at=week.ends_at.isoformat(),
        period_label=duty_svc.period_label(week.starts_at, week.ends_at),
        until_label=duty_svc.until_label(week.ends_at),
        items=[PharmacyDutyItem(**vars(i)) for i in week.items],
    )


@router.get("/services/pharmacy-duty", response_model=PharmacyDutyResponse)
def pharmacy_duty(
    db: Annotated[Session, Depends(get_db)],
    city: Annotated[str, Query(min_length=2, max_length=80)] = "Niamey",
) -> PharmacyDutyResponse:
    """Pharmacies de garde de la ville : liste officielle de la semaine (et la suivante si publiée) + gardes déclarées."""
    key = build_cache_key(CACHE_PREFIX + "pharmacy-duty", city=svc.normalize_city(city))
    cached = cache_get_json(key)
    if cached is not None:
        return PharmacyDutyResponse(**cached)
    profiles = _visible_profiles(db, "pharmacy")
    current, upcoming, declared = duty_svc.board(db, city, profiles, decrypt_phone_value)
    names = {(row.city or "").strip() for row in db.scalars(select(OfficialList).where(OfficialList.kind == "pharmacy_duty")).all()}
    names.update((p.city or "").strip() for p in profiles)
    cities = sorted({n for n in names if n}, key=lambda n: (svc.normalize_city(n) != "niamey", n))
    response = PharmacyDutyResponse(
        city=city.strip(),
        cities=cities or ["Niamey"],
        current=_duty_week(current),
        next=_duty_week(upcoming),
        declared=[PharmacyDutyItem(**vars(i)) for i in declared],
    )
    cache_set_json(key, response.model_dump(), ttl_seconds=60)
    return response


@router.get("/services/stations", response_model=LocalServiceListResponse)
def list_stations(
    db: Annotated[Session, Depends(get_db)],
    city: Annotated[str | None, Query(max_length=80)] = None,
    fuel: Annotated[Literal["super", "gasoil", "gaz"] | None, Query()] = None,
    available: Annotated[bool, Query()] = False,
    on_duty: Annotated[bool, Query()] = False,
) -> LocalServiceListResponse:
    """Stations : disponibles et a jour d'abord. available=true : seulement celles qui en ont (info recente).

    on_duty=true : seulement les stations de garde maintenant.
    """
    key = build_cache_key(CACHE_PREFIX + "stations", city=svc.normalize_city(city), fuel=fuel or "", available=available, on_duty=on_duty)
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
        keep=lambda i: (has(i) or not available) and (i.on_duty or not on_duty),
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


def _status(profile: SellerProfile, settings: object, db: Session | None = None) -> ServiceStatusResponse:
    now = datetime.now(UTC)
    updated = svc._aware(profile.fuel_updated_at)
    official_end = duty_svc.official_end_for(profile, duty_svc.official_duty(db, now)) if db is not None and profile.service_kind == "pharmacy" else None
    official_label = f"Votre pharmacie est sur la liste officielle de garde, {duty_svc.until_label(official_end)}." if official_end else None
    return ServiceStatusResponse(
        service_kind=profile.service_kind if profile.service_kind in svc.SERVICE_KINDS else None,
        on_duty=bool(profile.on_duty),
        on_duty_now=svc.is_on_duty(profile, now) or official_end is not None,
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
        official_duty_label=official_label,
    )


@router.get("/seller/service-status", response_model=ServiceStatusResponse)
def get_service_status(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> ServiceStatusResponse:
    return _status(_own_profile(db, current_user), get_or_create_global_settings(db), db)


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
        sa.log_fuel_activity(db, vendor_id=profile.vendor_id, outlet=None, user=current_user, role="owner", before=before, after=profile.fuel_status, city=profile.city)
        # Meme sans changement, confirmer remet l'information « a jour ».
        profile.fuel_updated_at = now

    if payload.latitude is not None or payload.longitude is not None:
        if not svc.valid_position(payload.latitude, payload.longitude):
            raise ValidationDomainError("Position introuvable au Niger. Activez la localisation et réessayez sur place.")
        profile.latitude, profile.longitude = payload.latitude, payload.longitude
        if kind == "fuel_station":
            sa.log_activity(
                db, vendor_id=profile.vendor_id, outlet=None, user=current_user, role="owner", action="position",
                detail=f"Position enregistrée : {payload.latitude:.5f}, {payload.longitude:.5f}", city=profile.city,
            )

    db.commit()
    invalidate_services_cache()
    return _status(profile, get_or_create_global_settings(db), db)



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


def _outlet_response(
    outlet: FuelOutlet,
    settings: object,
    now: datetime,
    stats: tuple[int, int, int] = (0, 0, 0),
    managers: list[StationManagerRef] | None = None,
    open_reports: int = 0,
) -> FuelOutletResponse:
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
        info=sa.station_info(outlet),
        managers=managers or [],
        open_reports=open_reports,
    )


def _single_outlet_response(db: Session, outlet: FuelOutlet, now: datetime) -> FuelOutletResponse:
    stats = _outlet_stats(db, [outlet.id], now).get(outlet.id, (0, 0, 0))
    managers = sa.manager_refs(db, [outlet.id]).get(outlet.id, [])
    reports = sa.open_report_counts(db, [outlet.id], now).get(outlet.id, 0)
    return _outlet_response(outlet, get_or_create_global_settings(db), now, stats, managers, reports)


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
    ids = [o.id for o in rows]
    stats = _outlet_stats(db, ids, now)
    managers = sa.manager_refs(db, ids)
    reports = sa.open_report_counts(db, ids, now)
    return [_outlet_response(o, settings, now, stats.get(o.id, (0, 0, 0)), managers.get(o.id, []), reports.get(o.id, 0)) for o in rows]


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
        # Une ligne de journal par station : chaque niveau (ville, gerant) voit ce qui a change chez lui.
        sa.log_fuel_activity(db, vendor_id=profile.vendor_id, outlet=outlet, user=current_user, role="owner", before=before, after=outlet.fuel_status)
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
    db.flush()
    sa.log_activity(db, vendor_id=profile.vendor_id, outlet=outlet, user=current_user, role="owner", action="outlet_created", detail=f"Station ajoutée à {outlet.city}")
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
    # Fiche (adresse, telephone, horaires, services, position) : verifiee avant toute modification.
    touched, changed, moved = sa.apply_info_update(outlet, payload, now)
    renamed = []
    if payload.name is not None and payload.name != outlet.name:
        renamed.append(f"Nom : {payload.name}")
        outlet.name = payload.name
    if payload.city is not None and payload.city != outlet.city:
        renamed.append(f"Ville : {payload.city}")
        outlet.city = payload.city
    if renamed:
        sa.log_activity(db, vendor_id=profile.vendor_id, outlet=outlet, user=current_user, role="owner", action="info", detail=" · ".join(renamed))
    sa.log_info_activity(db, outlet, current_user, "owner", touched, changed, moved)
    if payload.is_active is not None and payload.is_active != bool(outlet.is_active):
        outlet.is_active = payload.is_active
        sa.log_activity(db, vendor_id=profile.vendor_id, outlet=outlet, user=current_user, role="owner", action="outlet_opened" if payload.is_active else "outlet_closed")
    if payload.fuel is not None:
        before = svc.clean_fuel_status(outlet.fuel_status)
        merged = dict(before)
        merged.update({k: v for k, v in payload.fuel.model_dump().items() if v is not None})
        outlet.fuel_status = svc.clean_fuel_status(merged)
        _log_fuel_changes(db, profile.vendor_id, outlet.id, before, outlet.fuel_status, current_user.id)
        sa.log_fuel_activity(db, vendor_id=profile.vendor_id, outlet=outlet, user=current_user, role="owner", before=before, after=outlet.fuel_status)
        outlet.fuel_updated_at = now
    db.commit()
    invalidate_services_cache()
    return _single_outlet_response(db, outlet, now)


@router.delete("/seller/fuel-outlets/{outlet_id}", status_code=204, response_model=None)
def delete_outlet(
    outlet_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> None:
    enforce_csrf(request)
    profile = _station_profile(db, current_user)
    # Derniere station supprimee : la disponibilite de la marque repart de zero (aucune ancienne donnee ne revient).
    sa.delete_outlet(db, _own_outlet(db, profile, outlet_id), current_user, "owner")
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
    sa.notify_station_report(db, vendor.id, outlet_id)
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
    return sa.report_items(db, rows)


# ---------------------------------------------------------------- gerants de station
MAX_MANAGERS_PER_OUTLET = sa.MAX_MANAGERS_PER_OUTLET


def _brand_can_publish(db: Session, vendor_id: str, now: datetime) -> bool:
    """Abonnement de la marque en cours : sinon les mises a jour des gerants sont suspendues."""
    return sa.brand_can_publish(db, vendor_id, now)


def _manager_items(db: Session, vendor_id: str) -> list[FuelManagerItem]:
    rows = db.execute(
        select(FuelOutletManager, FuelOutlet.name, User.email, User.full_name)
        .join(FuelOutlet, FuelOutlet.id == FuelOutletManager.outlet_id)
        .join(User, User.id == FuelOutletManager.user_id)
        .where(FuelOutletManager.vendor_id == vendor_id)
        .order_by(FuelOutlet.sort_order, FuelOutletManager.created_at)
    ).all()
    return [FuelManagerItem(id=m.id, outlet_id=m.outlet_id, outlet_name=name, email=email, full_name=full_name) for m, name, email, full_name in rows]


@router.get("/seller/fuel-managers", response_model=list[FuelManagerItem])
def list_fuel_managers(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[FuelManagerItem]:
    return _manager_items(db, _station_profile(db, current_user).vendor_id)


@router.post("/seller/fuel-managers", response_model=list[FuelManagerItem], status_code=201)
def add_fuel_manager(
    payload: FuelManagerCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[FuelManagerItem]:
    """Confie une station a un compte AMAZER existant (le gerant cree d'abord son compte gratuit)."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"fuel-manager:{current_user.id}", limit=30, window_seconds=600)
    profile = _station_profile(db, current_user)
    outlet = _own_outlet(db, profile, payload.outlet_id)
    sa.assign_manager(db, outlet=outlet, email=payload.email, actor=current_user, role="owner", brand_name=profile.business_name)
    return _manager_items(db, profile.vendor_id)


@router.delete("/seller/fuel-managers/{manager_id}", status_code=204, response_model=None)
def remove_fuel_manager(
    manager_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> None:
    enforce_csrf(request)
    profile = _station_profile(db, current_user)
    row = db.get(FuelOutletManager, manager_id)
    if row is None or row.vendor_id != profile.vendor_id:
        raise NotFoundError("Gérant introuvable.")
    sa.remove_manager(db, row, current_user, "owner")


def _region_access(db: Session, user: User) -> dict[str, set[str]]:
    """Villes confiees a ce compte, par marque (a tous les paliers : le proprietaire delegue ses villes)."""
    return {vendor_id: set(cities) for vendor_id, cities in sa.region_cities(db, user).items()}


def _managed_outlet(db: Session, user: User, outlet_id: str) -> tuple[FuelOutlet, sa.Role]:
    """Station accessible a ce compte (proprietaire, ville ou gerant) : jamais celle d'une autre marque."""
    return sa.require_station(db, user, outlet_id)


def _brand_state(db: Session, vendor_id: str, now: datetime) -> tuple[str, bool]:
    """(nom de la marque, abonnement en cours) : une lecture par marque."""
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
    return (profile.business_name if profile is not None else "", _brand_can_publish(db, vendor_id, now))


def _managed_response(
    db: Session,
    outlet: FuelOutlet,
    settings: object,
    now: datetime,
    via_region: str | None = None,
    role: sa.Role = "manager",
    open_reports: int | None = None,
    brand: tuple[str, bool] | None = None,
) -> ManagedOutlet:
    """brand = (nom de la marque, abonnement en cours) deja calcule pour une liste ; sinon lu ici."""
    if brand is None:
        brand = _brand_state(db, outlet.vendor_id, now)
    brand_name, can_publish = brand
    updated = svc._aware(outlet.fuel_updated_at)
    hours = svc.fresh_hours(settings)
    return ManagedOutlet(
        id=outlet.id,
        name=outlet.name,
        brand_name=brand_name,
        city=outlet.city,
        fuel=FuelStatusSchema(**svc.clean_fuel_status(outlet.fuel_status)),
        fuel_fresh=svc.fuel_is_fresh(outlet, now, hours),
        fuel_updated_at=updated.isoformat() if updated else None,
        can_update=bool(outlet.is_active) and can_publish,
        can_resolve=can_publish,
        fresh_hours=hours,
        via_region=via_region,
        info=sa.station_info(outlet),
        open_reports=open_reports if open_reports is not None else sa.open_report_counts(db, [outlet.id], now).get(outlet.id, 0),
        role=role,
    )


@router.get("/station-manager/outlets", response_model=list[ManagedOutlet])
def my_managed_outlets(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ManagedOutlet]:
    now, settings = datetime.now(UTC), get_or_create_global_settings(db)
    rows = db.scalars(
        select(FuelOutlet)
        .join(FuelOutletManager, FuelOutletManager.outlet_id == FuelOutlet.id)
        .where(FuelOutletManager.user_id == current_user.id)
        .order_by(FuelOutlet.name)
    ).all()
    regions = _region_access(db, current_user)

    def role_of(outlet: FuelOutlet) -> sa.Role:
        return "city" if svc.normalize_city(outlet.city) in regions.get(outlet.vendor_id, set()) else "manager"

    listed: list[tuple[FuelOutlet, str | None]] = [(o, None) for o in rows]
    seen = {o.id for o in rows}
    for vendor_id, cities in regions.items():
        for outlet in db.scalars(select(FuelOutlet).where(FuelOutlet.vendor_id == vendor_id).order_by(FuelOutlet.name)).all():
            if outlet.id not in seen and svc.normalize_city(outlet.city) in cities:
                seen.add(outlet.id)
                listed.append((outlet, outlet.city))
    reports = sa.open_report_counts(db, list(seen), now)
    brands: dict[str, tuple[str, bool]] = {}
    for o, _via in listed:
        if o.vendor_id not in brands:
            brands[o.vendor_id] = _brand_state(db, o.vendor_id, now)
    return [
        _managed_response(db, o, settings, now, via_region=via, role=role_of(o), open_reports=reports.get(o.id, 0), brand=brands[o.vendor_id])
        for o, via in listed
    ]


@router.put("/station-manager/outlets/{outlet_id}", response_model=ManagedOutlet)
def update_managed_outlet(
    outlet_id: str,
    payload: ManagedFuelUpdate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ManagedOutlet:
    """Le gerant change les disponibilites (ou confirme « rien n'a change ») de SA station, rien d'autre."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-manager:{current_user.id}", limit=120, window_seconds=600)
    outlet, role = _managed_outlet(db, current_user, outlet_id)
    now = datetime.now(UTC)
    if not _brand_can_publish(db, outlet.vendor_id, now) or (role != "owner" and not outlet.is_active):
        raise ForbiddenError("Mises à jour suspendues : la station est fermée ou l'abonnement de la marque a expiré.")
    if payload.fuel is None and not payload.confirm:
        raise ValidationDomainError("Indiquez une disponibilité ou confirmez les informations.")
    before = svc.clean_fuel_status(outlet.fuel_status)
    if payload.fuel is not None:
        merged = dict(before)
        merged.update({k: v for k, v in payload.fuel.model_dump().items() if v is not None})
        outlet.fuel_status = svc.clean_fuel_status(merged)
        _log_fuel_changes(db, outlet.vendor_id, outlet.id, before, outlet.fuel_status, current_user.id)
    elif not outlet.fuel_status:
        raise ValidationDomainError("Indiquez d'abord les disponibilités de la station.")
    sa.log_fuel_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=current_user, role=role, before=before, after=outlet.fuel_status)
    outlet.fuel_updated_at = now
    db.commit()
    invalidate_services_cache()
    return _managed_response(db, outlet, get_or_create_global_settings(db), now, via_region=outlet.city if role == "city" else None, role=role)


# ---------------------------------------------------------------- paliers : tableau de bord, regions, export
LONG_OUTAGE_HOURS = 24


def _plan_or_forbid(db: Session, profile: SellerProfile, settings: object, need: int) -> FuelPlan:
    plan = fuel_plan(db, profile, settings)
    if plan.level < need:
        threshold = plan.network_from if need == 2 else plan.enterprise_from
        raise ForbiddenError(f"Réservé au palier {PLAN_NAMES[need]} (à partir de {threshold} stations).")
    return plan


@router.get("/seller/fuel-plan", response_model=FuelPlanResponse)
def my_fuel_plan(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> FuelPlanResponse:
    profile = _station_profile(db, current_user)
    plan = fuel_plan(db, profile, get_or_create_global_settings(db))
    return FuelPlanResponse(
        level=plan.level,
        name=plan.name,
        stations=plan.stations,
        network_from=plan.network_from,
        enterprise_from=plan.enterprise_from,
        network_tools=plan.network_tools,
        export=plan.export,
    )


@router.get("/seller/fuel-dashboard", response_model=FuelDashboardResponse)
def my_fuel_dashboard(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> FuelDashboardResponse:
    """Vue reseau (tous paliers) : stations a relancer, ruptures longues, villes, trafic, signalements."""
    profile = _station_profile(db, current_user)
    settings = get_or_create_global_settings(db)
    now, hours = datetime.now(UTC), svc.fresh_hours(settings)
    outlets = db.scalars(
        select(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id, FuelOutlet.is_active.is_(True)).order_by(FuelOutlet.name)
    ).all()
    managed = set(db.scalars(select(FuelOutletManager.outlet_id).where(FuelOutletManager.vendor_id == profile.vendor_id)).all())
    city_managers: dict[str, list[str]] = {}
    for region, email, full_name in db.execute(
        select(FuelRegionManager, User.email, User.full_name)
        .join(User, User.id == FuelRegionManager.user_id)
        .where(FuelRegionManager.vendor_id == profile.vendor_id)
        .order_by(FuelRegionManager.created_at)
    ).all():
        city_managers.setdefault(svc.normalize_city(region.city), []).append((full_name or "").strip() or email)
    stats = _outlet_stats(db, [o.id for o in outlets], now)
    # Date du dernier passage en rupture, par station et carburant.
    last_out: dict[tuple[str, str], datetime] = {}
    for outlet_id, fuel, when in db.execute(
        select(FuelStatusChange.outlet_id, FuelStatusChange.fuel, func.max(FuelStatusChange.created_at))
        .where(FuelStatusChange.vendor_id == profile.vendor_id, FuelStatusChange.new_state == "out", FuelStatusChange.outlet_id.is_not(None))
        .group_by(FuelStatusChange.outlet_id, FuelStatusChange.fuel)
    ).all():
        last_out[(outlet_id, fuel)] = svc._aware(when)

    stale: list[DashboardStation] = []
    outages: list[DashboardOutage] = []
    # ville normalisee -> [nom, stations, a confirmer, en rupture, appels, itineraires, sans gerant]
    cities: dict[str, list] = {}
    without_manager = 0
    for outlet in outlets:
        fresh = svc.fuel_is_fresh(outlet, now, hours)
        status = svc.clean_fuel_status(outlet.fuel_status)
        key = svc.normalize_city(outlet.city)
        entry = cities.setdefault(key, [outlet.city, 0, 0, 0, 0, 0, 0])
        entry[1] += 1
        calls, routes, _gas = stats.get(outlet.id, (0, 0, 0))
        entry[4] += calls
        entry[5] += routes
        # Sans gerant = aucun gerant nomme (le responsable de ville nomme les gerants, il ne les remplace pas).
        if outlet.id not in managed:
            entry[6] += 1
            without_manager += 1
        if not fresh:
            entry[2] += 1
            updated = svc._aware(outlet.fuel_updated_at)
            stale.append(DashboardStation(id=outlet.id, name=outlet.name, city=outlet.city, fuel_updated_at=updated.isoformat() if updated else None))
        for fuel, state in status.items():
            since = last_out.get((outlet.id, fuel))
            if fresh and state == "out":
                entry[3] += 1
                if since is not None and now - since >= timedelta(hours=LONG_OUTAGE_HOURS):
                    outages.append(DashboardOutage(id=outlet.id, name=outlet.name, city=outlet.city, fuel=fuel, since=since.isoformat()))
    since_30 = now - timedelta(days=HISTORY_DAYS)
    reports = int(
        db.scalar(select(func.count()).select_from(StationReport).where(StationReport.vendor_id == profile.vendor_id, StationReport.created_at >= since_30))
        or 0
    )
    outages.sort(key=lambda o: o.since)
    return FuelDashboardResponse(
        stations=len(outlets),
        fresh=len(outlets) - len(stale),
        to_confirm=len(stale),
        without_manager=without_manager,
        reports_30d=reports,
        stale=stale[:50],
        long_outages=outages[:50],
        cities=[
            DashboardCity(
                city=c, stations=n, to_confirm=s, out=o, city_managers=city_managers.get(svc.normalize_city(c), []),
                calls_30d=calls, routes_30d=routes, without_manager=alone,
            )
            for c, n, s, o, calls, routes, alone in sorted(cities.values(), key=lambda e: (-e[1], e[0]))
        ],
        calls_30d=sum(v[0] for v in stats.values()),
        routes_30d=sum(v[1] for v in stats.values()),
        gas_orders_30d=sum(v[2] for v in stats.values()),
        deliveries_30d=sa.deliveries_count(db, profile.vendor_id),
    )


def _region_items(db: Session, vendor_id: str) -> list[RegionManagerItem]:
    rows = db.execute(
        select(FuelRegionManager, User.email, User.full_name)
        .join(User, User.id == FuelRegionManager.user_id)
        .where(FuelRegionManager.vendor_id == vendor_id)
        .order_by(FuelRegionManager.city, FuelRegionManager.created_at)
    ).all()
    counts: dict[str, int] = {}
    for city in db.scalars(select(FuelOutlet.city).where(FuelOutlet.vendor_id == vendor_id)).all():
        counts[svc.normalize_city(city)] = counts.get(svc.normalize_city(city), 0) + 1
    last = sa.last_activity_by_user(db, vendor_id)
    return [
        RegionManagerItem(
            id=r.id, city=r.city, email=email, full_name=name,
            stations=counts.get(svc.normalize_city(r.city), 0),
            last_activity_at=last[r.user_id].isoformat() if r.user_id in last else None,
        )
        for r, email, name in rows
    ]


@router.get("/seller/fuel-region-managers", response_model=list[RegionManagerItem])
def list_region_managers(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[RegionManagerItem]:
    return _region_items(db, _station_profile(db, current_user).vendor_id)


@router.post("/seller/fuel-region-managers", response_model=list[RegionManagerItem], status_code=201)
def add_region_manager(
    payload: RegionManagerCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[RegionManagerItem]:
    """Responsable d'une ville (tous paliers, meme avant la premiere station) : il y cree les stations et nomme les gerants."""
    from app.services.station_tasks import _notify

    enforce_csrf(request)
    enforce_rate_limit(request, key=f"fuel-region:{current_user.id}", limit=30, window_seconds=600)
    profile = _station_profile(db, current_user)
    city = sa.canonical_city(db, profile.vendor_id, payload.city)
    wanted = svc.normalize_city(city)
    total = int(db.scalar(select(func.count()).select_from(FuelRegionManager).where(FuelRegionManager.vendor_id == profile.vendor_id)) or 0)
    if total >= sa.MAX_CITY_MANAGERS:
        raise ValidationDomainError(f"{sa.MAX_CITY_MANAGERS} responsables de ville au maximum.")
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.strip().lower()))
    if user is None or not user.is_active:
        raise ValidationDomainError(
            "Aucun compte AMAZER avec cet e-mail. Demandez au responsable de créer un compte gratuit sur amazer.store, puis réessayez."
        )
    if user.id == current_user.id:
        raise ValidationDomainError("Vous gérez déjà toutes vos stations depuis cet espace.")
    existing = db.scalars(select(FuelRegionManager).where(FuelRegionManager.vendor_id == profile.vendor_id, FuelRegionManager.user_id == user.id)).all()
    if any(svc.normalize_city(r.city) == wanted for r in existing):
        raise ValidationDomainError("Cette personne est déjà responsable de cette ville.")
    db.add(FuelRegionManager(vendor_id=profile.vendor_id, user_id=user.id, city=city))
    sa.log_activity(
        db, vendor_id=profile.vendor_id, outlet=None, user=current_user, role="owner", action="city_added",
        detail=f"Responsable de ville : {user.email}", city=city,
    )
    db.commit()
    _notify(
        db,
        user.id,
        "Une ville vous est confiée",
        f"{profile.business_name} vous confie ses stations de {city}. Ajoutez les stations et nommez leurs gérants. Pour y revenir, connectez-vous à AMAZER avec ce compte : « Espace station » se trouve dans le menu.",
        f"fuel-region-{profile.vendor_id}-{wanted}",
        "/gerant-station",
    )
    db.commit()
    return _region_items(db, profile.vendor_id)


@router.delete("/seller/fuel-region-managers/{manager_id}", status_code=204, response_model=None)
def remove_region_manager(
    manager_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> None:
    enforce_csrf(request)
    profile = _station_profile(db, current_user)
    row = db.get(FuelRegionManager, manager_id)
    if row is None or row.vendor_id != profile.vendor_id:
        raise NotFoundError("Responsable introuvable.")
    removed = db.get(User, row.user_id)
    sa.log_activity(
        db, vendor_id=profile.vendor_id, outlet=None, user=current_user, role="owner", action="city_removed",
        detail=f"Responsable retiré : {removed.email}" if removed is not None else "Responsable retiré", city=row.city,
    )
    db.delete(row)
    db.commit()


EXPORT_DAYS = 365


def _csv(rows: list[list[str]], filename: str) -> Response:
    """CSV pour Excel en francais : separateur « ; » et BOM UTF-8 (accents corrects a l'ouverture)."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerows(rows)
    return Response(
        content="﻿" + buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("/seller/fuel-export", response_class=Response)
def export_fuel_data(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
    kind: Annotated[Literal["history", "stats"], Query()] = "history",
) -> Response:
    """Export Excel sur 12 mois (palier Entreprise) : historique des disponibilites ou statistiques par jour."""
    profile = _station_profile(db, current_user)
    outlets = {o.id: o for o in db.scalars(select(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id)).all()}
    labels = {"available": "Disponible", "low": "Stock faible", "out": "Rupture"}
    fuels = {"super": "Super", "gasoil": "Gasoil", "gaz": "Gaz"}
    now = datetime.now(UTC)
    if kind == "history":
        rows = [["Date", "Heure (Niamey)", "Station", "Ville", "Carburant", "Avant", "Après"]]
        for change in db.scalars(
            select(FuelStatusChange)
            .where(FuelStatusChange.vendor_id == profile.vendor_id, FuelStatusChange.created_at >= now - timedelta(days=EXPORT_DAYS))
            .order_by(FuelStatusChange.created_at)
        ).all():
            local = svc._aware(change.created_at).astimezone(svc.NIAMEY_TZ)
            outlet = outlets.get(change.outlet_id) if change.outlet_id else None
            rows.append([
                f"{local:%d/%m/%Y}",
                f"{local:%H:%M}",
                outlet.name if outlet else profile.business_name,
                outlet.city if outlet else (profile.city or ""),
                fuels.get(change.fuel, change.fuel),
                labels.get(change.old_state or "", ""),
                labels.get(change.new_state, change.new_state),
            ])
        return _csv(rows, "amazer-stations-historique.csv")
    rows = [["Jour", "Station", "Ville", "Itinéraires", "Appels", "Commandes de gaz"]]
    since = svc.niamey_today(now) - timedelta(days=EXPORT_DAYS)
    for stat in db.scalars(
        select(FuelOutletDailyStat).where(FuelOutletDailyStat.outlet_id.in_(list(outlets)), FuelOutletDailyStat.day >= since).order_by(FuelOutletDailyStat.day)
    ).all():
        outlet = outlets[stat.outlet_id]
        rows.append([f"{stat.day:%d/%m/%Y}", outlet.name, outlet.city, str(stat.routes), str(stat.calls), str(stat.gas_orders)])
    return _csv(rows, "amazer-stations-statistiques.csv")
