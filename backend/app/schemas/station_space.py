"""Espace station : responsables de ville, gerants (livraisons, retours) et resume du compte."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.local_services import PHONE_PATTERN, FuelKind, FuelStatusSchema, StationInfo, StationManagerRef


class StationSpaceMe(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_owner: bool
    owner_brand: str | None
    cities: int
    stations: int


class RegionTotals(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stations: int
    fresh: int
    to_confirm: int
    out: int
    without_manager: int
    open_reports: int
    calls_30d: int
    routes_30d: int
    gas_orders_30d: int


class RegionStation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    city: str
    is_active: bool
    fuel: FuelStatusSchema
    fuel_fresh: bool
    fuel_updated_at: str | None
    info: StationInfo
    managers: list[StationManagerRef]
    open_reports: int
    calls_30d: int
    routes_30d: int
    gas_orders_30d: int


class RegionCity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vendor_id: str
    brand_name: str
    city: str
    can_update: bool
    totals: RegionTotals
    stations: list[RegionStation]


class RegionOutletCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    vendor_id: str = Field(min_length=1, max_length=36)
    city: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=140)
    address: str | None = Field(default=None, max_length=220)
    phone: str | None = Field(default=None, max_length=40, pattern=PHONE_PATTERN)


class RegionOutletUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=140)
    is_active: bool | None = None


class DeliveryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    fuel: FuelKind
    liters: int = Field(ge=1, le=200000)
    reference: str | None = Field(default=None, max_length=80)
    delivered_at: datetime | None = None


# ---------------------------------------------------------------- ventes (compteurs des pompes)
PumpFuel = Literal["super", "gasoil"]


class PumpItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    fuel: PumpFuel
    name: str
    last_meter: float | None
    last_read_at: str | None


class PumpCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    fuel: PumpFuel
    name: str = Field(min_length=1, max_length=60)


class MeterReadingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pump_id: str = Field(min_length=1, max_length=36)
    meter: float = Field(ge=0, le=10_000_000_000)
    reset: bool = False


class MeterReadingsCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    readings: list[MeterReadingInput] = Field(min_length=1, max_length=24)


class SalesDay(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day: date
    super: int
    gasoil: int


class StationMeters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pumps: list[PumpItem]
    days: list[SalesDay]
    # Litres vendus depuis le relevé précédent (réponse à un relevé), sinon vide.
    just_sold: dict[str, int] = Field(default_factory=dict)


class StationSales(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outlet_id: str
    name: str
    city: str
    today: SalesDay
    yesterday: SalesDay
    week_super: int
    week_gasoil: int
    pumps: int
    last_read_at: str | None


class BrandSales(BaseModel):
    model_config = ConfigDict(extra="forbid")

    days: list[SalesDay]
    stations: list[StationSales]
