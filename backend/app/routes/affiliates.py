"""Programme d'affiliation et ambassadeurs : lien personnel, gains, paiements, classement."""

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user
from app.core.exceptions import ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.affiliate import (
    AffiliateAccount,
    AffiliateEarning,
    AffiliatePayout,
    AffiliateReferral,
)
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.services.affiliate_service import (
    PayoutError,
    ambassador_percent,
    balances,
    ensure_affiliate_account,
    load_terms,
    mature_earnings,
    monthly_leaderboard,
    remember_affiliate_device,
    request_fingerprints,
    request_payout,
)
from app.services.audit_log_service import append_audit_log

router = APIRouter(prefix="/affiliates", tags=["affiliates"])

KIND_LABELS = {
    "seller_subscription": "Abonnement d'un vendeur parrainé",
    "customer_bonus": "Nouveau client (1re commande livrée)",
    "bonus": "Prime AMAZER",
}


class AffiliateEarnings(BaseModel):
    earned: float
    pending: float
    in_progress: float
    on_hold: float
    review: float
    available: float
    requested: float
    paid: float
    from_sellers: float
    from_customers: float
    from_bonus: float
    orders_delivered: int
    orders_pending: int


class AmbassadorInfo(BaseModel):
    first_month_percent: float
    current_percent: float
    paying_shops: int
    next_tier_shops: int | None
    next_tier_percent: float | None
    monthly_top_bonus: float


class EarningLine(BaseModel):
    id: str
    label: str
    amount: float
    status: str
    note: str | None
    created_at: str
    available_at: str | None


class PayoutLine(BaseModel):
    id: str
    amount: float
    method: str
    phone: str
    status: str
    transaction_reference: str | None
    admin_note: str | None
    created_at: str
    processed_at: str | None


class AffiliateMeResponse(BaseModel):
    code: str
    tier: Literal["affiliate", "ambassador"]
    status: str
    seller_share_percent: float
    seller_share_months: int
    customer_bonus: float
    hold_days: int
    min_payout: float
    clicks: int
    referred_sellers: int
    referred_customers: int
    earnings: AffiliateEarnings
    ambassador: AmbassadorInfo | None
    ambassador_applied: bool
    payout_method: str | None
    payout_phone: str | None
    recent_earnings: list[EarningLine]
    payouts: list[PayoutLine]


class ClickRequest(BaseModel):
    code: str = Field(min_length=4, max_length=16)


class PayoutRequest(BaseModel):
    method: Literal["nita", "amana", "airtel", "moov"]
    phone: str = Field(min_length=8, max_length=24)


class ApplyRequest(BaseModel):
    message: str = Field(min_length=10, max_length=600)


class LeaderboardRow(BaseModel):
    rank: int
    name: str
    new_shops: int
    is_me: bool


class LeaderboardResponse(BaseModel):
    month: str
    top_bonus: float
    rows: list[LeaderboardRow]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def compute_affiliate_earnings(db: Session, user_id: str) -> AffiliateEarnings:
    """Soldes de l'affilie. « earned » = tout ce qui est acquis ou en cours de validation (hors annule)."""
    b = balances(db, user_id)
    return AffiliateEarnings(
        earned=round(b.on_hold + b.review + b.available + b.requested + b.paid, 2),
        pending=b.in_progress,
        **b.__dict__,
    )


def public_name(user: User | None) -> str:
    """Prenom + initiale : jamais le nom complet ni le contact dans un classement public."""
    parts = ((user.full_name if user else "") or "Ambassadeur").split()
    return parts[0] + (f" {parts[1][0]}." if len(parts) > 1 and parts[1] else "")


@router.get("/me", response_model=AffiliateMeResponse)
def my_affiliate(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AffiliateMeResponse:
    account = ensure_affiliate_account(db, user.id)
    ip_hash, device_hash = request_fingerprints(request)
    remember_affiliate_device(account, device_hash, ip_hash)
    mature_earnings(db, user.id)
    db.commit()
    terms = load_terms(db)
    referred_ids = db.scalars(select(AffiliateReferral.referred_user_id).where(AffiliateReferral.affiliate_user_id == user.id)).all()
    sellers = (
        db.scalar(select(func.count(SellerProfile.id)).where(SellerProfile.user_id.in_(referred_ids))) if referred_ids else 0
    ) or 0
    ambassador: AmbassadorInfo | None = None
    if account.tier == "ambassador":
        shops = int(
            db.scalar(
                select(func.count(func.distinct(AffiliateEarning.source_user_id))).where(
                    AffiliateEarning.affiliate_user_id == user.id,
                    AffiliateEarning.kind == "seller_subscription",
                    AffiliateEarning.status != "cancelled",
                )
            )
            or 0
        )
        if shops < terms.ambassador_tier2_shops:
            next_shops, next_percent = terms.ambassador_tier2_shops, terms.ambassador_tier2_percent
        elif shops < terms.ambassador_tier3_shops:
            next_shops, next_percent = terms.ambassador_tier3_shops, terms.ambassador_tier3_percent
        else:
            next_shops, next_percent = None, None
        ambassador = AmbassadorInfo(
            first_month_percent=terms.ambassador_first_month_percent,
            current_percent=ambassador_percent(terms, shops),
            paying_shops=shops,
            next_tier_shops=next_shops,
            next_tier_percent=next_percent,
            monthly_top_bonus=terms.ambassador_monthly_top_bonus,
        )
    recent = db.scalars(
        select(AffiliateEarning).where(AffiliateEarning.affiliate_user_id == user.id).order_by(AffiliateEarning.created_at.desc()).limit(20)
    ).all()
    payouts = db.scalars(
        select(AffiliatePayout).where(AffiliatePayout.affiliate_user_id == user.id).order_by(AffiliatePayout.created_at.desc()).limit(10)
    ).all()
    return AffiliateMeResponse(
        code=account.code,
        tier="ambassador" if account.tier == "ambassador" else "affiliate",
        status=account.status,
        seller_share_percent=terms.seller_share_percent,
        seller_share_months=terms.seller_share_months,
        customer_bonus=terms.customer_bonus,
        hold_days=terms.hold_days,
        min_payout=terms.min_payout,
        clicks=int(account.click_count or 0),
        referred_sellers=int(sellers),
        referred_customers=len(referred_ids) - int(sellers),
        earnings=compute_affiliate_earnings(db, user.id),
        ambassador=ambassador,
        ambassador_applied=account.ambassador_applied_at is not None,
        payout_method=account.payout_method,
        payout_phone=account.payout_phone,
        recent_earnings=[
            EarningLine(
                id=e.id,
                label=KIND_LABELS.get(e.kind, "Gain"),
                amount=float(e.amount),
                status=e.status,
                # Les motifs de fraude restent internes : l'affilie voit seulement « en verification ».
                note=e.note if e.status == "cancelled" and e.kind == "customer_bonus" and e.note == "commande annulée" else None,
                created_at=_iso(e.created_at) or "",
                available_at=_iso(e.available_at),
            )
            for e in recent
        ],
        payouts=[
            PayoutLine(
                id=p.id,
                amount=float(p.amount),
                method=p.method,
                phone=p.phone,
                status=p.status,
                transaction_reference=p.transaction_reference,
                admin_note=p.admin_note if p.status == "rejected" else None,
                created_at=_iso(p.created_at) or "",
                processed_at=_iso(p.processed_at),
            )
            for p in payouts
        ],
    )


@router.post("/payouts", response_model=PayoutLine)
def create_payout(
    payload: PayoutRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PayoutLine:
    """Demande de versement de tout le solde disponible (une a la fois, au-dessus du minimum)."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="affiliate_payout", limit=5, window_seconds=3600)
    try:
        payout = request_payout(db, user.id, payload.method, payload.phone)
    except PayoutError as exc:
        db.rollback()
        raise ValidationDomainError(str(exc)) from exc
    append_audit_log(
        db,
        event_type="affiliate_payout_requested",
        actor=user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="affiliate_payout",
        entity_id=payout.id,
        details={"amount": payout.amount, "method": payout.method},
    )
    db.commit()
    return PayoutLine(
        id=payout.id,
        amount=float(payout.amount),
        method=payout.method,
        phone=payout.phone,
        status=payout.status,
        transaction_reference=None,
        admin_note=None,
        created_at=datetime.now(UTC).isoformat(),
        processed_at=None,
    )


@router.post("/apply", status_code=204)
def apply_ambassador(
    payload: ApplyRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Candidature pour devenir ambassadeur (l'admin decide)."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="affiliate_apply", limit=3, window_seconds=86400)
    account = ensure_affiliate_account(db, user.id)
    if account.tier == "ambassador":
        raise ValidationDomainError("Vous êtes déjà ambassadeur.")
    account.ambassador_applied_at = datetime.now(UTC)
    account.ambassador_application = payload.message.strip()
    db.commit()


@router.get("/leaderboard", response_model=LeaderboardResponse)
def leaderboard(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> LeaderboardResponse:
    """Classement du mois des ambassadeurs (prenom + initiale uniquement)."""
    rows = monthly_leaderboard(db, limit=10)
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_([r[0] for r in rows])))} if rows else {}
    return LeaderboardResponse(
        month=datetime.now(UTC).strftime("%Y-%m"),
        top_bonus=load_terms(db).ambassador_monthly_top_bonus,
        rows=[
            LeaderboardRow(rank=i + 1, name=public_name(users.get(uid)), new_shops=shops, is_me=uid == user.id)
            for i, (uid, shops, _total) in enumerate(rows)
        ],
    )


@router.post("/click", status_code=204)
def record_click(payload: ClickRequest, request: Request, db: Annotated[Session, Depends(get_db)]) -> None:
    """Compte une visite venue d'un lien affilie (statistique seulement : un clic ne rapporte rien)."""
    enforce_rate_limit(request, key="affiliate_click", limit=20, window_seconds=3600)
    db.execute(
        update(AffiliateAccount)
        .where(AffiliateAccount.code == payload.code.strip().upper())
        .values(click_count=AffiliateAccount.click_count + 1)
    )
    db.commit()
