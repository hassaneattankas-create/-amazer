"""Remboursements a faire par AMAZER (commande payee puis annulee ou refusee).

Le paiement passe par Nita/Amana sur le compte AMAZER : un remboursement se fait a la main,
mais il est suivi ici (a qui, combien, sur quel numero, reference du virement) pour que rien ne soit oublie.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Refund(Base):
    __tablename__ = "refunds"
    __table_args__ = (UniqueConstraint("source", "source_id", name="uq_refunds_source"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    # order (boutique) | restaurant_order
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(120), nullable=False, default="Client")
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    # to_refund | refunded | not_needed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="to_refund", index=True)
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    admin_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    processed_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
