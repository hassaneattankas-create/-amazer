"""Journal d'activite des stations et livraisons de carburant.

- FuelActivity : qui (proprietaire, responsable de ville, gerant) a fait quoi, sur quelle station, quand.
  Le nom de la station, sa ville et le nom de l'auteur sont copies (le journal survit a une suppression).
- FuelDelivery : livraison recue par une station (carburant, quantite, n° de bon), saisie par l'equipe.
- FuelPump / FuelMeterReading : pompes d'une station et releves de leur compteur (litres cumules).
  Vendu entre deux releves = compteur du releve - compteur du releve precedent.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FuelActivity(Base):
    __tablename__ = "fuel_activities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    outlet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="SET NULL"), nullable=True, index=True)
    outlet_name: Mapped[str | None] = mapped_column(String(140), nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(140), nullable=True)
    role: Mapped[str] = mapped_column(String(10), nullable=False)
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    detail: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now(), index=True)


class FuelDelivery(Base):
    __tablename__ = "fuel_deliveries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    outlet_id: Mapped[str] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="CASCADE"), nullable=False, index=True)
    fuel: Mapped[str] = mapped_column(String(10), nullable=False)
    liters: Mapped[int] = mapped_column(Integer, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(80), nullable=True)
    delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now(), index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now())


class FuelPump(Base):
    __tablename__ = "fuel_pumps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    outlet_id: Mapped[str] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="CASCADE"), nullable=False, index=True)
    fuel: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now())


class FuelMeterReading(Base):
    __tablename__ = "fuel_meter_readings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    outlet_id: Mapped[str] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="CASCADE"), nullable=False, index=True)
    pump_id: Mapped[str] = mapped_column(String(36), ForeignKey("fuel_pumps.id", ondelete="CASCADE"), nullable=False, index=True)
    fuel: Mapped[str] = mapped_column(String(10), nullable=False)
    meter: Mapped[float] = mapped_column(Float, nullable=False)
    # Compteur remis a zero ou change : ce releve repart de zero (pas de vente comptee).
    reset: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now(), index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now())
