"""Historique des disponibilites et signalements des clients sur les stations.

- FuelStatusChange : chaque changement reel de disponibilite (qui, quand, avant, apres). Jamais modifie :
  il sert a l'audit et aux statistiques de ruptures de la marque.
- StationReport : « information incorrecte » signalee par un client (sans donnee personnelle).
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FuelStatusChange(Base):
    __tablename__ = "fuel_status_changes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    outlet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="CASCADE"), nullable=True, index=True)
    fuel: Mapped[str] = mapped_column(String(10), nullable=False)
    old_state: Mapped[str | None] = mapped_column(String(10), nullable=True)
    new_state: Mapped[str] = mapped_column(String(10), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now(), index=True)


class StationReport(Base):
    __tablename__ = "station_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    outlet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="CASCADE"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    comment: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now(), index=True)
