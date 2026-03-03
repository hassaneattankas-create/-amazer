from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.product import Price


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    price_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("prices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_amount: Mapped[float] = mapped_column(Float, nullable=False)
    new_amount: Mapped[float] = mapped_column(Float, nullable=False)
    previous_stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    new_stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    price: Mapped[Price] = relationship("Price", back_populates="history_entries")
