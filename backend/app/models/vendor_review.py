"""Avis verifies sur une boutique, un restaurant, un hotel ou un transporteur.

Un client ne peut noter qu'apres une vraie experience (commande livree, sejour, voyage),
une seule fois par etablissement (il peut modifier son avis). L'etablissement peut repondre ;
l'admin peut masquer un avis abusif.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VendorReview(Base):
    __tablename__ = "vendor_reviews"
    __table_args__ = (UniqueConstraint("vendor_id", "user_id", name="uq_vendor_reviews_vendor_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(String(600), nullable=True)
    reply: Mapped[str | None] = mapped_column(String(600), nullable=True)
    is_hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
