from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.csrf import enforce_csrf
from app.core.crypto import decrypt_phone_value, encrypt_payment_code, payment_code_hash
from app.core.exceptions import NotFoundError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.global_settings import GlobalSettings
from app.models.restaurant import RestaurantMenuItem, RestaurantOrder, RestaurantOrderItem
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.restaurant import (
    RestaurantMenuCreateRequest,
    RestaurantMenuItemResponse,
    RestaurantOrderCreateRequest,
    RestaurantOrderItemResponse,
    RestaurantOrderResponse,
    RestaurantOrderStatusUpdateRequest,
    RestaurantStorefrontListResponse,
    RestaurantStorefrontResponse,
)
from app.services.payment_security_service import verify_payment_code

router = APIRouter(prefix="/restaurant", tags=["restaurant"])


def _estimate_delivery_minutes(distance_km: float, prep_minutes: int) -> int:
    # Moto-coursier Niamey: base + trajet par km + preparation
    return int(round(8 + (distance_km * 4.5) + prep_minutes))


def _menu_response(item: RestaurantMenuItem, vendor_name: str) -> RestaurantMenuItemResponse:
    return RestaurantMenuItemResponse(
        id=item.id,
        vendor_id=item.vendor_id,
        vendor_name=vendor_name,
        name=item.name,
        description=item.description,
        image_url=item.image_url,
        base_price=item.base_price,
        currency=item.currency,
        tags=item.tags,
        options=item.options,
        estimated_prep_minutes=item.estimated_prep_minutes,
        is_available=item.is_available,
    )


def _order_response(order: RestaurantOrder, vendor_name: str, dish_map: dict[str, str]) -> RestaurantOrderResponse:
    return RestaurantOrderResponse(
        id=order.id,
        vendor_id=order.vendor_id,
        vendor_name=vendor_name,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        delivery_address=order.delivery_address,
        distance_km=order.distance_km,
        delivery_fee=order.delivery_fee,
        delivery_minutes=order.delivery_minutes,
        payment_mode=order.payment_mode,
        status=order.status,
        total_amount=order.total_amount,
        currency=order.currency,
        created_at=order.created_at,
        items=[
            RestaurantOrderItemResponse(
                id=item.id,
                menu_item_id=item.menu_item_id,
                dish_name=dish_map.get(item.menu_item_id, "Plat"),
                quantity=item.quantity,
                selected_options=item.selected_options,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
            )
            for item in order.items
        ],
    )


def _is_plat_du_jour(tags: list[str] | None) -> bool:
    if not tags:
        return False
    normalized = {tag.strip().lower() for tag in tags if isinstance(tag, str)}
    return "plat du jour" in normalized


def _get_or_create_settings(db: Session) -> GlobalSettings:
    settings_row = db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))
    if settings_row is None:
        settings_row = GlobalSettings(
            commission_rate=0.05,
            service_fee=200,
            default_delivery_fee=1500,
            urban_delivery_fee=1500,
            peripheral_delivery_fee=2200,
            seller_subscription_fee=5000,
            ad_boost_price=2000,
            ad_boost_duration_days=7,
            ad_boost_price_24h=1000,
            ad_boost_price_7d=2000,
            launch_mode_zero_commission=False,
            support_email=None,
            support_phone=None,
            support_whatsapp=None,
        )
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


@router.get("/storefronts", response_model=RestaurantStorefrontListResponse)
def list_restaurant_storefronts(
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 120,
) -> RestaurantStorefrontListResponse:
    menu_rows = db.scalars(
        select(RestaurantMenuItem)
        .where(RestaurantMenuItem.is_available.is_(True))
        .order_by(RestaurantMenuItem.created_at.desc())
    ).all()
    if not menu_rows:
        return RestaurantStorefrontListResponse(items=[])

    menu_by_vendor: dict[str, list[RestaurantMenuItem]] = {}
    for row in menu_rows:
        menu_by_vendor.setdefault(row.vendor_id, []).append(row)

    vendor_ids = list(menu_by_vendor.keys())
    vendors = db.scalars(
        select(Vendor).where(Vendor.id.in_(vendor_ids), Vendor.is_active.is_(True))
    ).all()
    profiles = db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_(vendor_ids))).all()
    profile_by_vendor = {profile.vendor_id: profile for profile in profiles}

    needle = query.strip().lower() if query else ""
    items: list[RestaurantStorefrontResponse] = []
    for vendor in vendors:
        vendor_menu = menu_by_vendor.get(vendor.id, [])
        if not vendor_menu:
            continue
        profile = profile_by_vendor.get(vendor.id)
        if profile is None or profile.activity_type != "restaurant" or not profile.is_verified:
            continue
        business_name = profile.business_name if profile else None
        city = profile.city if profile else None
        haystack = " ".join(
            value.lower()
            for value in [vendor.name, business_name or "", city or ""]
            if value
        )
        if needle and needle not in haystack:
            continue
        items.append(
            RestaurantStorefrontResponse(
                id=vendor.id,
                name=vendor.name,
                slug=vendor.slug,
                business_name=business_name,
                city=city,
                phone=decrypt_phone_value(profile.phone) if profile else None,
                address=profile.address if profile else None,
                is_verified=bool(profile.is_verified) if profile else False,
                menu_item_count=len(vendor_menu),
                plat_du_jour_count=sum(1 for entry in vendor_menu if _is_plat_du_jour(entry.tags)),
                cover_image_url=(
                    profile.cover_image_url
                    if profile and profile.cover_image_url
                    else next((entry.image_url for entry in vendor_menu if entry.image_url), None)
                ),
            )
        )

    items.sort(
        key=lambda row: (
            0 if row.is_verified else 1,
            -row.plat_du_jour_count,
            -row.menu_item_count,
            row.name.lower(),
        )
    )
    return RestaurantStorefrontListResponse(items=items[:limit])


@router.get("/menu", response_model=list[RestaurantMenuItemResponse])
def list_restaurant_menu(
    db: Annotated[Session, Depends(get_db)],
    vendor_id: Annotated[str | None, Query(min_length=1, max_length=36)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[RestaurantMenuItemResponse]:
    query = select(RestaurantMenuItem).where(RestaurantMenuItem.is_available.is_(True))
    if vendor_id:
        query = query.where(RestaurantMenuItem.vendor_id == vendor_id)
    rows = db.scalars(query.order_by(RestaurantMenuItem.created_at.desc()).limit(limit)).all()
    if not rows:
        return []

    vendor_ids = {row.vendor_id for row in rows}
    vendors = db.scalars(select(Vendor).where(Vendor.id.in_(vendor_ids))).all()
    vendor_map = {vendor.id: vendor.name for vendor in vendors}
    profiles = db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_(vendor_ids))).all()
    profile_map = {profile.vendor_id: profile for profile in profiles}
    filtered_rows = [
        row
        for row in rows
        if (
            profile_map.get(row.vendor_id) is not None
            and profile_map[row.vendor_id].activity_type == "restaurant"
            and profile_map[row.vendor_id].is_verified
        )
    ]
    return [_menu_response(row, vendor_map.get(row.vendor_id, "Restaurant")) for row in filtered_rows]


@router.post("/menu", response_model=RestaurantMenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant_menu_item(
    payload: RestaurantMenuCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RestaurantMenuItemResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Create a seller profile first")

    menu_item = RestaurantMenuItem(
        vendor_id=profile.vendor_id,
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
        base_price=payload.base_price,
        currency=payload.currency.upper(),
        tags=[tag.strip() for tag in payload.tags][:5],
        options=[{"name": option.name, "price": option.price} for option in payload.options],
        estimated_prep_minutes=payload.estimated_prep_minutes,
        is_available=True,
    )
    db.add(menu_item)
    db.commit()
    db.refresh(menu_item)
    vendor = db.get(Vendor, profile.vendor_id)
    vendor_name = vendor.name if vendor else "Restaurant"
    return _menu_response(menu_item, vendor_name)


@router.post("/orders", response_model=RestaurantOrderResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant_order(
    payload: RestaurantOrderCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RestaurantOrderResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="payment_restaurant", limit=12, window_seconds=60)
    vendor = db.get(Vendor, payload.vendor_id)
    if vendor is None:
        raise NotFoundError("Restaurant not found")

    menu_ids = [line.menu_item_id for line in payload.items]
    menu_rows = db.scalars(
        select(RestaurantMenuItem).where(
            RestaurantMenuItem.id.in_(menu_ids),
            RestaurantMenuItem.vendor_id == payload.vendor_id,
        )
    ).all()
    menu_map = {row.id: row for row in menu_rows}
    if len(menu_map) != len(set(menu_ids)):
        raise ValidationDomainError("One or more menu items are invalid for this restaurant")

    settings_row = _get_or_create_settings(db)
    delivery_fee = float(settings_row.default_delivery_fee or 0)
    prep_minutes = max(row.estimated_prep_minutes for row in menu_rows) if menu_rows else 20
    delivery_minutes = _estimate_delivery_minutes(payload.distance_km, prep_minutes)
    encrypted_code: str | None = None
    code_hash: str | None = None
    if payload.transaction_code:
        if not verify_payment_code(db, payload.transaction_code):
            raise ValidationDomainError("Transaction code already used")
        encrypted_code = encrypt_payment_code(payload.transaction_code)
        code_hash = payment_code_hash(payload.transaction_code)

    order = RestaurantOrder(
        vendor_id=payload.vendor_id,
        user_id=current_user.id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        delivery_address=payload.delivery_address,
        distance_km=payload.distance_km,
        delivery_fee=delivery_fee,
        delivery_minutes=delivery_minutes,
        payment_mode=payload.payment_mode,
        transaction_code=encrypted_code,
        transaction_code_hash=code_hash,
        status="commande",
        total_amount=0,
        currency="XOF",
    )

    total_amount = 0.0
    for line in payload.items:
        menu_item = menu_map[line.menu_item_id]
        options_total = sum(option.price for option in line.selected_options)
        unit_price = menu_item.base_price + options_total
        subtotal = unit_price * line.quantity
        total_amount += subtotal
        order.items.append(
            RestaurantOrderItem(
                menu_item_id=line.menu_item_id,
                quantity=line.quantity,
                selected_options=[{"name": option.name, "price": option.price} for option in line.selected_options],
                customer_note=getattr(line, "customer_note", None),
                unit_price=unit_price,
                subtotal=subtotal,
            )
        )

    order.total_amount = total_amount + delivery_fee
    db.add(order)
    db.commit()
    db.refresh(order)

    dish_map = {item.id: item.name for item in menu_rows}
    return _order_response(order, vendor.name, dish_map)


@router.get("/seller/orders", response_model=list[RestaurantOrderResponse])
def list_seller_restaurant_orders(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> list[RestaurantOrderResponse]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return []

    vendor = db.get(Vendor, profile.vendor_id)
    orders = db.scalars(
        select(RestaurantOrder)
        .where(RestaurantOrder.vendor_id == profile.vendor_id)
        .order_by(RestaurantOrder.created_at.desc())
        .limit(limit)
    ).all()

    dish_ids = {item.menu_item_id for order in orders for item in order.items}
    dishes = db.scalars(select(RestaurantMenuItem).where(RestaurantMenuItem.id.in_(dish_ids))).all()
    dish_map = {dish.id: dish.name for dish in dishes}
    vendor_name = vendor.name if vendor else "Restaurant"
    return [_order_response(order, vendor_name, dish_map) for order in orders]


@router.patch("/seller/orders/{order_id}/status", response_model=RestaurantOrderResponse)
def update_seller_restaurant_order_status(
    order_id: str,
    payload: RestaurantOrderStatusUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RestaurantOrderResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")

    order = db.get(RestaurantOrder, order_id)
    if order is None or order.vendor_id != profile.vendor_id:
        raise NotFoundError("Order not found")

    order.status = payload.status
    db.commit()
    db.refresh(order)

    vendor = db.get(Vendor, profile.vendor_id)
    dishes = db.scalars(
        select(RestaurantMenuItem).where(
            RestaurantMenuItem.id.in_([item.menu_item_id for item in order.items])
        )
    ).all()
    dish_map = {dish.id: dish.name for dish in dishes}
    vendor_name = vendor.name if vendor else "Restaurant"
    return _order_response(order, vendor_name, dish_map)
