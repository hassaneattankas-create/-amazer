"""Programme d'affiliation et ambassadeurs : un lien personnel, deux facons de gagner.

- Vendeurs amenes : une part de leurs abonnements (argent deja encaisse par AMAZER), pendant N mois.
  Les ambassadeurs touchent une prime sur le 1er mois puis un pourcentage par palier.
- Nouveaux clients : un bonus fixe sur leur premiere commande livree.
Jamais de pourcentage sur les ventes des vendeurs, jamais de paiement au clic.

Chaque gain passe par un registre (AffiliateEarning) avec un statut :
  pending   -> delai de securite en cours (annulations, remboursements)
  review    -> signal de fraude : bloque jusqu'a decision de l'admin
  available -> peut etre demande en paiement
  requested -> inclus dans une demande de paiement en cours
  paid      -> verse (reference de transaction conservee)
  cancelled -> annule (motif conserve)
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

EARNING_STATUSES = ("pending", "review", "available", "requested", "paid", "cancelled")


class AffiliateAccount(Base):
    __tablename__ = "affiliate_accounts"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    click_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # « affiliate » (tout le monde) ou « ambassador » (nomme par l'admin, meilleurs taux).
    tier: Mapped[str] = mapped_column(String(20), nullable=False, default="affiliate", server_default="affiliate")
    # « active » ou « suspended » (plus aucun gain ni paiement).
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", server_default="active")
    admin_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Empreintes (hachees) de l'appareil et de la connexion de l'affilie : reperer l'auto-parrainage.
    device_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    last_ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payout_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payout_phone: Mapped[str | None] = mapped_column(String(24), nullable=True)
    ambassador_applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ambassador_application: Mapped[str | None] = mapped_column(String(600), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AffiliateReferral(Base):
    """Personne inscrite via le lien d'un affilie (vendeur ou client)."""

    __tablename__ = "affiliate_referrals"

    referred_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    affiliate_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    device_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Motif de suspicion (les gains lies passent en « review »), ou None.
    flag: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AffiliateEarning(Base):
    """Une ligne du registre des gains (part d'abonnement, bonus client, prime)."""

    __tablename__ = "affiliate_earnings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    affiliate_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    # seller_subscription | customer_bonus | bonus
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    reference: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="available", index=True)
    source_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    available_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payout_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    decided_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AffiliatePayout(Base):
    """Demande de paiement d'un affilie : tout le solde disponible, verse par mobile money."""

    __tablename__ = "affiliate_payouts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    affiliate_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    method: Mapped[str] = mapped_column(String(20), nullable=False)
    phone: Mapped[str] = mapped_column(String(24), nullable=False)
    # requested | paid | rejected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="requested", server_default="requested", index=True)
    transaction_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    admin_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    processed_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
