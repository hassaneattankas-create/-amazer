"""Moyens de paiement geres depuis l'admin.

- kind = "manual" : le client envoie l'argent au numero affiche, donne sa reference, l'admin valide.
- kind = "amana" : circuit automatique existant (passerelle Amana). Seul le moyen Amana d'origine l'utilise.
Les commandes gardent le code du moyen choisi (`payment_mode`), meme si le moyen est desactive ensuite.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    code: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="manual", server_default="manual")
    account_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    account_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now())
