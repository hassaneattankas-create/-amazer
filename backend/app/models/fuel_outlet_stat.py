"""Statistiques journalieres d'une station : appels, itineraires et commandes de gaz.

Aucune donnee personnelle : seulement des compteurs, pour montrer a la marque ce que chaque station lui rapporte.
"""

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FuelOutletDailyStat(Base):
    __tablename__ = "fuel_outlet_daily_stats"

    outlet_id: Mapped[str] = mapped_column(String(36), ForeignKey("fuel_outlets.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    routes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    gas_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
