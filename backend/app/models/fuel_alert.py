"""Alertes carburant (« Me prévenir ») et signalements rapides des clients (« Vous y êtes ? »).

- FuelAlert : un client connecté veut être prévenu quand un carburant devient disponible, soit dans une
  station précise, soit dans une marque, soit dans toutes les stations d'une ville.
- FuelSignal : un client sur place signale « il y en a », « plus rien » ou « longue file » (sans donnée
  personnelle ; limité par appareil). Affiché « selon des clients » pendant 2 heures, jamais confondu avec
  l'information donnée par la station.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FuelAlert(Base):
    __tablename__ = "fuel_alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # super, gasoil, gaz, ou any (n'importe lequel).
    fuel: Mapped[str] = mapped_column(String(10), nullable=False)
    # Portée : une station (outlet_id), une marque/station seule (vendor_id) ou une ville (city_key).
    outlet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="CASCADE"), nullable=True, index=True)
    vendor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=True, index=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    city_key: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now())
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FuelSignal(Base):
    __tablename__ = "fuel_signals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    outlet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="CASCADE"), nullable=True, index=True)
    # found (il y en a), out (plus rien), queue (longue file).
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    fuel: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now(), index=True)
