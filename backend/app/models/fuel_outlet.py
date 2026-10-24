"""Point de vente d'une marque de carburant (ex. une enseigne et ses stations dans tout le Niger).

La marque a une seule vitrine Premium (service_kind = "fuel_station") ; chaque station est un point
de vente avec sa ville, son adresse, sa position et ses propres disponibilites (Super / Gasoil / Gaz).
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FuelOutlet(Base):
    __tablename__ = "fuel_outlets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    city: Mapped[str] = mapped_column(String(80), nullable=False, default="Niamey")
    address: Mapped[str | None] = mapped_column(String(220), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    fuel_status: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    fuel_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Derniere relance envoyee aux gerants (information « non confirmee »).
    reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Les regles des stations (fraicheur, gaz livrable, itineraire) s'appliquent telles quelles.
    @property
    def service_kind(self) -> str:
        return "fuel_station"

    @property
    def business_name(self) -> str:
        return self.name


class FuelOutletManager(Base):
    """Gerant d'une station : un compte AMAZER qui ne peut que mettre a jour les disponibilites de cette station."""

    __tablename__ = "fuel_outlet_managers"
    __table_args__ = (UniqueConstraint("outlet_id", "user_id", name="uq_fuel_outlet_manager"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    outlet_id: Mapped[str] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FuelRegionManager(Base):
    """Responsable regional (palier Reseau) : met a jour toutes les stations de la marque dans une ville."""

    __tablename__ = "fuel_region_managers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
