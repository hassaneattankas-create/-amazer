import re
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_seller_user_with_mfa
from app.core.exceptions import ConflictError, NotFoundError
from app.database import get_db
from app.models.price_history import PriceHistory
from app.models.product import Price, Product
from app.models.seller_profile import SellerProfile
from app.models.seller_lead import SellerLead
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.seller import (
    SellerInventoryItemResponse,
    SellerInventoryUpdateRequest,
    SellerProductCreateRequest,
    SellerProductCreateResponse,
    SellerProfileRequest,
    SellerProfileResponse,
)
from app.schemas.seller_lead import SellerLeadCreateRequest, SellerLeadResponse
from app.services.audit_log_service import append_audit_log

router = APIRouter(prefix="/seller", tags=["seller"])


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _parse_utc_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _sync_product_flags(product: Product) -> tuple[float | None, datetime | None, datetime | None]:
    specs = product.specs or {}
    now = datetime.now(UTC)
    promo_price_raw = specs.get("promo_price")
    promo_until = _parse_utc_datetime(specs.get("promo_until"))
    boost_until = _parse_utc_datetime(specs.get("boost_until"))

    promo_price = None
    if isinstance(promo_price_raw, (int, float)) and promo_until and promo_until > now:
        promo_price = float(promo_price_raw)
    if boost_until is None or boost_until <= now:
        product.is_boosted = False
    return promo_price, promo_until, boost_until


@router.get("/profile", response_model=SellerProfileResponse | None)
def get_profile(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user_with_mfa)],
) -> SellerProfileResponse | None:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return None
    return SellerProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        vendor_id=profile.vendor_id,
        business_name=profile.business_name,
        phone=profile.phone,
        city=profile.city,
        address=profile.address,
        is_verified=profile.is_verified,
        created_at=profile.created_at,
    )


@router.post("/profile", response_model=SellerProfileResponse, status_code=status.HTTP_201_CREATED)
def upsert_profile(
    payload: SellerProfileRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user_with_mfa)],
) -> SellerProfileResponse:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        slug_base = _slugify(payload.business_name) or f"vendor-{current_user.id[:8]}"
        slug = slug_base
        suffix = 1
        while db.scalar(select(Vendor).where(Vendor.slug == slug)) is not None:
            suffix += 1
            slug = f"{slug_base}-{suffix}"

        vendor = Vendor(name=payload.business_name, slug=slug, is_active=True)
        db.add(vendor)
        db.flush()

        profile = SellerProfile(
            user_id=current_user.id,
            vendor_id=vendor.id,
            business_name=payload.business_name,
            phone=payload.phone,
            city=payload.city,
            address=payload.address,
        )
        db.add(profile)
    else:
        profile.business_name = payload.business_name
        profile.phone = payload.phone
        profile.city = payload.city
        profile.address = payload.address
        vendor_record = db.get(Vendor, profile.vendor_id)
        if vendor_record is None:
            raise ConflictError("Associated vendor not found")
        vendor_record.name = payload.business_name

    db.commit()
    db.refresh(profile)
    return SellerProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        vendor_id=profile.vendor_id,
        business_name=profile.business_name,
        phone=profile.phone,
        city=profile.city,
        address=profile.address,
        is_verified=profile.is_verified,
        created_at=profile.created_at,
    )


@router.post("/products", response_model=SellerProductCreateResponse, status_code=status.HTTP_201_CREATED)
def create_product_listing(
    payload: SellerProductCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user_with_mfa)],
) -> SellerProductCreateResponse:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Create a seller profile first")

    product = Product(
        name=payload.name,
        brand=payload.brand,
        description=payload.description,
        main_image_url=payload.main_image_url,
        is_sponsored=payload.is_sponsored,
        category_id=payload.category_id,
        specs={},
    )
    db.add(product)
    db.flush()

    price = Price(
        product_id=product.id,
        vendor_id=profile.vendor_id,
        currency=payload.currency.upper(),
        amount=payload.amount,
        stock_quantity=payload.stock_quantity,
        is_active=True,
    )
    db.add(price)
    db.flush()

    db.add(
        PriceHistory(
            price_id=price.id,
            previous_amount=payload.amount,
            new_amount=payload.amount,
            previous_stock_quantity=payload.stock_quantity,
            new_stock_quantity=payload.stock_quantity,
            reason="seller_listing_created",
        )
    )
    append_audit_log(
        db,
        event_type="seller_price_created",
        actor=current_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="price",
        entity_id=price.id,
        details={
            "product_id": product.id,
            "amount": float(price.amount),
            "currency": price.currency,
            "stock_quantity": int(price.stock_quantity),
        },
    )

    db.commit()
    return SellerProductCreateResponse(
        product_id=product.id,
        price_id=price.id,
        vendor_id=profile.vendor_id,
    )


@router.get("/inventory", response_model=list[SellerInventoryItemResponse])
def list_inventory(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user_with_mfa)],
) -> list[SellerInventoryItemResponse]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return []

    rows = db.scalars(
        select(Price).where(Price.vendor_id == profile.vendor_id).order_by(Price.updated_at.desc())
    ).all()
    payload: list[SellerInventoryItemResponse] = []
    for row in rows:
        promo_price, promo_until, boost_until = _sync_product_flags(row.product)
        payload.append(
            SellerInventoryItemResponse(
                price_id=row.id,
                product_id=row.product_id,
                product_name=row.product.name,
                brand=row.product.brand,
                amount=row.amount,
                currency=row.currency,
                stock_quantity=row.stock_quantity,
                is_active=row.is_active,
                is_boosted=row.product.is_boosted,
                promo_price=promo_price,
                promo_until=promo_until,
                boost_until=boost_until,
            )
        )
    return payload


@router.patch("/inventory/{price_id}", response_model=SellerInventoryItemResponse)
def update_inventory_item(
    price_id: str,
    payload: SellerInventoryUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user_with_mfa)],
) -> SellerInventoryItemResponse:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")

    price = db.get(Price, price_id)
    if price is None or price.vendor_id != profile.vendor_id:
        raise NotFoundError("Inventory item not found")

    previous_amount = price.amount
    previous_stock = price.stock_quantity
    now = datetime.now(UTC)
    specs = dict(price.product.specs or {})
    if payload.amount is not None:
        price.amount = payload.amount
    if payload.stock_quantity is not None:
        price.stock_quantity = payload.stock_quantity
    if payload.is_active is not None:
        price.is_active = payload.is_active
    if payload.promo_amount is not None:
        specs["promo_price"] = payload.promo_amount
        specs["promo_until"] = (now + timedelta(days=7)).isoformat()
        price.amount = payload.promo_amount
    if payload.boost_duration_hours is not None:
        price.product.is_boosted = True
        specs["boost_until"] = (now + timedelta(hours=payload.boost_duration_hours)).isoformat()
    price.product.specs = specs

    db.add(
        PriceHistory(
            price_id=price.id,
            previous_amount=previous_amount,
            new_amount=price.amount,
            previous_stock_quantity=previous_stock,
            new_stock_quantity=price.stock_quantity,
            reason="seller_inventory_update",
        )
    )
    append_audit_log(
        db,
        event_type="seller_price_updated",
        actor=current_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="price",
        entity_id=price.id,
        details={
            "previous_amount": float(previous_amount),
            "new_amount": float(price.amount),
            "previous_stock": int(previous_stock),
            "new_stock": int(price.stock_quantity),
            "is_active": bool(price.is_active),
            "boosted": bool(price.product.is_boosted),
            "promo_amount": payload.promo_amount,
        },
    )
    db.commit()
    db.refresh(price)

    promo_price, promo_until, boost_until = _sync_product_flags(price.product)
    return SellerInventoryItemResponse(
        price_id=price.id,
        product_id=price.product_id,
        product_name=price.product.name,
        brand=price.product.brand,
        amount=price.amount,
        currency=price.currency,
        stock_quantity=price.stock_quantity,
        is_active=price.is_active,
        is_boosted=price.product.is_boosted,
        promo_price=promo_price,
        promo_until=promo_until,
        boost_until=boost_until,
    )


@router.post("/leads", response_model=SellerLeadResponse, status_code=status.HTTP_201_CREATED)
def create_seller_lead(
    payload: SellerLeadCreateRequest,
    db: Annotated[Session, Depends(get_db)],
) -> SellerLeadResponse:
    lead = SellerLead(
        shop_name=payload.shop_name,
        district=payload.district,
        contact=payload.contact,
        product_type=payload.product_type,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return SellerLeadResponse(
        id=lead.id,
        shop_name=lead.shop_name,
        district=lead.district,
        contact=lead.contact,
        product_type=lead.product_type,
        created_at=lead.created_at,
    )


@router.get("/leads", response_model=list[SellerLeadResponse])
def list_seller_leads(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> list[SellerLeadResponse]:
    leads = db.scalars(select(SellerLead).order_by(SellerLead.created_at.desc()).limit(200)).all()
    return [
        SellerLeadResponse(
            id=lead.id,
            shop_name=lead.shop_name,
            district=lead.district,
            contact=lead.contact,
            product_type=lead.product_type,
            created_at=lead.created_at,
        )
        for lead in leads
    ]
