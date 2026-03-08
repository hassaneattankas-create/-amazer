import re
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user
from app.core.crypto import decrypt_phone_value, encrypt_phone_value
from app.core.csrf import enforce_csrf
from app.core.exceptions import ConflictError, NotFoundError
from app.database import get_db
from app.models.hospitality import HotelBooking, RestaurantReservation
from app.models.price_history import PriceHistory
from app.models.product import Price, Product
from app.models.restaurant import RestaurantMenuItem
from app.models.seller_profile import SellerProfile
from app.models.seller_lead import SellerLead
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.restaurant import (
    RestaurantMenuItemResponse,
    RestaurantReservationCreateRequest,
    RestaurantReservationResponse,
    RestaurantReservationStatusUpdateRequest,
)
from app.schemas.seller import (
    HotelBookingCreateRequest,
    HotelBookingResponse,
    HotelBookingStatusUpdateRequest,
    SellerInventoryItemResponse,
    SellerInventoryUpdateRequest,
    SellerProductCreateRequest,
    SellerProductCreateResponse,
    SellerProfileRequest,
    SellerProfileResponse,
    SellerStorefrontProductResponse,
    SellerStorefrontResponse,
)
from app.schemas.seller_lead import SellerLeadCreateRequest, SellerLeadResponse
from app.services.audit_log_service import append_audit_log
from app.services.seller_profile_service import create_or_update_seller_profile

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


def _profile_response(profile: SellerProfile) -> SellerProfileResponse:
    return SellerProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        vendor_id=profile.vendor_id,
        business_name=profile.business_name,
        phone=decrypt_phone_value(profile.phone),
        city=profile.city,
        address=profile.address,
        activity_type=profile.activity_type,
        storefront_tier=profile.storefront_tier,
        description=profile.description,
        logo_url=profile.logo_url,
        cover_image_url=profile.cover_image_url,
        opening_hours=profile.opening_hours,
        whatsapp_contact=profile.whatsapp_contact,
        contact_email=profile.contact_email,
        gallery_images=list(profile.gallery_images or []),
        service_offerings=list(profile.service_offerings or []),
        room_types=list(profile.room_types or []),
        deposit_payment_method=profile.deposit_payment_method,
        deposit_amount=profile.deposit_amount,
        accepts_table_reservations=bool(profile.accepts_table_reservations),
        accepts_hotel_bookings=bool(profile.accepts_hotel_bookings),
        is_verified=profile.is_verified,
        created_at=profile.created_at,
    )


def _hotel_booking_response(row: HotelBooking) -> HotelBookingResponse:
    return HotelBookingResponse(
        id=row.id,
        vendor_id=row.vendor_id,
        room_type_id=row.room_type_id,
        room_snapshot=row.room_snapshot or {},
        guest_name=row.guest_name,
        guest_phone=decrypt_phone_value(row.guest_phone) or "***",
        guest_email=row.guest_email,
        check_in_date=row.check_in_date,
        check_out_date=row.check_out_date,
        guest_count=row.guest_count,
        deposit_payment_method=row.deposit_payment_method,  # type: ignore[arg-type]
        deposit_amount=row.deposit_amount,
        transaction_reference=row.transaction_reference,
        special_request=row.special_request,
        status=row.status,  # type: ignore[arg-type]
        created_at=row.created_at,
    )


@router.get("/profile", response_model=SellerProfileResponse | None)
def get_profile(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SellerProfileResponse | None:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return None
    return _profile_response(profile)


@router.post("/profile", response_model=SellerProfileResponse, status_code=status.HTTP_201_CREATED)
def upsert_profile(
    payload: SellerProfileRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SellerProfileResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    profile = create_or_update_seller_profile(
        db,
        user=current_user,
        payload=payload.model_dump(exclude_none=True),
        existing_profile=profile,
    )
    db.commit()
    db.refresh(profile)
    return _profile_response(profile)


@router.get("/storefront/{vendor_id}", response_model=SellerStorefrontResponse)
def get_storefront(
    vendor_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> SellerStorefrontResponse:
    vendor = db.get(Vendor, vendor_id)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
    if vendor is None or profile is None:
        raise NotFoundError("Storefront not found")

    products = db.scalars(
        select(Price)
        .where(Price.vendor_id == vendor_id, Price.is_active.is_(True))
        .order_by(Price.updated_at.desc())
        .limit(120)
    ).all()
    restaurant_menu = db.scalars(
        select(RestaurantMenuItem)
        .where(RestaurantMenuItem.vendor_id == vendor_id, RestaurantMenuItem.is_available.is_(True))
        .order_by(RestaurantMenuItem.updated_at.desc())
        .limit(120)
    ).all()

    return SellerStorefrontResponse(
        vendor_id=vendor.id,
        vendor_slug=vendor.slug,
        business_name=profile.business_name,
        activity_type=profile.activity_type,
        storefront_tier=profile.storefront_tier,
        city=profile.city,
        address=profile.address,
        phone=decrypt_phone_value(profile.phone),
        description=profile.description,
        logo_url=profile.logo_url,
        cover_image_url=profile.cover_image_url,
        opening_hours=profile.opening_hours,
        whatsapp_contact=profile.whatsapp_contact,
        contact_email=profile.contact_email,
        gallery_images=list(profile.gallery_images or []),
        service_offerings=list(profile.service_offerings or []),
        room_types=list(profile.room_types or []),
        deposit_payment_method=profile.deposit_payment_method,
        deposit_amount=profile.deposit_amount,
        accepts_table_reservations=bool(profile.accepts_table_reservations),
        accepts_hotel_bookings=bool(profile.accepts_hotel_bookings),
        is_verified=profile.is_verified,
        products=[
            SellerStorefrontProductResponse(
                price_id=row.id,
                product_id=row.product_id,
                name=row.product.name,
                brand=row.product.brand,
                amount=row.amount,
                currency=row.currency,
                is_boosted=row.product.is_boosted,
                main_image_url=row.product.main_image_url,
            )
            for row in products
        ],
        restaurant_menu=[
            RestaurantMenuItemResponse(
                id=item.id,
                vendor_id=item.vendor_id,
                vendor_name=vendor.name,
                name=item.name,
                description=item.description,
                image_url=item.image_url,
                base_price=item.base_price,
                currency=item.currency,
                tags=list(item.tags or []),
                options=list(item.options or []),
                estimated_prep_minutes=item.estimated_prep_minutes,
                is_available=item.is_available,
            )
            for item in restaurant_menu
        ],
    )


@router.post("/products", response_model=SellerProductCreateResponse, status_code=status.HTTP_201_CREATED)
def create_product_listing(
    payload: SellerProductCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SellerProductCreateResponse:
    enforce_csrf(request)
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
    current_user: Annotated[User, Depends(get_current_user)],
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
    current_user: Annotated[User, Depends(get_current_user)],
) -> SellerInventoryItemResponse:
    enforce_csrf(request)
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


@router.post(
    "/storefront/{vendor_id}/restaurant-reservations",
    response_model=RestaurantReservationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_restaurant_reservation(
    vendor_id: str,
    payload: RestaurantReservationCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RestaurantReservationResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
    if profile is None or profile.activity_type != "restaurant":
        raise NotFoundError("Restaurant storefront not found")
    if not profile.accepts_table_reservations:
        raise ConflictError("Table reservations are disabled for this restaurant")

    reservation = RestaurantReservation(
        vendor_id=vendor_id,
        user_id=current_user.id,
        customer_name=payload.customer_name,
        customer_phone=encrypt_phone_value(payload.customer_phone) or payload.customer_phone,
        reservation_at=payload.reservation_at,
        guest_count=payload.guest_count,
        note=payload.note,
        status="pending",
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return RestaurantReservationResponse(
        id=reservation.id,
        vendor_id=reservation.vendor_id,
        customer_name=reservation.customer_name,
        customer_phone=decrypt_phone_value(reservation.customer_phone) or "***",
        reservation_at=reservation.reservation_at,
        guest_count=reservation.guest_count,
        note=reservation.note,
        status=reservation.status,
        created_at=reservation.created_at,
    )


@router.get("/restaurant-reservations", response_model=list[RestaurantReservationResponse])
def list_seller_restaurant_reservations(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[RestaurantReservationResponse]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return []
    rows = db.scalars(
        select(RestaurantReservation)
        .where(RestaurantReservation.vendor_id == profile.vendor_id)
        .order_by(RestaurantReservation.reservation_at.asc())
        .limit(100)
    ).all()
    return [
        RestaurantReservationResponse(
            id=row.id,
            vendor_id=row.vendor_id,
            customer_name=row.customer_name,
            customer_phone=decrypt_phone_value(row.customer_phone) or "***",
            reservation_at=row.reservation_at,
            guest_count=row.guest_count,
            note=row.note,
            status=row.status,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.patch(
    "/restaurant-reservations/{reservation_id}/status",
    response_model=RestaurantReservationResponse,
)
def update_restaurant_reservation_status(
    reservation_id: str,
    payload: RestaurantReservationStatusUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RestaurantReservationResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    reservation = db.get(RestaurantReservation, reservation_id)
    if reservation is None or reservation.vendor_id != profile.vendor_id:
        raise NotFoundError("Reservation not found")
    reservation.status = payload.status
    db.commit()
    db.refresh(reservation)
    return RestaurantReservationResponse(
        id=reservation.id,
        vendor_id=reservation.vendor_id,
        customer_name=reservation.customer_name,
        customer_phone=decrypt_phone_value(reservation.customer_phone) or "***",
        reservation_at=reservation.reservation_at,
        guest_count=reservation.guest_count,
        note=reservation.note,
        status=reservation.status,
        created_at=reservation.created_at,
    )


@router.post(
    "/storefront/{vendor_id}/hotel-bookings",
    response_model=HotelBookingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_hotel_booking(
    vendor_id: str,
    payload: HotelBookingCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> HotelBookingResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
    if profile is None or profile.activity_type not in {"hotel", "enterprise"}:
        raise NotFoundError("Hotel storefront not found")
    if not profile.accepts_hotel_bookings:
        raise ConflictError("Hotel bookings are disabled for this storefront")

    room_map = {
        str(room.get("id")): room
        for room in (profile.room_types or [])
        if isinstance(room, dict) and room.get("id")
    }
    room = room_map.get(payload.room_type_id)
    if room is None:
        raise NotFoundError("Room type not found")

    nights = (payload.check_out_date - payload.check_in_date).days
    if nights <= 0:
        raise ConflictError("Check-out must be after check-in")
    deposit_amount = float(room.get("deposit_amount") or profile.deposit_amount or 0)
    if deposit_amount <= 0:
        raise ConflictError("A deposit amount must be configured for this hotel booking")

    booking = HotelBooking(
        vendor_id=vendor_id,
        user_id=current_user.id,
        room_type_id=payload.room_type_id,
        room_snapshot=room,
        guest_name=payload.guest_name,
        guest_phone=encrypt_phone_value(payload.guest_phone) or payload.guest_phone,
        guest_email=payload.guest_email,
        check_in_date=payload.check_in_date,
        check_out_date=payload.check_out_date,
        guest_count=payload.guest_count,
        deposit_payment_method=payload.deposit_payment_method,
        deposit_amount=deposit_amount,
        transaction_reference=payload.transaction_reference,
        special_request=payload.special_request,
        status="pending",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _hotel_booking_response(booking)


@router.get("/hotel-bookings", response_model=list[HotelBookingResponse])
def list_seller_hotel_bookings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[HotelBookingResponse]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return []
    rows = db.scalars(
        select(HotelBooking)
        .where(HotelBooking.vendor_id == profile.vendor_id)
        .order_by(HotelBooking.created_at.desc())
        .limit(100)
    ).all()
    return [_hotel_booking_response(row) for row in rows]


@router.patch("/hotel-bookings/{booking_id}/status", response_model=HotelBookingResponse)
def update_hotel_booking_status(
    booking_id: str,
    payload: HotelBookingStatusUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> HotelBookingResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    booking = db.get(HotelBooking, booking_id)
    if booking is None or booking.vendor_id != profile.vendor_id:
        raise NotFoundError("Hotel booking not found")
    booking.status = payload.status
    db.commit()
    db.refresh(booking)
    return _hotel_booking_response(booking)


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
