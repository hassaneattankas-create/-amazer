"""Listes officielles datees, publiees par l'admin AMAZER avec leur source.

- pharmacy_duty : pharmacies de garde d'une ville (ex. liste du Comite de garde ANRP / SYNPHANI, groupe et periode).
- fuel_supply : stations approvisionnees d'une marque pour un carburant (ex. communique Oriba Petrolium du jour).

Une liste n'est visible que pendant sa periode (starts_at <= maintenant < ends_at) : jamais d'information perimee.
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OfficialList(Base):
    __tablename__ = "official_lists"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(80), nullable=False, default="Niamey")
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    source: Mapped[str] = mapped_column(String(200), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    fuel: Mapped[str | None] = mapped_column(String(10), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    contact_address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OfficialListEntry(Base):
    __tablename__ = "official_list_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    list_id: Mapped[str] = mapped_column(String(36), ForeignKey("official_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    location: Mapped[str | None] = mapped_column(String(240), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    group_label: Mapped[str | None] = mapped_column(String(40), nullable=True)
