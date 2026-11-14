"""Espace station : la chaine proprietaire -> responsable de ville -> gerant.

- /station-space/me : ce compte a-t-il des villes ou des stations confiees (lien « Espace station »).
- /station-region/... : le responsable de ville cree les stations de sa ville, y nomme les gerants,
  suit leur activite et traite les retours clients.
- /station-manager/... : le gerant (ou son responsable, ou le proprietaire) tient la fiche de la station,
  sa position Google Maps, ses livraisons et ses retours clients.
- /seller/... : le proprietaire voit le journal et les livraisons de toute la marque.
Toutes les ecritures passent par le journal (station_access.log_activity).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user, get_seller_user
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.fuel_activity import FuelPump
from app.models.fuel_history import StationReport
from app.models.fuel_outlet import FuelOutlet, FuelOutletManager, FuelRegionManager
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.routes.local_services import (
    MAX_OUTLETS,
    _managed_response,
    _outlet_stats,
    _station_profile,
    invalidate_services_cache,
)
from app.schemas.local_services import (
    ActivityItem,
    DeliveryItem,
    FuelManagerCreate,
    FuelStatusSchema,
    ManagedOutlet,
    ReportItem,
    ReportResolve,
    StationInfoUpdate,
    StationManagerRef,
)
from app.schemas.station_space import (
    BrandSales,
    DeliveryCreate,
    MeterReadingsCreate,
    PumpCreate,
    PumpItem,
    SalesDay,
    StationMeters,
    StationSales,
    RegionCity,
    RegionOutletCreate,
    RegionOutletUpdate,
    RegionStation,
    RegionTotals,
    StationSpaceMe,
)
from app.services import local_services as svc
from app.services import fuel_sales_service as sales
from app.services import station_access as sa
from app.services.seller_finance_service import get_or_create_global_settings

router = APIRouter(tags=["stations"])
RoleFilter = Literal["owner", "city", "manager"]


# ---------------------------------------------------------------- resume du compte

@router.get("/station-space/me", response_model=StationSpaceMe)
def station_space_me(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StationSpaceMe:
    """Proprietaire d'une marque ? Villes et stations confiees ? (3 comptages, pour la barre de navigation)."""
    owner = sa.owner_profile(db, current_user)
    cities = int(db.scalar(select(func.count()).select_from(FuelRegionManager).where(FuelRegionManager.user_id == current_user.id)) or 0)
    stations = int(db.scalar(select(func.count()).select_from(FuelOutletManager).where(FuelOutletManager.user_id == current_user.id)) or 0)
    return StationSpaceMe(is_owner=owner is not None, owner_brand=owner.business_name if owner is not None else None, cities=cities, stations=stations)


# ---------------------------------------------------------------- responsable de ville

def _city_spelling(db: Session, user: User, vendor_id: str, city: str) -> str:
    """Ville confiee a ce compte pour cette marque (orthographe enregistree), sinon « introuvable »."""
    spelling = sa.region_cities(db, user).get(vendor_id, {}).get(svc.normalize_city(city))
    if spelling is None:
        raise NotFoundError("Ville introuvable.")
    return spelling


def _city_outlet(db: Session, user: User, outlet_id: str) -> FuelOutlet:
    outlet = db.get(FuelOutlet, outlet_id)
    if outlet is None or svc.normalize_city(outlet.city) not in sa.region_cities(db, user).get(outlet.vendor_id, {}):
        raise NotFoundError("Station introuvable.")
    return outlet


def _brand_or_forbid(db: Session, vendor_id: str, now: datetime) -> None:
    if not sa.brand_can_publish(db, vendor_id, now):
        raise ForbiddenError(sa.SUSPENDED_BRAND)


def _region_stations(db: Session, outlets: list[FuelOutlet], now: datetime) -> list[RegionStation]:
    settings = get_or_create_global_settings(db)
    hours = svc.fresh_hours(settings)
    ids = [o.id for o in outlets]
    stats = _outlet_stats(db, ids, now)
    managers = sa.manager_refs(db, ids)
    reports = sa.open_report_counts(db, ids, now)
    items: list[RegionStation] = []
    for outlet in outlets:
        updated = svc._aware(outlet.fuel_updated_at)
        calls, routes, gas = stats.get(outlet.id, (0, 0, 0))
        items.append(
            RegionStation(
                id=outlet.id,
                name=outlet.name,
                city=outlet.city,
                is_active=bool(outlet.is_active),
                fuel=FuelStatusSchema(**svc.clean_fuel_status(outlet.fuel_status)),
                fuel_fresh=svc.fuel_is_fresh(outlet, now, hours),
                fuel_updated_at=updated.isoformat() if updated else None,
                info=sa.station_info(outlet),
                managers=managers.get(outlet.id, []),
                open_reports=reports.get(outlet.id, 0),
                calls_30d=calls,
                routes_30d=routes,
                gas_orders_30d=gas,
            )
        )
    return items


def _totals(stations: list[RegionStation]) -> RegionTotals:
    """Totaux des stations ouvertes de la ville."""
    active = [s for s in stations if s.is_active]
    fresh = [s for s in active if s.fuel_fresh]
    return RegionTotals(
        stations=len(active),
        fresh=len(fresh),
        to_confirm=len(active) - len(fresh),
        out=sum(1 for s in fresh if "out" in s.fuel.model_dump().values()),
        without_manager=sum(1 for s in active if not s.managers),
        open_reports=sum(s.open_reports for s in active),
        calls_30d=sum(s.calls_30d for s in active),
        routes_30d=sum(s.routes_30d for s in active),
        gas_orders_30d=sum(s.gas_orders_30d for s in active),
    )


def _single_region_station(db: Session, outlet: FuelOutlet, now: datetime) -> RegionStation:
    return _region_stations(db, [outlet], now)[0]


@router.get("/station-region/cities", response_model=list[RegionCity])
def my_region_cities(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[RegionCity]:
    """Les villes confiees a ce compte : stations, gerants, fraicheur, retours et trafic."""
    now = datetime.now(UTC)
    result: list[RegionCity] = []
    for vendor_id, cities in sa.region_cities(db, current_user).items():
        profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
        can_update = sa.brand_can_publish(db, vendor_id, now)
        outlets = list(db.scalars(select(FuelOutlet).where(FuelOutlet.vendor_id == vendor_id).order_by(FuelOutlet.name)).all())
        for key, spelling in cities.items():
            stations = _region_stations(db, [o for o in outlets if svc.normalize_city(o.city) == key], now)
            result.append(
                RegionCity(
                    vendor_id=vendor_id,
                    brand_name=profile.business_name if profile is not None else "",
                    city=spelling,
                    can_update=can_update,
                    totals=_totals(stations),
                    stations=stations,
                )
            )
    result.sort(key=lambda c: (c.brand_name.lower(), svc.normalize_city(c.city)))
    return result


@router.post("/station-region/outlets", response_model=RegionStation, status_code=201)
def region_create_outlet(
    payload: RegionOutletCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RegionStation:
    """Le responsable ajoute une station dans SA ville ; le proprietaire est prevenu (abonnement)."""
    from app.services.station_tasks import _notify

    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-region:{current_user.id}", limit=60, window_seconds=600)
    city = _city_spelling(db, current_user, payload.vendor_id, payload.city)
    now = datetime.now(UTC)
    _brand_or_forbid(db, payload.vendor_id, now)
    count = int(db.scalar(select(func.count()).select_from(FuelOutlet).where(FuelOutlet.vendor_id == payload.vendor_id)) or 0)
    if count >= MAX_OUTLETS:
        raise ValidationDomainError(f"{MAX_OUTLETS} points de vente au maximum.")
    outlet = FuelOutlet(
        vendor_id=payload.vendor_id,
        name=payload.name,
        city=city,
        address=payload.address or None,
        phone=payload.phone or None,
        sort_order=count,
    )
    db.add(outlet)
    db.flush()
    sa.log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=current_user, role="city", action="outlet_created", detail=f"Station ajoutée à {city}")
    db.commit()
    invalidate_services_cache()
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == outlet.vendor_id))
    if profile is not None:
        _notify(
            db,
            profile.user_id,
            "Nouvelle station ajoutée",
            f"{sa.actor_name(current_user) or 'Votre responsable'} a ajouté la station « {outlet.name} » à {city}.",
            f"fuel-new-outlet-{outlet.id}",
            "/seller/dashboard",
        )
        db.commit()
    return _single_region_station(db, outlet, now)


@router.put("/station-region/outlets/{outlet_id}", response_model=RegionStation)
def region_update_outlet(
    outlet_id: str,
    payload: RegionOutletUpdate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RegionStation:
    """Renommer, ouvrir ou fermer une station de sa ville (la ville elle-meme ne change pas)."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-region:{current_user.id}", limit=60, window_seconds=600)
    outlet = _city_outlet(db, current_user, outlet_id)
    now = datetime.now(UTC)
    _brand_or_forbid(db, outlet.vendor_id, now)
    if payload.name is not None and payload.name != outlet.name:
        outlet.name = payload.name
        sa.log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=current_user, role="city", action="info", detail=f"Nom : {payload.name}")
    if payload.is_active is not None and payload.is_active != bool(outlet.is_active):
        outlet.is_active = payload.is_active
        sa.log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=current_user, role="city", action="outlet_opened" if payload.is_active else "outlet_closed")
    db.commit()
    invalidate_services_cache()
    return _single_region_station(db, outlet, now)


@router.delete("/station-region/outlets/{outlet_id}", status_code=204, response_model=None)
def region_delete_outlet(
    outlet_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-region:{current_user.id}", limit=60, window_seconds=600)
    outlet = _city_outlet(db, current_user, outlet_id)
    _brand_or_forbid(db, outlet.vendor_id, datetime.now(UTC))
    sa.delete_outlet(db, outlet, current_user, "city")
    invalidate_services_cache()


@router.post("/station-region/managers", response_model=list[StationManagerRef], status_code=201)
def region_add_manager(
    payload: FuelManagerCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[StationManagerRef]:
    """Le responsable nomme le gerant d'une station de sa ville (compte AMAZER existant)."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"fuel-manager:{current_user.id}", limit=30, window_seconds=600)
    outlet = _city_outlet(db, current_user, payload.outlet_id)
    _brand_or_forbid(db, outlet.vendor_id, datetime.now(UTC))
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == outlet.vendor_id))
    sa.assign_manager(db, outlet=outlet, email=payload.email, actor=current_user, role="city", brand_name=profile.business_name if profile is not None else "La marque")
    return sa.manager_refs(db, [outlet.id]).get(outlet.id, [])


@router.delete("/station-region/managers/{manager_id}", status_code=204, response_model=None)
def region_remove_manager(
    manager_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"fuel-manager:{current_user.id}", limit=30, window_seconds=600)
    row = db.get(FuelOutletManager, manager_id)
    outlet = db.get(FuelOutlet, row.outlet_id) if row is not None else None
    if row is None or outlet is None or svc.normalize_city(outlet.city) not in sa.region_cities(db, current_user).get(outlet.vendor_id, {}):
        raise NotFoundError("Gérant introuvable.")
    _brand_or_forbid(db, outlet.vendor_id, datetime.now(UTC))
    sa.remove_manager(db, row, current_user, "city")


@router.get("/station-region/activity", response_model=list[ActivityItem])
def region_activity(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    vendor_id: Annotated[str, Query(min_length=1, max_length=36)],
    city: Annotated[str, Query(min_length=1, max_length=80)],
    limit: Annotated[int, Query(ge=1, le=sa.ACTIVITY_LIMIT)] = sa.ACTIVITY_LIMIT,
) -> list[ActivityItem]:
    """Journal de la ville (90 jours) : ce que font les gerants, le responsable et le proprietaire."""
    spelling = _city_spelling(db, current_user, vendor_id, city)
    return sa.recent_activity(db, vendor_id, city=spelling, limit=limit)


@router.get("/station-region/reports", response_model=list[ReportItem])
def region_reports(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    vendor_id: Annotated[str, Query(min_length=1, max_length=36)],
    city: Annotated[str, Query(min_length=1, max_length=80)],
) -> list[ReportItem]:
    """Retours clients des stations de la ville (30 jours), non traites d'abord."""
    key = svc.normalize_city(_city_spelling(db, current_user, vendor_id, city))
    ids = [o.id for o in db.scalars(select(FuelOutlet).where(FuelOutlet.vendor_id == vendor_id)).all() if svc.normalize_city(o.city) == key]
    return sa.recent_reports(db, vendor_id, ids)


# ---------------------------------------------------------------- gerant (et niveaux au-dessus)

def _managed_view(db: Session, outlet: FuelOutlet, role: sa.Role, now: datetime) -> ManagedOutlet:
    return _managed_response(db, outlet, get_or_create_global_settings(db), now, via_region=outlet.city if role == "city" else None, role=role)


@router.put("/station-manager/outlets/{outlet_id}/info", response_model=ManagedOutlet)
def update_station_info(
    outlet_id: str,
    payload: StationInfoUpdate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ManagedOutlet:
    """Adresse, telephone, horaires, services et position (GPS sur place ou lien Google Maps)."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-manager:{current_user.id}", limit=120, window_seconds=600)
    outlet, role = sa.require_station(db, current_user, outlet_id)
    now = datetime.now(UTC)
    sa.ensure_writable(db, outlet, role, now)
    touched, changed, moved = sa.apply_info_update(outlet, payload, now)
    if not touched:
        raise ValidationDomainError("Indiquez au moins une information à enregistrer.")
    sa.log_info_activity(db, outlet, current_user, role, touched, changed, moved)
    db.commit()
    invalidate_services_cache()
    return _managed_view(db, outlet, role, now)


@router.get("/station-manager/outlets/{outlet_id}/deliveries", response_model=list[DeliveryItem])
def station_deliveries(
    outlet_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[DeliveryItem]:
    outlet, _role = sa.require_station(db, current_user, outlet_id)
    return sa.recent_deliveries(db, outlet.vendor_id, [outlet.id], limit=100)


@router.post("/station-manager/outlets/{outlet_id}/deliveries", response_model=DeliveryItem, status_code=201)
def record_station_delivery(
    outlet_id: str,
    payload: DeliveryCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DeliveryItem:
    """Livraison recue (carburant, quantite, n° de bon). Ne change pas les disponibilites."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-manager:{current_user.id}", limit=120, window_seconds=600)
    outlet, role = sa.require_station(db, current_user, outlet_id)
    now = datetime.now(UTC)
    sa.ensure_writable(db, outlet, role, now)
    row = sa.record_delivery(
        db, outlet=outlet, user=current_user, role=role, fuel=payload.fuel, liters=payload.liters,
        reference=payload.reference, delivered_at=payload.delivered_at, now=now,
    )
    return sa.delivery_items(db, [row])[0]


@router.get("/station-manager/outlets/{outlet_id}/reports", response_model=list[ReportItem])
def station_reports(
    outlet_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ReportItem]:
    outlet, _role = sa.require_station(db, current_user, outlet_id)
    return sa.recent_reports(db, outlet.vendor_id, [outlet.id])


@router.post("/station-manager/reports/{report_id}/resolve", response_model=ReportItem)
def resolve_station_report(
    report_id: str,
    payload: ReportResolve,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportItem:
    """Retour client traite (note facultative). Retour sur la marque entiere : proprietaire seulement."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-manager:{current_user.id}", limit=120, window_seconds=600)
    report = db.get(StationReport, report_id)
    if report is None:
        raise NotFoundError("Retour introuvable.")
    now = datetime.now(UTC)
    if report.outlet_id:
        try:
            outlet, role = sa.require_station(db, current_user, report.outlet_id)
        except NotFoundError:
            raise NotFoundError("Retour introuvable.") from None
        # Traiter un retour ne publie rien aux clients : permis aussi sur une station fermee.
        sa.ensure_writable(db, outlet, role, now, allow_closed=True)
        return sa.resolve_report(db, report, current_user, role, payload.resolution, now)
    owner = sa.owner_profile(db, current_user)
    if owner is None or owner.vendor_id != report.vendor_id:
        raise NotFoundError("Retour introuvable.")
    _brand_or_forbid(db, report.vendor_id, now)
    return sa.resolve_report(db, report, current_user, "owner", payload.resolution, now)


@router.get("/station-manager/outlets/{outlet_id}/activity", response_model=list[ActivityItem])
def station_activity(
    outlet_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ActivityItem]:
    outlet, _role = sa.require_station(db, current_user, outlet_id)
    return sa.recent_activity(db, outlet.vendor_id, outlet_id=outlet.id, limit=100)


# ---------------------------------------------------------------- proprietaire

@router.get("/seller/fuel-activity", response_model=list[ActivityItem])
def my_fuel_activity(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
    city: Annotated[str | None, Query(max_length=80)] = None,
    outlet_id: Annotated[str | None, Query(max_length=36)] = None,
    role: Annotated[RoleFilter | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=sa.ACTIVITY_LIMIT)] = sa.ACTIVITY_LIMIT,
) -> list[ActivityItem]:
    """Journal de toute la marque (90 jours) : proprietaire, responsables de ville et gerants."""
    profile = _station_profile(db, current_user)
    return sa.recent_activity(db, profile.vendor_id, city=city or None, outlet_id=outlet_id or None, role=role, limit=limit)


@router.get("/seller/fuel-deliveries", response_model=list[DeliveryItem])
def my_fuel_deliveries(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
    city: Annotated[str | None, Query(max_length=80)] = None,
) -> list[DeliveryItem]:
    """Livraisons des 30 derniers jours, toutes stations (ou celles d'une ville)."""
    profile = _station_profile(db, current_user)
    ids: list[str] | None = None
    if city:
        key = svc.normalize_city(city)
        ids = [o.id for o in db.scalars(select(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id)).all() if svc.normalize_city(o.city) == key]
    return sa.recent_deliveries(db, profile.vendor_id, ids, limit=200)


@router.post("/seller/station-reports/{report_id}/resolve", response_model=ReportItem)
def owner_resolve_report(
    report_id: str,
    payload: ReportResolve,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> ReportItem:
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-manager:{current_user.id}", limit=120, window_seconds=600)
    profile = _station_profile(db, current_user)
    report = db.get(StationReport, report_id)
    if report is None or report.vendor_id != profile.vendor_id:
        raise NotFoundError("Retour introuvable.")
    return sa.resolve_report(db, report, current_user, "owner", payload.resolution, datetime.now(UTC))


# ---------------------------------------------------------------- ventes de carburant (compteurs des pompes)
SALES_DAYS = 14


def _meters_view(db: Session, outlet: FuelOutlet, just_sold: dict[str, float] | None = None) -> StationMeters:
    pumps = sales.active_pumps(db, [outlet.id])
    last = sales.last_readings(db, [p.id for p in pumps])
    per_day = sales.daily_sales(db, [outlet.id], SALES_DAYS)[outlet.id]
    return StationMeters(
        pumps=[
            PumpItem(
                id=p.id,
                fuel=p.fuel,
                name=p.name,
                last_meter=last[p.id].meter if p.id in last else None,
                last_read_at=svc._aware(last[p.id].read_at).isoformat() if p.id in last else None,
            )
            for p in pumps
        ],
        days=[SalesDay(**d) for d in sales.day_list(per_day, SALES_DAYS)],
        just_sold={k: round(v) for k, v in (just_sold or {}).items()},
    )


@router.get("/station-manager/outlets/{outlet_id}/meters", response_model=StationMeters)
def station_meters(
    outlet_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StationMeters:
    """Pompes, derniers compteurs et litres vendus par jour (14 jours)."""
    outlet, _role = sa.require_station(db, current_user, outlet_id)
    return _meters_view(db, outlet)


@router.post("/station-manager/outlets/{outlet_id}/pumps", response_model=StationMeters, status_code=201)
def add_station_pump(
    outlet_id: str,
    payload: PumpCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StationMeters:
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-manager:{current_user.id}", limit=120, window_seconds=600)
    outlet, role = sa.require_station(db, current_user, outlet_id)
    sa.ensure_writable(db, outlet, role, datetime.now(UTC), allow_closed=True)
    sales.add_pump(db, outlet=outlet, user=current_user, role=role, fuel=payload.fuel, name=payload.name)
    return _meters_view(db, outlet)


@router.delete("/station-manager/outlets/{outlet_id}/pumps/{pump_id}", response_model=StationMeters)
def remove_station_pump(
    outlet_id: str,
    pump_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StationMeters:
    enforce_csrf(request)
    outlet, role = sa.require_station(db, current_user, outlet_id)
    sa.ensure_writable(db, outlet, role, datetime.now(UTC), allow_closed=True)
    pump = db.get(FuelPump, pump_id)
    if pump is None or pump.outlet_id != outlet.id or not pump.is_active:
        raise NotFoundError("Pompe introuvable.")
    sales.remove_pump(db, outlet=outlet, pump=pump, user=current_user, role=role)
    return _meters_view(db, outlet)


@router.post("/station-manager/outlets/{outlet_id}/meter-readings", response_model=StationMeters, status_code=201)
def record_station_meters(
    outlet_id: str,
    payload: MeterReadingsCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StationMeters:
    """Relevé des compteurs : AMAZER calcule les litres vendus depuis le relevé précédent."""
    enforce_csrf(request)
    enforce_rate_limit(request, key=f"station-manager:{current_user.id}", limit=120, window_seconds=600)
    outlet, role = sa.require_station(db, current_user, outlet_id)
    now = datetime.now(UTC)
    # Relever ses compteurs ne publie rien aux clients : permis aussi sur une station fermée.
    sa.ensure_writable(db, outlet, role, now, allow_closed=True)
    sold = sales.record_readings(
        db, outlet=outlet, user=current_user, role=role, readings=[(r.pump_id, r.meter, r.reset) for r in payload.readings], now=now
    )
    return _meters_view(db, outlet, sold)


@router.get("/seller/fuel-sales", response_model=BrandSales)
def my_fuel_sales(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
    city: Annotated[str | None, Query(max_length=80)] = None,
) -> BrandSales:
    """Propriétaire : litres vendus par jour (toute la marque) et par station (aujourd'hui, hier, 7 jours)."""
    profile = sa.owner_profile(db, current_user)
    if profile is None:
        raise ForbiddenError("Réservé au propriétaire de la marque.")
    outlets = list(db.scalars(select(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id, FuelOutlet.is_active.is_(True)).order_by(FuelOutlet.city, FuelOutlet.name)).all())
    if city:
        key = svc.normalize_city(city)
        outlets = [o for o in outlets if svc.normalize_city(o.city) == key]
    ids = [o.id for o in outlets]
    per_outlet = sales.daily_sales(db, ids, SALES_DAYS)
    pumps = sales.active_pumps(db, ids)
    last = sales.last_readings(db, [p.id for p in pumps])
    brand: dict = {}
    stations: list[StationSales] = []
    for o in outlets:
        days = sales.day_list(per_outlet[o.id], SALES_DAYS)
        for d in days:
            total = brand.setdefault(d["day"], {"day": d["day"], "super": 0, "gasoil": 0})
            total["super"] += d["super"]
            total["gasoil"] += d["gasoil"]
        reads = [last[p.id].read_at for p in pumps if p.outlet_id == o.id and p.id in last]
        stations.append(
            StationSales(
                outlet_id=o.id,
                name=o.name,
                city=o.city,
                today=SalesDay(**days[0]),
                yesterday=SalesDay(**days[1]),
                week_super=sum(d["super"] for d in days[:7]),
                week_gasoil=sum(d["gasoil"] for d in days[:7]),
                pumps=sum(1 for p in pumps if p.outlet_id == o.id),
                last_read_at=svc._aware(max(reads)).isoformat() if reads else None,
            )
        )
    order = sorted(brand.values(), key=lambda d: d["day"], reverse=True)
    if not order:
        order = sales.day_list({}, SALES_DAYS)
    return BrandSales(days=[SalesDay(**d) for d in order], stations=stations)
