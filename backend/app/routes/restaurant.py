from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.core.permissions import is_admin
from app.core.cache import cache_delete_prefixes
from app.core.checkout_fees import platform_commission_and_service_fee
from app.core.crypto import decrypt_payment_code, decrypt_phone_value, encrypt_payment_code, payment_code_hash
from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user, get_current_user_optional, get_seller_user
from app.core.exceptions import NotFoundError, UnauthorizedError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.core.receipt_security import create_receipt_access_token, decode_receipt_access_token, receipt_integrity_hash
from app.database import get_db
from app.models.global_settings import GlobalSettings
from app.models.restaurant import RestaurantMenuItem, RestaurantOrder, RestaurantOrderItem
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.order import (
    PaymentConfirmRequest,
    PaymentConfirmResponse,
    PaymentIntentResponse,
    PaymentStartResponse,
    ReceiptItemResponse,
    ReceiptLinkResponse,
    ReceiptResponse,
)
from app.schemas.restaurant import (
    RestaurantMenuAvailabilityUpdateRequest,
    RestaurantMenuCreateRequest,
    RestaurantMenuItemResponse,
    RestaurantMenuUpdateRequest,
    RestaurantOrderCreateRequest,
    RestaurantOrderItemResponse,
    RestaurantOrderResponse,
    RestaurantOrderStatusUpdateRequest,
    RestaurantSettingsResponse,
    RestaurantSettingsSchema,
    RestaurantStorefrontListResponse,
    RestaurantStorefrontResponse,
)
from app.services import order_event_notifications as order_events
from app.services import restaurant_service
from app.services.refund_service import record_refund
from app.services.listing_limit_service import (
    count_vendor_menu_items,
    is_premium_profile,
    max_products_for_basic_tier,
)
from app.services.audit_log_service import append_audit_log
from app.services.payment_security_service import (
    MANUAL_PAYMENT_PENDING_MESSAGE,
    build_payment_page_url,
    resolve_manual_payment_code,
    verify_payment_code,
)
from app.services.payment_gateway_service import (
    GatewayPayment,
    PaymentGatewayError,
    create_amana_payment,
    get_amana_payment_status,
)
from app.services.public_catalog_policy import is_allowed_public_restaurant_name

router = APIRouter(prefix="/restaurant", tags=["restaurant"])
_settings = get_settings()
_INTERNAL_DELIVERY_DISTANCE_KM = 3.0


def _is_admin(user: User | None) -> bool:
    return is_admin(user)


def _mask_transaction_code(raw_code: str | None) -> str | None:
    if not raw_code:
        return None
    if len(raw_code) <= 5:
        return "*" * len(raw_code)
    return f"{raw_code[:3]}***{raw_code[-2:]}"


def _build_payment_reference(order_id: str) -> str:
    return f"AMZ-{order_id[:6].upper()}-{order_id[-4:].upper()}"


def _amana_phone(phone: str | None) -> str:
    """Normalize a Niger phone number to Amana's required format."""
    compact = "".join(char for char in (phone or "") if char.isdigit())
    if compact.startswith("227") and len(compact) == 11:
        return f"00{compact}"
    if len(compact) == 8:
        return f"00227{compact}"
    raise ValidationDomainError("Un numero Niger valide est necessaire pour payer par Amana")


def _resolve_platform_wallet_phone(db: Session) -> str | None:
    row = db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))
    if row is None:
        return None
    primary = (row.platform_wallet_phone or "").strip()
    if primary:
        return primary
    fallback = (row.support_phone or "").strip()
    return fallback or None


def _invalidate_public_marketplace_cache() -> None:
    cache_delete_prefixes("catalog:", "content:")


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
        category=getattr(item, "category", None) or "Plats",
        sort_order=int(getattr(item, "sort_order", 0) or 0),
        sold_out=bool(getattr(item, "sold_out", False)),
    )


def _menu_sort_key(item: RestaurantMenuItem) -> tuple:
    return ((item.category or "Plats").lower(), int(item.sort_order or 0), item.name.lower())


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
        payment_reference=order.payment_reference,
        payment_status=order.payment_status,
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
                customer_note=item.customer_note,
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
            seller_subscription_fee_shop=5000,
            seller_subscription_fee_restaurant=5000,
            seller_subscription_fee_premium=5000,
            ad_boost_price=2000,
            ad_boost_duration_days=7,
            ad_boost_price_24h=1000,
            ad_boost_price_7d=2000,
            launch_mode_zero_commission=False,
            max_products_basic_tier=10,
            platform_wallet_phone=None,
            support_email=None,
            support_phone=None,
            support_whatsapp=None,
        )
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


def _is_public_restaurant_vendor(vendor: Vendor | None, profile: SellerProfile | None) -> bool:
    if vendor is None or not vendor.is_active or profile is None:
        return False
    owner = getattr(profile, "user", None)
    if owner is not None and not owner.is_active:
        return False
    # Abonnement expire => boutique bloquee au public jusqu'au reabonnement.
    until = profile.subscription_paid_until
    if profile.onboarding_fee_paid_at is None or until is None:
        return False
    if until.tzinfo is None:
        until = until.replace(tzinfo=UTC)
    if until <= datetime.now(UTC):
        return False
    return True


def _can_manage_restaurant_catalog(profile: SellerProfile) -> bool:
    return profile.activity_type == "restaurant" or profile.storefront_tier == "premium"


@router.get("/storefronts", response_model=RestaurantStorefrontListResponse)
def list_restaurant_storefronts(
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 120,
) -> RestaurantStorefrontListResponse:
    menu_rows = db.scalars(
        select(RestaurantMenuItem)
        .where(RestaurantMenuItem.is_available.is_(True), RestaurantMenuItem.archived.is_(False))
        .order_by(RestaurantMenuItem.created_at.desc())
        .limit(1000)
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
    profiles = db.scalars(
        select(SellerProfile)
        .where(SellerProfile.vendor_id.in_(vendor_ids))
        .options(selectinload(SellerProfile.user))
    ).all()
    profile_by_vendor = {profile.vendor_id: profile for profile in profiles}

    needle = query.strip().lower() if query else ""
    items: list[RestaurantStorefrontResponse] = []
    for vendor in vendors:
        vendor_menu = menu_by_vendor.get(vendor.id, [])
        if not vendor_menu:
            continue
        profile = profile_by_vendor.get(vendor.id)
        if not _is_public_restaurant_vendor(vendor, profile) or not profile.is_verified:
            continue
        if not is_allowed_public_restaurant_name(profile.business_name or vendor.name):
            continue
        can_sell_restaurant = profile.activity_type == "restaurant" or profile.storefront_tier == "premium"
        if not can_sell_restaurant:
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
    query = select(RestaurantMenuItem).where(
        RestaurantMenuItem.is_available.is_(True), RestaurantMenuItem.archived.is_(False)
    )
    if vendor_id:
        query = query.where(RestaurantMenuItem.vendor_id == vendor_id)
    rows = db.scalars(query.order_by(RestaurantMenuItem.created_at.desc()).limit(limit)).all()
    if not rows:
        return []

    vendor_ids = {row.vendor_id for row in rows}
    vendors = db.scalars(select(Vendor).where(Vendor.id.in_(vendor_ids))).all()
    vendor_map = {vendor.id: vendor for vendor in vendors}
    profiles = db.scalars(
        select(SellerProfile)
        .where(SellerProfile.vendor_id.in_(vendor_ids))
        .options(selectinload(SellerProfile.user))
    ).all()
    profile_map = {profile.vendor_id: profile for profile in profiles}
    filtered_rows = [
        row
        for row in rows
        if (
            _is_public_restaurant_vendor(vendor_map.get(row.vendor_id), profile_map.get(row.vendor_id))
            and (
                profile_map[row.vendor_id].activity_type == "restaurant"
                or profile_map[row.vendor_id].storefront_tier == "premium"
            )
            and profile_map[row.vendor_id].is_verified
            and is_allowed_public_restaurant_name(
                profile_map[row.vendor_id].business_name or (
                    vendor_map.get(row.vendor_id).name if vendor_map.get(row.vendor_id) else None
                )
            )
        )
    ]
    return [
        _menu_response(row, vendor_map.get(row.vendor_id).name if vendor_map.get(row.vendor_id) else "Restaurant")
        for row in filtered_rows
    ]


@router.post("/menu", response_model=RestaurantMenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant_menu_item(
    payload: RestaurantMenuCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> RestaurantMenuItemResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Create a seller profile first")
    if not _can_manage_restaurant_catalog(profile):
        raise ValidationDomainError(
            "Cette formule vendeur ne permet pas de publier un menu restaurant. "
            "Passez en restaurant ou en Premium."
        )
    if not is_premium_profile(profile):
        cap = max_products_for_basic_tier(db)
        current = count_vendor_menu_items(db, profile.vendor_id)
        if current >= cap:
            raise ValidationDomainError(
                f"Limite atteinte: {cap} plat(s) maximum pour les comptes hors Premium. "
                "Passez en formule Premium pour un menu illimite, ou retirez des plats."
            )

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
        category=restaurant_service.clean_category(payload.category),
    )
    db.add(menu_item)
    db.commit()
    db.refresh(menu_item)
    _invalidate_public_marketplace_cache()
    vendor = db.get(Vendor, profile.vendor_id)
    vendor_name = vendor.name if vendor else "Restaurant"
    return _menu_response(menu_item, vendor_name)


@router.get("/seller/menu", response_model=list[RestaurantMenuItemResponse])
def list_seller_restaurant_menu(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
    limit: Annotated[int, Query(ge=1, le=300)] = 300,
) -> list[RestaurantMenuItemResponse]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return []

    vendor = db.get(Vendor, profile.vendor_id)
    vendor_name = vendor.name if vendor else "Restaurant"
    rows = db.scalars(
        select(RestaurantMenuItem)
        .where(RestaurantMenuItem.vendor_id == profile.vendor_id, RestaurantMenuItem.archived.is_(False))
        .limit(limit)
    ).all()
    return [_menu_response(row, vendor_name) for row in sorted(rows, key=_menu_sort_key)]


@router.patch("/seller/menu/{menu_item_id}", response_model=RestaurantMenuItemResponse)
def update_seller_restaurant_menu_availability(
    menu_item_id: str,
    payload: RestaurantMenuAvailabilityUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> RestaurantMenuItemResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")

    menu_item = db.get(RestaurantMenuItem, menu_item_id)
    if menu_item is None or menu_item.vendor_id != profile.vendor_id:
        raise NotFoundError("Menu item not found")

    menu_item.is_available = payload.is_available
    db.commit()
    db.refresh(menu_item)
    _invalidate_public_marketplace_cache()

    vendor = db.get(Vendor, profile.vendor_id)
    vendor_name = vendor.name if vendor else "Restaurant"
    return _menu_response(menu_item, vendor_name)


def _owned_menu_item(db: Session, user: User, menu_item_id: str) -> tuple[SellerProfile, RestaurantMenuItem]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    menu_item = db.get(RestaurantMenuItem, menu_item_id)
    if menu_item is None or menu_item.vendor_id != profile.vendor_id or menu_item.archived:
        raise NotFoundError("Menu item not found")
    return profile, menu_item


@router.put("/seller/menu/{menu_item_id}", response_model=RestaurantMenuItemResponse)
def update_seller_restaurant_menu_item(
    menu_item_id: str,
    payload: RestaurantMenuUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> RestaurantMenuItemResponse:
    """Modifier un plat (nom, prix, photo, rubrique, options, epuise...)."""
    enforce_csrf(request)
    profile, menu_item = _owned_menu_item(db, current_user, menu_item_id)
    data = payload.model_dump(exclude_unset=True)
    if "tags" in data:
        data["tags"] = [tag.strip() for tag in data["tags"] if tag.strip()][:5]
    if "options" in data:
        data["options"] = [{"name": option["name"].strip(), "price": float(option["price"])} for option in data["options"]]
    if "category" in data:
        data["category"] = restaurant_service.clean_category(data["category"])
    for key, value in data.items():
        setattr(menu_item, key, value)
    db.commit()
    db.refresh(menu_item)
    _invalidate_public_marketplace_cache()
    vendor = db.get(Vendor, profile.vendor_id)
    return _menu_response(menu_item, vendor.name if vendor else "Restaurant")


@router.delete("/seller/menu/{menu_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_seller_restaurant_menu_item(
    menu_item_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> None:
    """Supprimer un plat du menu (garde en archive pour l'historique des commandes)."""
    enforce_csrf(request)
    _profile, menu_item = _owned_menu_item(db, current_user, menu_item_id)
    menu_item.archived = True
    menu_item.is_available = False
    db.commit()
    _invalidate_public_marketplace_cache()


def _settings_response(profile: SellerProfile) -> RestaurantSettingsResponse:
    state = restaurant_service.open_state(profile.weekly_hours, bool(profile.orders_paused))
    return RestaurantSettingsResponse(
        weekly_hours=profile.weekly_hours,
        orders_paused=bool(profile.orders_paused),
        is_open=state.is_open,
        open_label=state.label,
    )


@router.get("/seller/settings", response_model=RestaurantSettingsResponse)
def get_restaurant_settings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> RestaurantSettingsResponse:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    return _settings_response(profile)


@router.put("/seller/settings", response_model=RestaurantSettingsResponse)
def update_restaurant_settings(
    payload: RestaurantSettingsSchema,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> RestaurantSettingsResponse:
    """Horaires d'ouverture et pause des commandes (« trop de commandes »)."""
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    raw = None
    if payload.weekly_hours is not None:
        raw = {day: (slot.model_dump() if slot else None) for day, slot in payload.weekly_hours.items()}
    profile.weekly_hours = restaurant_service.normalize_weekly_hours(raw)
    profile.orders_paused = payload.orders_paused
    db.commit()
    _invalidate_public_marketplace_cache()
    return _settings_response(profile)


def _restaurant_fee_snapshot(order: RestaurantOrder) -> dict[str, float]:
    items_subtotal = sum(float(item.subtotal) for item in order.items)
    fb = order.fee_breakdown
    if isinstance(fb, dict) and fb.get("items_subtotal") is not None:
        return {
            "items_subtotal": round(float(fb.get("items_subtotal", 0)), 2),
            "delivery_fee": round(float(fb.get("delivery_fee", 0)), 2),
            "platform_commission": round(float(fb.get("platform_commission", 0)), 2),
            "platform_service_fee": round(float(fb.get("platform_service_fee", 0)), 2),
        }
    return {
        "items_subtotal": round(items_subtotal, 2),
        "delivery_fee": round(float(order.delivery_fee or 0), 2),
        "platform_commission": 0.0,
        "platform_service_fee": 0.0,
    }


def _build_restaurant_receipt_payload(
    order: RestaurantOrder,
    customer_name: str,
    dish_map: dict[str, str],
) -> dict[str, object]:
    fees = _restaurant_fee_snapshot(order)
    return {
        "order_id": order.id,
        "kind": "restaurant",
        "customer_name": customer_name,
        "payment_mode": order.payment_mode,
        "payment_reference": order.payment_reference,
        "payment_status": order.payment_status,
        "currency": order.currency,
        "total_amount": round(order.total_amount, 2),
        "items_subtotal": fees["items_subtotal"],
        "delivery_fee": fees["delivery_fee"],
        "platform_commission": fees["platform_commission"],
        "platform_service_fee": fees["platform_service_fee"],
        "created_at": order.created_at.isoformat(),
        "transaction_code_hash": order.transaction_code_hash,
        "items": [
            {
                "product_id": item.menu_item_id,
                "product_name": dish_map.get(item.menu_item_id, "Plat"),
                "quantity": item.quantity,
                "unit_price": round(item.unit_price, 2),
                "subtotal": round(item.subtotal, 2),
            }
            for item in sorted(order.items, key=lambda row: row.menu_item_id)
        ],
    }


def _to_restaurant_receipt_response(
    request: Request,
    order: RestaurantOrder,
    customer_name: str,
    dish_map: dict[str, str],
    digest: str,
    token: str,
    payment_url: str,
    platform_wallet_phone: str | None,
) -> ReceiptResponse:
    decrypted = None
    if order.transaction_code:
        try:
            decrypted = decrypt_payment_code(order.transaction_code)
        except Exception:
            decrypted = None
    verify_url = f"{str(request.base_url).rstrip('/')}{_settings.api_prefix}/orders/receipt/verify?token={token}"
    fees = _restaurant_fee_snapshot(order)
    return ReceiptResponse(
        order_id=order.id,
        customer_name=customer_name,
        payment_mode=order.payment_mode,
        payment_reference=order.payment_reference,
        payment_status=order.payment_status,
        currency=order.currency,
        total_amount=round(order.total_amount, 2),
        items_subtotal=fees["items_subtotal"],
        delivery_fee=fees["delivery_fee"],
        platform_commission=fees["platform_commission"],
        platform_service_fee=fees["platform_service_fee"],
        transaction_code_masked=_mask_transaction_code(decrypted),
        created_at=order.created_at,
        issued_at=order.created_at,
        items=[
            ReceiptItemResponse(
                product_id=item.menu_item_id,
                product_name=dish_map.get(item.menu_item_id, "Plat"),
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
            )
            for item in order.items
        ],
        integrity_hash=digest,
        verify_url=verify_url,
        payment_url=payment_url,
        platform_wallet_phone=platform_wallet_phone,
    )


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
    profile = db.scalar(
        select(SellerProfile)
        .where(SellerProfile.vendor_id == payload.vendor_id)
        .options(selectinload(SellerProfile.user))
    )
    if not _is_public_restaurant_vendor(vendor, profile):
        raise NotFoundError("Restaurant not found")
    state = restaurant_service.open_state(getattr(profile, "weekly_hours", None), bool(getattr(profile, "orders_paused", False)))
    if not state.is_open:
        raise ValidationDomainError(f"Ce restaurant ne prend pas de commande pour le moment ({state.label}).")

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
    for row in menu_rows:
        if row.archived or not row.is_available or row.sold_out:
            raise ValidationDomainError(f"« {row.name} » n'est plus disponible. Retirez-le de votre commande.")

    settings_row = _get_or_create_settings(db)
    delivery_fee = float(settings_row.default_delivery_fee or 0)
    prep_minutes = max(row.estimated_prep_minutes for row in menu_rows) if menu_rows else 20
    delivery_minutes = _estimate_delivery_minutes(_INTERNAL_DELIVERY_DISTANCE_KM, prep_minutes)
    encrypted_code: str | None = None
    code_hash: str | None = None
    payment_confirmed_at: datetime | None = None
    payment_status = "pending"
    order_status = "payment_pending"
    if payload.transaction_code:
        if not verify_payment_code(db, payload.transaction_code):
            raise ValidationDomainError("Transaction code already used")
        # Code declare par le client : conserve pour controle, jamais une preuve de paiement.
        encrypted_code = encrypt_payment_code(payload.transaction_code)
        code_hash = payment_code_hash(payload.transaction_code)

    order = RestaurantOrder(
        vendor_id=payload.vendor_id,
        user_id=current_user.id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        delivery_address=payload.delivery_address,
        distance_km=_INTERNAL_DELIVERY_DISTANCE_KM,
        delivery_fee=delivery_fee,
        delivery_minutes=delivery_minutes,
        payment_mode=payload.payment_mode,
        payment_status=payment_status,
        payment_confirmed_at=payment_confirmed_at,
        transaction_code=encrypted_code,
        transaction_code_hash=code_hash,
        status=order_status,
        total_amount=0,
        currency="XOF",
    )

    items_subtotal = 0.0
    for line in payload.items:
        menu_item = menu_map[line.menu_item_id]
        # Prix des options relus dans le menu : le prix envoye par le client est ignore.
        options = restaurant_service.priced_options(menu_item.options, [option.name for option in line.selected_options])
        options_total = sum(option["price"] for option in options)
        unit_price = menu_item.base_price + options_total
        subtotal = unit_price * line.quantity
        items_subtotal += subtotal
        order.items.append(
            RestaurantOrderItem(
                menu_item_id=line.menu_item_id,
                quantity=line.quantity,
                selected_options=options,
                customer_note=getattr(line, "customer_note", None),
                unit_price=unit_price,
                subtotal=subtotal,
            )
        )

    commission_fee, service_fee = platform_commission_and_service_fee(
        settings_row,
        profile,
        items_subtotal,
        bool(payload.items),
    )
    order_total = items_subtotal + delivery_fee + commission_fee + service_fee
    order.fee_breakdown = {
        "items_subtotal": round(items_subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "platform_commission": round(commission_fee, 2),
        "platform_service_fee": round(service_fee, 2),
    }
    order.total_amount = order_total

    db.add(order)
    db.flush()
    if order.payment_reference is None:
        order.payment_reference = _build_payment_reference(order.id)
    db.commit()
    db.refresh(order)

    dish_map = {item.id: item.name for item in menu_rows}
    return _order_response(order, vendor.name, dish_map)


@router.get("/seller/orders", response_model=list[RestaurantOrderResponse])
def list_seller_restaurant_orders(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
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
    current_user: Annotated[User, Depends(get_seller_user)],
) -> RestaurantOrderResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")

    order = db.get(RestaurantOrder, order_id)
    if order is None or order.vendor_id != profile.vendor_id:
        raise NotFoundError("Order not found")
    if order.payment_status != "paid":
        raise ValidationDomainError("Paiement non confirme: impossible de mettre a jour le statut.")
    restaurant_service.check_transition(order.status, payload.status)

    if order.status != payload.status:
        order_events.notify_order_status(db, order, payload.status)
        if payload.status == "annulee" and order.payment_status == "paid":
            record_refund(
                db,
                source="restaurant_order",
                source_id=order.id,
                user_id=order.user_id,
                customer_name=order.customer_name,
                phone=order.customer_phone,
                method=order.payment_mode,
                amount=float(order.total_amount or 0),
                reason="Commande refusée par le restaurant",
            )
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


def _resolve_restaurant_order_for_receipt(db: Session, order_id: str) -> RestaurantOrder | None:
    return db.scalar(
        select(RestaurantOrder)
        .where(RestaurantOrder.id == order_id)
        .options(selectinload(RestaurantOrder.items))
    )


@router.get("/orders/{order_id}/payment-intent", response_model=PaymentIntentResponse)
def get_restaurant_payment_intent(
    order_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaymentIntentResponse:
    order = _resolve_restaurant_order_for_receipt(db, order_id)
    if order is None:
        raise ValidationDomainError("Order not found")
    if order.user_id != current_user.id and not _is_admin(current_user):
        raise UnauthorizedError("Unauthorized order access")
    reference = order.payment_reference or _build_payment_reference(order.id)
    if order.payment_reference is None:
        order.payment_reference = reference
        db.commit()
        db.refresh(order)
    payment_url = build_payment_page_url(order.id, restaurant=True)
    return PaymentIntentResponse(
        order_id=order.id,
        payment_mode=order.payment_mode,
        payment_reference=reference,
        amount=round(order.total_amount, 2),
        currency=order.currency,
        payment_url=payment_url,
        qr_payload=payment_url,
        expires_in_seconds=15 * 60,
        platform_wallet_phone=_resolve_platform_wallet_phone(db),
    )


@router.post("/orders/{order_id}/payment/start", response_model=PaymentStartResponse)
def start_restaurant_order_payment(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaymentStartResponse:
    """Start an Amana restaurant payment through the trusted fixed-IP gateway."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="payment_start_restaurant", limit=6, window_seconds=300)
    order = db.scalar(select(RestaurantOrder).where(RestaurantOrder.id == order_id).with_for_update())
    if order is None:
        raise ValidationDomainError("Order not found")
    if order.user_id != current_user.id and not _is_admin(current_user):
        raise UnauthorizedError("Unauthorized order access")
    if order.payment_status == "paid":
        return PaymentStartResponse(order_id=order.id, payment_status="paid", message="Paiement deja confirme.")
    if order.payment_mode != "amana":
        raise ValidationDomainError("Ce mode de paiement ne requiert pas Amana")
    if order.gateway_payment_reference:
        return PaymentStartResponse(
            order_id=order.id,
            payment_status="pending",
            message="Paiement Amana deja initialise. Validez-le dans AmanaTa puis verifiez son statut.",
        )
    reference = order.payment_reference or _build_payment_reference(order.id)
    order.payment_reference = reference
    try:
        provider_reference = create_amana_payment(
            _settings,
            GatewayPayment(
                reference=reference,
                amount_xof=int(round(order.total_amount)),
                description=f"Commande restaurant AMAZER {reference}",
                payer_phone=_amana_phone(order.customer_phone),
            ),
        )
    except PaymentGatewayError as exc:
        raise ValidationDomainError("Impossible de demarrer le paiement Amana. Reessayez.") from exc
    order.gateway_payment_reference = provider_reference
    db.commit()
    return PaymentStartResponse(
        order_id=order.id,
        payment_status="pending",
        message="Paiement Amana initialise. Validez-le dans AmanaTa puis verifiez son statut.",
    )


@router.post("/orders/{order_id}/payment/confirm", response_model=PaymentConfirmResponse)
def confirm_restaurant_order_payment(
    order_id: str,
    payload: PaymentConfirmRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaymentConfirmResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="payment_confirm_restaurant", limit=12, window_seconds=120)
    order = db.scalar(select(RestaurantOrder).where(RestaurantOrder.id == order_id).with_for_update())
    if order is None:
        raise ValidationDomainError("Order not found")
    if order.user_id != current_user.id and not _is_admin(current_user):
        raise UnauthorizedError("Unauthorized order access")

    if order.payment_status == "paid":
        return PaymentConfirmResponse(
            order_id=order.id,
            payment_status="paid",
            order_status=order.status,
            message="Paiement deja confirme.",
        )

    if order.payment_mode == "amana":
        if not order.gateway_payment_reference:
            raise ValidationDomainError("Demarrez d'abord le paiement Amana")
        try:
            provider_status = get_amana_payment_status(_settings, order.gateway_payment_reference)
        except PaymentGatewayError as exc:
            raise ValidationDomainError("Verification Amana indisponible. Reessayez.") from exc
        if provider_status != "SUCCESS":
            return PaymentConfirmResponse(
                order_id=order.id,
                payment_status="pending",
                order_status=order.status,
                message="Paiement Amana en attente de validation.",
            )
        transaction_code = f"AMANA-{order.gateway_payment_reference}"
    else:
        actor_is_admin = _is_admin(current_user)
        manual_code = resolve_manual_payment_code(
            db, order, payload.provider_reference, actor_is_admin=actor_is_admin
        )
        if manual_code is None:
            db.commit()
            return PaymentConfirmResponse(
                order_id=order.id,
                payment_status=order.payment_status,
                order_status=order.status,
                message=MANUAL_PAYMENT_PENDING_MESSAGE,
            )
        if order.payment_reference is None:
            order.payment_reference = _build_payment_reference(order.id)
        transaction_code = manual_code
        append_audit_log(
            db,
            event_type="restaurant_order_payment_manually_confirmed",
            actor=current_user,
            ip_address=request.client.host if request.client else None,
            path=str(request.url.path),
            entity_type="restaurant_order",
            entity_id=order.id,
            details={
                "payment_mode": order.payment_mode,
                "amount": round(float(order.total_amount), 2),
                "provider_reference_last4": manual_code[-4:],
            },
        )
    order.transaction_code = encrypt_payment_code(transaction_code)
    order.transaction_code_hash = payment_code_hash(transaction_code)
    order.payment_status = "paid"
    order.payment_confirmed_at = datetime.now(UTC)
    if order.status == "payment_pending":
        order.status = "commande"
    order_events.notify_order_paid(db, order, couriers=False)

    db.commit()
    db.refresh(order)
    return PaymentConfirmResponse(
        order_id=order.id,
        payment_status=order.payment_status,
        order_status=order.status,
        message="Paiement confirme avec succes.",
    )


@router.get("/orders/{order_id}/receipt-link", response_model=ReceiptLinkResponse)
def get_restaurant_receipt_link(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReceiptLinkResponse:
    order = _resolve_restaurant_order_for_receipt(db, order_id)
    if order is None:
        raise ValidationDomainError("Order not found")
    if order.user_id != current_user.id and not _is_admin(current_user):
        raise UnauthorizedError("Unauthorized receipt access")
    dish_ids = [item.menu_item_id for item in order.items]
    dishes = db.scalars(select(RestaurantMenuItem).where(RestaurantMenuItem.id.in_(dish_ids))).all()
    dish_map = {dish.id: dish.name for dish in dishes}
    customer_name = order.customer_name
    payload = _build_restaurant_receipt_payload(order, customer_name, dish_map)
    digest = receipt_integrity_hash(payload)
    token = create_receipt_access_token(order_id=order.id, digest=digest)
    receipt_url = f"/order/receipt/{order.id}?token={token}"
    verify_url = f"/seller/delivery-scan?token={token}"
    return ReceiptLinkResponse(order_id=order.id, token=token, receipt_url=receipt_url, verify_url=verify_url)


@router.get("/receipt/{order_id}", response_model=ReceiptResponse)
def get_restaurant_secure_receipt(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
    token: Annotated[str | None, Query()] = None,
) -> ReceiptResponse:
    order = _resolve_restaurant_order_for_receipt(db, order_id)
    if order is None:
        raise ValidationDomainError("Order not found")

    dish_ids = [item.menu_item_id for item in order.items]
    dishes = db.scalars(select(RestaurantMenuItem).where(RestaurantMenuItem.id.in_(dish_ids))).all()
    dish_map = {dish.id: dish.name for dish in dishes}
    customer_name = order.customer_name
    payload = _build_restaurant_receipt_payload(order, customer_name, dish_map)
    digest = receipt_integrity_hash(payload)

    if not _is_admin(current_user):
        if not token:
            raise UnauthorizedError("Receipt token required")
        try:
            claims = decode_receipt_access_token(token)
        except ValueError as exc:
            raise UnauthorizedError("Invalid or expired receipt token") from exc
        if claims.get("sub") != order.id or claims.get("digest") != digest:
            raise UnauthorizedError("Invalid receipt token")
    else:
        token = create_receipt_access_token(order_id=order.id, digest=digest)

    reference = order.payment_reference or _build_payment_reference(order.id)
    payment_url = build_payment_page_url(order.id, restaurant=True)
    wallet_phone = _resolve_platform_wallet_phone(db)

    return _to_restaurant_receipt_response(
        request=request,
        order=order,
        customer_name=customer_name,
        dish_map=dish_map,
        digest=digest,
        token=token,
        payment_url=payment_url,
        platform_wallet_phone=wallet_phone,
    )
