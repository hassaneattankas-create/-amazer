"""Annuaire permanent des pharmacies du Niger : position et numéro gardés, de garde ou non.

Alimenté par OpenStreetMap (positions exactes) et par chaque affiche officielle de garde (nom, quartier,
numéro) ; l'admin peut corriger une position (Admin › Gardes › Annuaire des pharmacies).
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PharmacyListing(Base):
    __tablename__ = "pharmacy_directory"
    __table_args__ = (UniqueConstraint("city_key", "name_key", name="uq_pharmacy_directory_city_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    city: Mapped[str] = mapped_column(String(80), nullable=False, default="Niamey")
    city_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    name_key: Mapped[str] = mapped_column(String(140), nullable=False, index=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    location: Mapped[str | None] = mapped_column(String(240), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # osm (position exacte OpenStreetMap), quartier (centre du quartier), admin (corrigée par AMAZER).
    position_source: Mapped[str | None] = mapped_column(String(16), nullable=True)
    area: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Fiche OpenStreetMap d'origine (« n1234 ») : l'annuaire national n'ajoute jamais deux fois la même.
    osm_id: Mapped[str | None] = mapped_column(String(24), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
