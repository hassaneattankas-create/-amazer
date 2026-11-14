from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

FuelState = Literal["available", "low", "out"]
FuelKind = Literal["super", "gasoil", "gaz"]
StationRole = Literal["owner", "city", "manager"]
# Services proposes par une station (codes stables ; libelles cote interface).
STATION_SERVICES = ("lavage", "gonflage", "vidange", "boutique", "toilettes", "mobile_money", "carte", "atelier")
StationServiceCode = Literal["lavage", "gonflage", "vidange", "boutique", "toilettes", "mobile_money", "carte", "atelier"]
PHONE_PATTERN = r"^[+0-9 ().-]*$"


def dedupe_services(value: list[str] | None) -> list[str] | None:
    """Codes de services sans doublon, dans l'ordre choisi (8 au plus)."""
    if value is None:
        return None
    seen: list[str] = []
    for code in value:
        if code not in seen:
            seen.append(code)
    return seen[: len(STATION_SERVICES)]


class StationInfo(BaseModel):
    """Fiche d'une station : adresse, telephone, horaires, services et position Google Maps."""

    model_config = ConfigDict(extra="forbid")

    address: str | None
    phone: str | None
    opening_hours: str | None
    services: list[str]
    latitude: float | None
    longitude: float | None
    maps_url: str
    info_updated_at: str | None
    # Garde : declaree (on_duty), jusqu'a quand (date ISO ou None = sans fin), et en cours maintenant.
    on_duty: bool = False
    duty_until: str | None = None
    on_duty_now: bool = False


class DutyFields(BaseModel):
    """Garde d'une station : on_duty absent = inchangee ; duty_until (inclus) n'a de sens qu'avec on_duty=true."""

    on_duty: bool | None = None
    duty_until: date | None = None

    @model_validator(mode="after")
    def _until_needs_duty(self) -> DutyFields:
        if self.duty_until is not None and self.on_duty is not True:
            raise ValueError("Une date de fin de garde demande d'activer la garde.")
        return self


class StationInfoUpdate(DutyFields):
    """Champs absents = inchanges ; chaine vide = effacer (adresse, telephone, horaires).

    Position : latitude + longitude (GPS sur place) ou maps_link (lien Google Maps ou « lat, lng »).
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    address: str | None = Field(default=None, max_length=220)
    phone: str | None = Field(default=None, max_length=40, pattern=PHONE_PATTERN)
    opening_hours: str | None = Field(default=None, max_length=120)
    services: list[StationServiceCode] | None = Field(default=None, max_length=20)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    maps_link: str | None = Field(default=None, max_length=500)

    @field_validator("services")
    @classmethod
    def _unique_services(cls, value: list[str] | None) -> list[str] | None:
        return dedupe_services(value)

    @model_validator(mode="after")
    def _both_or_none(self) -> StationInfoUpdate:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Indiquez la latitude et la longitude.")
        return self


class StationManagerRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    email: str
    full_name: str | None


class ActivityItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    created_at: str
    role: StationRole
    action: str
    detail: str | None
    actor_name: str | None
    outlet_id: str | None
    outlet_name: str | None
    city: str | None


class DeliveryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    outlet_id: str
    outlet_name: str
    fuel: FuelKind
    liters: int
    reference: str | None
    delivered_at: str
    recorded_by: str | None


class FuelStatusSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    super: FuelState | None = None
    gasoil: FuelState | None = None
    gaz: FuelState | None = None


class LocalServiceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vendor_id: str
    vendor_slug: str
    service_kind: Literal["pharmacy", "fuel_station"]
    business_name: str
    # Point de vente d'une marque (ex. « Oriba · Plateau ») : identifiant et nom de la marque.
    outlet_id: str | None = None
    brand_name: str | None = None
    # Nombre de stations de la marque (lien « Voir les N stations »).
    brand_outlets: int = 0
    city: str | None
    address: str | None
    phone: str | None
    whatsapp_contact: str | None
    logo_url: str | None
    is_verified: bool
    latitude: float | None
    longitude: float | None
    maps_url: str
    delivery_phone: str | None
    # Pharmacie
    on_duty: bool = False
    duty_label: str | None = None
    # Station
    fuel: FuelStatusSchema = Field(default_factory=FuelStatusSchema)
    fuel_fresh: bool = False
    fuel_updated_at: str | None = None
    # Station : horaires et services (codes STATION_SERVICES).
    opening_hours: str | None = None
    services: list[str] = Field(default_factory=list)


class CityCount(BaseModel):
    model_config = ConfigDict(extra="forbid")

    city: str
    count: int


class LocalServiceListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[LocalServiceItem]
    cities: list[CityCount]
    delivery_cities: list[str]
    fresh_hours: int


class ServiceStatusUpdate(BaseModel):
    """Mise a jour par le gerant. Un champ absent (None) n'est pas modifie."""

    model_config = ConfigDict(extra="forbid")

    on_duty: bool | None = None
    duty_start: date | None = None
    duty_end: date | None = None
    clear_duty_period: bool = False
    fuel: FuelStatusSchema | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class FuelOutletCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=140)
    city: str = Field(min_length=2, max_length=80)
    address: str | None = Field(default=None, max_length=220)
    phone: str | None = Field(default=None, max_length=40, pattern=r"^[+0-9 ().-]*$")


class FuelOutletUpdate(DutyFields):
    """Champs absents = inchanges. fuel / position : mise a jour en un geste depuis la station."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=140)
    city: str | None = Field(default=None, min_length=2, max_length=80)
    address: str | None = Field(default=None, max_length=220)
    phone: str | None = Field(default=None, max_length=40, pattern=r"^[+0-9 ().-]*$")
    is_active: bool | None = None
    fuel: FuelStatusSchema | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    # Fiche : horaires, services et position par lien Google Maps (meme analyse que l'espace station).
    opening_hours: str | None = Field(default=None, max_length=120)
    services: list[StationServiceCode] | None = Field(default=None, max_length=20)
    maps_link: str | None = Field(default=None, max_length=500)

    @field_validator("services")
    @classmethod
    def _unique_services(cls, value: list[str] | None) -> list[str] | None:
        return dedupe_services(value)


class FuelOutletResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    city: str
    address: str | None
    phone: str | None
    is_active: bool
    latitude: float | None
    longitude: float | None
    maps_url: str
    delivery_phone: str | None
    fuel: FuelStatusSchema
    fuel_fresh: bool
    fuel_updated_at: str | None
    # 30 derniers jours : ce que la station a rapporte en contacts.
    calls_30d: int = 0
    routes_30d: int = 0
    gas_orders_30d: int = 0
    info: StationInfo
    managers: list[StationManagerRef] = Field(default_factory=list)
    open_reports: int = 0


class FuelOutletsBulkUpdate(BaseModel):
    """Mise a jour de toutes les stations d'un coup (ou d'une ville) : disponibilites ou simple confirmation."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    fuel: FuelStatusSchema | None = None
    confirm: bool = False
    city: str | None = Field(default=None, max_length=80)


class FuelNetworkResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stations: int
    included: int
    base: float
    extra: float
    total: float
    flat: float
    capped: bool
    next_station_price: float
    # Prix negocie par AMAZER : remplace le calcul (montant mensuel).
    negotiated: float | None
    with_gas: int
    to_confirm: int


class OutletEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["call", "route", "gas"]


class ServiceStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service_kind: Literal["pharmacy", "fuel_station"] | None
    on_duty: bool
    on_duty_now: bool
    duty_start: date | None
    duty_end: date | None
    duty_label: str | None
    fuel: FuelStatusSchema
    fuel_fresh: bool
    fuel_updated_at: str | None
    latitude: float | None
    longitude: float | None
    maps_url: str
    delivery_phone: str | None
    # Pharmacie inscrite qui figure sur la liste officielle de la semaine (garde automatique).
    official_duty_label: str | None = None


class PharmacyDutyItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

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


class PharmacyDutyWeek(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    source: str
    starts_at: str
    ends_at: str
    period_label: str
    until_label: str
    items: list[PharmacyDutyItem]


class PharmacyDutyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    city: str
    cities: list[str]
    current: PharmacyDutyWeek | None
    next: PharmacyDutyWeek | None
    # Pharmacies inscrites sur AMAZER qui se sont déclarées de garde (hors liste officielle).
    declared: list[PharmacyDutyItem]


class FuelChangeItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outlet_id: str | None
    outlet_name: str | None
    fuel: Literal["super", "gasoil", "gaz"]
    old_state: FuelState | None
    new_state: FuelState
    created_at: str


StationReportKind = Literal["wrong_status", "closed", "wrong_place", "other"]


class StationReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    vendor_id: str = Field(min_length=1, max_length=36)
    outlet_id: str | None = Field(default=None, max_length=36)
    kind: StationReportKind
    comment: str | None = Field(default=None, max_length=300)


class StationReportItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    outlet_id: str | None
    outlet_name: str | None
    kind: StationReportKind
    comment: str | None
    created_at: str
    resolved_at: str | None = None
    resolution: str | None = None
    resolved_by_name: str | None = None


ReportItem = StationReportItem


class ReportResolve(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    resolution: str | None = Field(default=None, max_length=300)


class FuelManagerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    outlet_id: str = Field(min_length=1, max_length=36)
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class FuelManagerItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    outlet_id: str
    outlet_name: str
    email: str
    full_name: str


class ManagedOutlet(BaseModel):
    """Station confiee a un gerant : il ne voit et ne change que ses disponibilites."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    brand_name: str
    city: str
    fuel: FuelStatusSchema
    fuel_fresh: bool
    fuel_updated_at: str | None
    # False si l'abonnement de la marque a expire : les mises a jour sont suspendues.
    can_update: bool
    # Traiter un retour reste possible sur une station fermee (rien n'est publie aux clients).
    can_resolve: bool = False
    fresh_hours: int
    # Confiee via une region (responsable regional) plutot que directement.
    via_region: str | None = None
    info: StationInfo
    open_reports: int = 0
    # Role du compte sur cette station (« owner » seulement en reponse aux routes d'edition).
    role: StationRole = "manager"


class ManagedFuelUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fuel: FuelStatusSchema | None = None
    confirm: bool = False


class FuelPlanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: int
    name: str
    stations: int
    network_from: int
    enterprise_from: int
    network_tools: bool
    export: bool


class DashboardStation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    city: str
    fuel_updated_at: str | None


class DashboardOutage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    city: str
    fuel: Literal["super", "gasoil", "gaz"]
    since: str


class DashboardCity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    city: str
    stations: int
    to_confirm: int
    out: int
    city_managers: list[str] = Field(default_factory=list)
    calls_30d: int = 0
    routes_30d: int = 0
    without_manager: int = 0


class FuelDashboardResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stations: int
    fresh: int
    to_confirm: int
    without_manager: int
    reports_30d: int
    stale: list[DashboardStation]
    long_outages: list[DashboardOutage]
    cities: list[DashboardCity]
    calls_30d: int = 0
    routes_30d: int = 0
    gas_orders_30d: int = 0
    deliveries_30d: int = 0


class RegionManagerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    city: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegionManagerItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    city: str
    email: str
    full_name: str
    # Stations de la marque dans cette ville et derniere action de ce responsable.
    stations: int = 0
    last_activity_at: str | None = None
