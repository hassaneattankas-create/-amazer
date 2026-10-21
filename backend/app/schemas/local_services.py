from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FuelState = Literal["available", "out"]


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
