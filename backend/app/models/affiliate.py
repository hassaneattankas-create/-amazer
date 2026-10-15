"""Programme d'affiliation : un lien personnel, une commission sur les ventes apportees.

Le client paie le prix normal. Si la commande est passee dans les 30 jours apres un clic sur
le lien de l'affilie, celui-ci gagne un pourcentage du montant des articles, verse apres livraison.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AffiliateAccount(Base):
    __tablename__ = "affiliate_accounts"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    click_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
