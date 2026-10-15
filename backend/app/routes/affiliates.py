"""Programme d'affiliation : lien personnel, clics, gains."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.affiliate import AffiliateAccount
from app.models.order import Order
from app.models.user import User
from app.services.affiliate_service import affiliate_percent, ensure_affiliate_account

router = APIRouter(prefix="/affiliates", tags=["affiliates"])

DELIVERED = ("recu", "CLAIMED")
CANCELLED = "annulee"


class AffiliateEarnings(BaseModel):
    earned: float
    pending: float
    orders_delivered: int
    orders_pending: int


class AffiliateMeResponse(BaseModel):
    code: str
    commission_percent: float
    clicks: int
    earnings: AffiliateEarnings


class ClickRequest(BaseModel):
    code: str = Field(min_length=4, max_length=16)


def compute_affiliate_earnings(db: Session, user_id: str) -> AffiliateEarnings:
    """Gagne = commandes payees et livrees ; en attente = payees, pas encore livrees ; annulees exclues."""
    rows = db.execute(
        select(Order.status, Order.affiliate_commission).where(
            Order.affiliate_user_id == user_id, Order.payment_status == "paid", Order.status != CANCELLED
        )
    ).all()
    earned = [float(amount or 0) for status, amount in rows if status in DELIVERED]
    pending = [float(amount or 0) for status, amount in rows if status not in DELIVERED]
    return AffiliateEarnings(
        earned=round(sum(earned), 2),
        pending=round(sum(pending), 2),
        orders_delivered=len(earned),
        orders_pending=len(pending),
    )


@router.get("/me", response_model=AffiliateMeResponse)
def my_affiliate(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AffiliateMeResponse:
    account = ensure_affiliate_account(db, user.id)
    db.commit()
    return AffiliateMeResponse(
        code=account.code,
        commission_percent=affiliate_percent(db),
        clicks=int(account.click_count or 0),
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
