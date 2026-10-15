"""Programme d'affiliation : lien personnel, parrainages, gains."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.affiliate import AffiliateAccount, AffiliateEarning, AffiliateReferral
from app.models.order import Order
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.services.affiliate_service import affiliate_terms, ensure_affiliate_account

router = APIRouter(prefix="/affiliates", tags=["affiliates"])

DELIVERED = ("recu", "CLAIMED")
CANCELLED = "annulee"


class AffiliateEarnings(BaseModel):
    earned: float
    pending: float
    from_sellers: float
    from_customers: float
    orders_delivered: int
    orders_pending: int


class AffiliateMeResponse(BaseModel):
    code: str
    seller_share_percent: float
    seller_share_months: int
    customer_bonus: float
    clicks: int
    referred_sellers: int
    referred_customers: int
    earnings: AffiliateEarnings


class ClickRequest(BaseModel):
    code: str = Field(min_length=4, max_length=16)


def compute_affiliate_earnings(db: Session, user_id: str) -> AffiliateEarnings:
    """Acquis = parts d'abonnements + bonus des premieres commandes livrees ; en attente = bonus pas encore livres."""
    rows = db.execute(
        select(Order.status, Order.affiliate_commission).where(
            Order.affiliate_user_id == user_id, Order.payment_status == "paid", Order.status != CANCELLED
        )
    ).all()
    delivered = [float(amount or 0) for status, amount in rows if status in DELIVERED]
    pending = [float(amount or 0) for status, amount in rows if status not in DELIVERED]
    from_sellers = float(
        db.scalar(select(func.coalesce(func.sum(AffiliateEarning.amount), 0)).where(AffiliateEarning.affiliate_user_id == user_id))
        or 0
    )
    from_customers = sum(delivered)
    return AffiliateEarnings(
        earned=round(from_sellers + from_customers, 2),
        pending=round(sum(pending), 2),
        from_sellers=round(from_sellers, 2),
        from_customers=round(from_customers, 2),
        orders_delivered=len(delivered),
        orders_pending=len(pending),
    )


@router.get("/me", response_model=AffiliateMeResponse)
def my_affiliate(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AffiliateMeResponse:
    account = ensure_affiliate_account(db, user.id)
    db.commit()
    percent, months, bonus = affiliate_terms(db)
    referred_ids = db.scalars(select(AffiliateReferral.referred_user_id).where(AffiliateReferral.affiliate_user_id == user.id)).all()
    sellers = (
        db.scalar(select(func.count(SellerProfile.id)).where(SellerProfile.user_id.in_(referred_ids))) if referred_ids else 0
    ) or 0
    return AffiliateMeResponse(
        code=account.code,
        seller_share_percent=percent,
        seller_share_months=months,
        customer_bonus=bonus,
        clicks=int(account.click_count or 0),
        referred_sellers=int(sellers),
        referred_customers=len(referred_ids) - int(sellers),
        earnings=compute_affiliate_earnings(db, user.id),
    )


@router.post("/click", status_code=204)
def record_click(payload: ClickRequest, request: Request, db: Annotated[Session, Depends(get_db)]) -> None:
    """Compte une visite venue d'un lien affilie (limite par adresse IP pour eviter le gonflement)."""
    enforce_rate_limit(request, key="affiliate_click", limit=20, window_seconds=3600)
    db.execute(
        update(AffiliateAccount)
        .where(AffiliateAccount.code == payload.code.strip().upper())
        .values(click_count=AffiliateAccount.click_count + 1)
    )
    db.commit()
