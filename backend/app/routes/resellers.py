"""Revente sans stock (dropshipping AMAZER) : annonces du revendeur, boutique publique, gains.

Tout membre connecte peut revendre une offre active d'une autre boutique, a un prix
superieur ou egal au prix de la boutique. Aucun stock, aucune livraison a gerer :
la boutique d'origine prepare, AMAZER livre, la marge revient au revendeur.
"""


from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user
from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.order import Order, OrderItem
from app.models.product import Price
from app.models.reseller import ResellerListing, ResellerSubscriptionPayment
from app.services.reseller_account_service import ensure_account, reseller_terms, subscription_active
from app.models.seller_profile import SellerProfile
from app.models.user import User

router = APIRouter(prefix="/resellers", tags=["resellers"])

MAX_LISTINGS = 200
MAX_MARKUP_RATIO = 3.0  # prix de revente plafonne a 3x le prix boutique (evite les abus)
DELIVERED = ("recu", "CLAIMED")
CANCELLED = "annulee"


class ListingCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_id: str = Field(min_length=1, max_length=36)
    resale_amount: float = Field(gt=0)


class ListingUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resale_amount: float | None = Field(default=None, gt=0)
    is_active: bool | None = None


class ListingResponse(BaseModel):
    id: str
    price_id: str
    product_id: str
    product_name: str
    image_url: str | None
    supplier_amount: float
    resale_amount: float
    margin: float
    in_stock: bool
    is_active: bool
    sales_count: int = 0


class PublicListing(BaseModel):
    """Vue client : jamais le prix boutique ni la marge du revendeur."""

    id: str
    price_id: str
    vendor_id: str
    product_id: str
    product_name: str
    image_url: str | None
    price: float


class ResellerShopResponse(BaseModel):
    reseller_id: str
    reseller_name: str
    active: bool = True
    items: list[PublicListing]


class AccountResponse(BaseModel):
    active: bool
    paid_until: str | None
    monthly_fee: float
    commission_percent: float
    pending_payment: bool


class SubscriptionPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    payment_mode: str = Field(pattern="^(nita|amana)$")
    transaction_reference: str = Field(min_length=4, max_length=180)
    months: int = Field(default=1, ge=1, le=12)


class EarningsResponse(BaseModel):
    """Montants nets pour le revendeur (marge moins la commission AMAZER)."""

    earned: float
    pending: float
    orders_delivered: int
    orders_pending: int


def _first_name(full_name: str | None) -> str:
    return (full_name or "Revendeur").strip().split(" ")[0] or "Revendeur"


def _validate_amount(price: Price, resale_amount: float) -> float:
    supplier = float(price.amount)
    if resale_amount < supplier:
        raise ValidationDomainError(f"Le prix de revente doit être au moins égal au prix boutique ({int(supplier)} XOF).")
    if resale_amount > supplier * MAX_MARKUP_RATIO:
        raise ValidationDomainError("Prix de revente trop élevé : 3 fois le prix boutique au maximum.")
    return round(resale_amount, 2)


def _to_response(listing: ResellerListing, price: Price, sales_count: int = 0) -> ListingResponse:
    product = price.product
    supplier = float(price.amount)
    resale = max(float(listing.resale_amount), supplier)
    return ListingResponse(
        id=listing.id,
        price_id=price.id,
        product_id=price.product_id,
        product_name=product.name if product else "Article",
        image_url=product.main_image_url if product else None,
        supplier_amount=supplier,
        resale_amount=resale,
        margin=round(resale - supplier, 2),
        in_stock=price.stock_quantity > 0,
        is_active=listing.is_active,
        sales_count=sales_count,
    )


def _require_subscription(db: Session, user_id: str) -> None:
    ensure_account(db, user_id)
    if not subscription_active(db, user_id):
        fee, _percent = reseller_terms(db)
        db.commit()  # garde le compte cree (et l'essai eventuel)
        raise ConflictError(
            f"Abonnement revendeur requis ({int(fee)} XOF par mois). Payez-le dans « Revendre » pour publier."
        )


def _owned_listing(db: Session, listing_id: str, user: User) -> ResellerListing:
    listing = db.get(ResellerListing, listing_id)
    if listing is None or listing.reseller_user_id != user.id:
        raise NotFoundError("Annonce introuvable")
    return listing


@router.post("/listings", response_model=ListingResponse)
def create_listing(
    payload: ListingCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ListingResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="reseller_listing_create", limit=60, window_seconds=600)
    price = db.scalar(select(Price).where(Price.id == payload.price_id).options(selectinload(Price.product)))
    if price is None or not price.is_active:
        raise NotFoundError("Produit indisponible")
    own_vendor = db.scalar(select(SellerProfile.vendor_id).where(SellerProfile.user_id == user.id))
    if own_vendor and own_vendor == price.vendor_id:
        raise ValidationDomainError("Ce produit est déjà dans votre boutique.")
    count = db.scalar(select(func.count(ResellerListing.id)).where(ResellerListing.reseller_user_id == user.id)) or 0
    existing = db.scalar(
        select(ResellerListing).where(ResellerListing.reseller_user_id == user.id, ResellerListing.price_id == price.id)
    )
    amount = _validate_amount(price, payload.resale_amount)
    _require_subscription(db, user.id)
    if existing is not None:
        existing.resale_amount = amount
        existing.is_active = True
        listing = existing
    else:
        if count >= MAX_LISTINGS:
            raise ConflictError(f"Limite de {MAX_LISTINGS} produits revendus atteinte.")
        listing = ResellerListing(reseller_user_id=user.id, price_id=price.id, resale_amount=amount)
        db.add(listing)
    db.commit()
    db.refresh(listing)
    return _to_response(listing, price)


def _listings_with_prices(db: Session, user_id: str, *, active_only: bool) -> list[tuple[ResellerListing, Price]]:
    stmt = (
        select(ResellerListing, Price)
        .join(Price, Price.id == ResellerListing.price_id)
        .where(ResellerListing.reseller_user_id == user_id)
        .options(selectinload(Price.product))
        .order_by(ResellerListing.created_at.desc())
    )
    if active_only:
        stmt = stmt.where(ResellerListing.is_active.is_(True), Price.is_active.is_(True))
    return [(row[0], row[1]) for row in db.execute(stmt).all()]


@router.get("/listings/me", response_model=list[ListingResponse])
def my_listings(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[ListingResponse]:
    sales = dict(
        db.execute(
            select(OrderItem.reseller_listing_id, func.coalesce(func.sum(OrderItem.quantity), 0))
            .join(Order, Order.id == OrderItem.order_id)
            .where(OrderItem.reseller_user_id == user.id, Order.payment_status == "paid", Order.status != CANCELLED)
            .group_by(OrderItem.reseller_listing_id)
        ).all()
    )
    return [
        _to_response(listing, price, int(sales.get(listing.id, 0)))
        for listing, price in _listings_with_prices(db, user.id, active_only=False)
    ]


@router.patch("/listings/{listing_id}", response_model=ListingResponse)
def update_listing(
    listing_id: str,
    payload: ListingUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ListingResponse:
    enforce_csrf(request)
    listing = _owned_listing(db, listing_id, user)
    price = db.scalar(select(Price).where(Price.id == listing.price_id).options(selectinload(Price.product)))
    if price is None:
        raise NotFoundError("Produit indisponible")
    if payload.resale_amount is not None:
        listing.resale_amount = _validate_amount(price, payload.resale_amount)
    if payload.is_active is not None:
        if payload.is_active:
            _require_subscription(db, user.id)
        listing.is_active = payload.is_active
    db.commit()
    db.refresh(listing)
    return _to_response(listing, price)


@router.delete("/listings/{listing_id}", status_code=204)
def delete_listing(
    listing_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    enforce_csrf(request)
    db.delete(_owned_listing(db, listing_id, user))
    db.commit()


@router.get("/earnings/me", response_model=EarningsResponse)
def my_earnings(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> EarningsResponse:
    return compute_earnings(db, user.id)


def compute_earnings(db: Session, user_id: str) -> EarningsResponse:
    """Gagne = commandes payees et livrees ; en attente = payees, pas encore livrees."""
    rows = db.execute(
        select(Order.id, Order.status, func.sum(OrderItem.reseller_margin - OrderItem.reseller_commission))
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(OrderItem.reseller_user_id == user_id, Order.payment_status == "paid", Order.status != CANCELLED)
        .group_by(Order.id, Order.status)
    ).all()
    earned = sum(float(total or 0) for _id, status, total in rows if status in DELIVERED)
    pending = sum(float(total or 0) for _id, status, total in rows if status not in DELIVERED)
    return EarningsResponse(
        earned=round(earned, 2),
        pending=round(pending, 2),
        orders_delivered=sum(1 for _id, status, _t in rows if status in DELIVERED),
        orders_pending=sum(1 for _id, status, _t in rows if status not in DELIVERED),
    )


@router.get("/{reseller_id}/shop", response_model=ResellerShopResponse)
def reseller_shop(reseller_id: str, db: Annotated[Session, Depends(get_db)]) -> ResellerShopResponse:
    """Boutique publique du revendeur : uniquement ses annonces actives et en stock."""
    reseller = db.get(User, reseller_id)
    if reseller is None or not reseller.is_active:
        raise NotFoundError("Boutique introuvable")
    if not subscription_active(db, reseller_id):
        return ResellerShopResponse(reseller_id=reseller.id, reseller_name=_first_name(reseller.full_name), active=False, items=[])
    items = [
        PublicListing(
            id=listing.id,
            price_id=price.id,
            vendor_id=price.vendor_id,
            product_id=price.product_id,
            product_name=price.product.name if price.product else "Article",
            image_url=price.product.main_image_url if price.product else None,
            price=max(float(listing.resale_amount), float(price.amount)),
        )
        for listing, price in _listings_with_prices(db, reseller_id, active_only=True)
        if price.stock_quantity > 0
    ]
    return ResellerShopResponse(reseller_id=reseller.id, reseller_name=_first_name(reseller.full_name), items=items)


@router.get("/account/me", response_model=AccountResponse)
def my_account(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AccountResponse:
    account = ensure_account(db, user.id)
    db.commit()
    fee, percent = reseller_terms(db)
    pending = db.scalar(
        select(ResellerSubscriptionPayment.id).where(
            ResellerSubscriptionPayment.user_id == user.id, ResellerSubscriptionPayment.status == "pending"
        )
    )
    return AccountResponse(
        active=subscription_active(db, user.id),
        paid_until=account.paid_until.isoformat() if account.paid_until else None,
        monthly_fee=fee,
        commission_percent=percent,
        pending_payment=pending is not None,
    )


@router.post("/account/payments", response_model=AccountResponse)
def submit_subscription_payment(
    payload: SubscriptionPaymentRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AccountResponse:
    """Le revendeur declare son paiement (Nita / Amana) ; l'admin le valide avant activation."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="reseller_subscription_payment", limit=5, window_seconds=600)
    ensure_account(db, user.id)
    already = db.scalar(
        select(ResellerSubscriptionPayment.id).where(
            ResellerSubscriptionPayment.user_id == user.id, ResellerSubscriptionPayment.status == "pending"
        )
    )
    if already is not None:
        raise ConflictError("Un paiement est déjà en cours de vérification.")
    reused = db.scalar(
        select(ResellerSubscriptionPayment.id).where(
            func.lower(ResellerSubscriptionPayment.transaction_reference) == payload.transaction_reference.lower()
        )
    )
    if reused is not None:
        raise ConflictError("Cette référence de paiement a déjà été utilisée.")
    fee, _percent = reseller_terms(db)
    db.add(
        ResellerSubscriptionPayment(
            user_id=user.id,
            payment_mode=payload.payment_mode,
            transaction_reference=payload.transaction_reference,
            months=payload.months,
            amount_claimed=fee * payload.months,
        )
    )
    db.commit()
    return my_account(db, user)

