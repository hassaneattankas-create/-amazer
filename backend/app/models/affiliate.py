"""Programme d'affiliation : un lien personnel, deux facons de gagner.

- Vendeurs amenes : une part de leurs abonnements (argent deja encaisse par AMAZER), pendant N mois.
- Nouveaux clients : un bonus fixe sur leur premiere commande livree.
Jamais de pourcentage sur les ventes des vendeurs.
"""

from datetime import datetime

from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AffiliateAccount(Base):
    __tablename__ = "affiliate_accounts"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    click_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AffiliateReferral(Base):
    """Personne inscrite via le lien d'un affilie (vendeur ou client)."""

    __tablename__ = "affiliate_referrals"

    referred_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    affiliate_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AffiliateEarning(Base):
    """Gain acquis par un affilie (part d'un abonnement encaisse par AMAZER)."""

    __tablename__ = "affiliate_earnings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    affiliate_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    reference: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
