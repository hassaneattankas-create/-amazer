"""Statistiques journalieres d'une vitrine : visites et contacts (appel, WhatsApp, message).

Aucune donnee personnelle : seulement des compteurs par jour et par etablissement.
"""

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StorefrontDailyStat(Base):
    __tablename__ = "storefront_daily_stats"

    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    contacts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
