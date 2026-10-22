import csv
import io
import json
import re
import logging
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, object_session, selectinload

from app.config import get_settings
from app.core.cache import build_cache_key, cache_delete_prefixes, cache_get_json, cache_set_json
from app.core.deps import get_admin_user, get_current_user, get_current_user_optional, get_seller_user
from app.core.crypto import decrypt_phone_value, encrypt_phone_value
from app.core.csrf import enforce_csrf
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.hospitality import HotelBooking, RestaurantReservation
from app.models.order import Order, OrderItem
from app.models.price_history import PriceHistory
from app.models.product import Price, Product
from app.services.image_service import compress_image_to_limit
from app.services import (
    hotel_service,
    promo_service,
    restaurant_service,
    storefront_stats_service,
    transport_service,
    vendor_review_service,
)
from app.models.restaurant import RestaurantMenuItem
from app.models.seller_profile import SellerProfile
from app.models.seller_subscription_payment import SellerSubscriptionPayment
from app.models.seller_lead import SellerLead
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_review import VendorReview
from app.schemas.restaurant import (
    RestaurantMenuItemResponse,
    RestaurantReservationCreateRequest,
    RestaurantReservationResponse,
    RestaurantReservationStatusUpdateRequest,
)
from app.schemas.seller import (
    HotelBookingCreateRequest,
    HotelBookingResponse,
    RoomAvailabilityResponse,
    MyBookingResponse,
    SellerStatsResponse,
    StatsDay,
    StatsWeek,
    StorefrontEventRequest,
    VendorReviewItem,
    VendorReviewReplyRequest,
    VendorReviewRequest,
    VendorReviewsResponse,
    SeatAvailabilityResponse,
    TicketScanRequest,
    TicketScanResponse,
    HotelBookingStatusUpdateRequest,
    SellerInventoryItemResponse,
    SellerInventoryUpdateRequest,
    SellerShopOrderItemResponse,
    SellerShopOrderResponse,
    SellerShopOrderStatusUpdateRequest,
    SellerSubscriptionPayRequest,
    SellerSubscriptionPaymentRequestResponse,
    SellerSubscriptionStatusResponse,
    SellerProductCreateRequest,
    SellerProductCreateResponse,
    SellerProfileRequest,
    SellerProfileResponse,
    SellerStorefrontProductResponse,
    SellerStorefrontResponse,
)
from app.schemas.seller_lead import SellerLeadCreateRequest, SellerLeadResponse
from app.services import order_event_notifications as order_events
from app.services.order_delivery_service import mark_order_delivered
from app.services.category_classifier import guess_category_id
from app.services.audit_log_service import append_audit_log
from app.services.order_cancellation_service import ensure_not_cancelled
from app.services.order_fulfillment_service import set_vendor_status, vendor_status
from app.services.listing_limit_service import (
    count_vendor_catalog_products,
    is_premium_profile,
    max_products_for_basic_tier,
)
from app.services.notification_service import NotificationPayload, NotificationService
from app.routes.local_services import active_outlets, build_outlet_item
from app.routes.local_services import build_item as build_local_service_item
from app.services import local_services
from app.services.seller_finance_service import (
    build_effective_seller_finance_settings,
    get_or_create_global_settings,
)
from app.services.seller_profile_service import create_or_update_seller_profile
from app.services.seller_profile_service import resolve_seller_plan_bucket
from app.services.seller_subscription_reminder_service import run_seller_subscription_reminders_task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/seller", tags=["seller"])
settings = get_settings()


def _invalidate_public_marketplace_cache() -> None:
    cache_delete_prefixes("catalog:", "content:")


def _notify_admin_pending_seller_payment(
    db: Session,
    *,
    seller_user: User,
    profile: SellerProfile,
    amount: float,
    payment_mode: str,
    payment_id: str,
) -> None:
    admin_user = db.scalar(select(User).where(User.email == settings.admin_email.strip().lower()))
    if admin_user is None:
        return
    NotificationService(db).send_to_user(
        user_id=admin_user.id,
        payload=NotificationPayload(
            title="Paiement vendeur en attente",
            body=(
                f"{profile.business_name} ({seller_user.email}) attend une validation "
                f"de {int(amount)} XOF via {payment_mode.upper()}."
            ),
            data={
                "tag": f"seller-payment-pending-{payment_id}",
                "href": "/admin/finance",
                "kind": "seller_payment_pending",
            },
        ),
    )


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


def _normalize_product_image_url(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if normalized.startswith("/media/"):
        filename = normalized.rsplit("/", 1)[-1]
        return f"/api/v1/media/file/{filename}" if filename else None
    return normalized


def _resolve_product_main_image(product: Product) -> str | None:
    main_image_url = _normalize_product_image_url(product.main_image_url)
    if main_image_url:
        return main_image_url
    if not product.images:
        return None
    for image in sorted(product.images, key=lambda image: image.sort_order):
        image_url = _normalize_product_image_url(image.image_url)
        if image_url:
            return image_url
    return None


def _is_seller_deleted_listing(price: Price) -> bool:
    specs = price.product.specs or {}
    return bool(specs.get("seller_deleted"))


def _mark_seller_deleted_listing(price: Price) -> None:
    specs = dict(price.product.specs or {})
    specs["seller_deleted"] = True
    specs["seller_deleted_at"] = datetime.now(UTC).isoformat()
    price.product.specs = specs


def _has_active_subscription(profile: SellerProfile) -> bool:
    return (
        profile.onboarding_fee_paid_at is not None
        and profile.subscription_paid_until is not None
        and profile.subscription_paid_until > datetime.now(UTC)
    )


def _profile_plan_bucket(profile: SellerProfile) -> str:
    return resolve_seller_plan_bucket(profile.activity_type, profile.storefront_tier)


def _payload_plan_bucket(payload: SellerProfileRequest) -> str:
    return resolve_seller_plan_bucket(payload.activity_type, payload.storefront_tier)


def _can_manage_shop_catalog(profile: SellerProfile) -> bool:
    return profile.activity_type == "shop" or profile.storefront_tier == "premium"


def _sync_product_flags(product: Product) -> tuple[float | None, datetime | None]:
    specs = dict(product.specs or {})
    now = datetime.now(UTC)
    promo_price_raw = specs.get("promo_price")
    promo_until = _parse_utc_datetime(specs.get("promo_until"))
    promo_price = None
    if isinstance(promo_price_raw, (int, float)) and promo_until and promo_until > now:
        promo_price = float(promo_price_raw)
    return promo_price, promo_until


def _profile_response(profile: SellerProfile, db: Session) -> SellerProfileResponse:
    finance = build_effective_seller_finance_settings(get_or_create_global_settings(db), profile)
    return SellerProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        vendor_id=profile.vendor_id,
        business_name=profile.business_name,
        phone=decrypt_phone_value(profile.phone),
        payout_phone=getattr(profile, "payout_phone", None),
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
        commission_rate_override=profile.commission_rate_override,
        service_fee_override=profile.service_fee_override,
        seller_subscription_fee_override=profile.seller_subscription_fee_override,
        onboarding_fee_paid_at=profile.onboarding_fee_paid_at,
        subscription_paid_until=profile.subscription_paid_until,
        subscription_last_payment_reference=profile.subscription_last_payment_reference,
        effective_commission_rate=finance.commission_rate,
        effective_service_fee=finance.service_fee,
        effective_seller_subscription_fee=finance.seller_subscription_fee,
        accepts_table_reservations=bool(profile.accepts_table_reservations),
        accepts_hotel_bookings=bool(profile.accepts_hotel_bookings),
        is_enterprise=bool(getattr(profile, "is_enterprise", False)),
        offers_transport=bool(getattr(profile, "offers_transport", False)),
        offers_shop=bool(getattr(profile, "offers_shop", False)),
        offers_restaurant=bool(getattr(profile, "offers_restaurant", False)),
        service_kind=getattr(profile, "service_kind", None),
        is_verified=profile.is_verified,
        created_at=profile.created_at,
    )


def _build_subscription_status(profile: SellerProfile | None, db: Session) -> SellerSubscriptionStatusResponse:
    monthly_fee = 0.0
    onboarding_fee = 0.0
    onboarding_fee_paid = False
    subscription_paid_until = None
    subscription_active = False
    if profile is not None:
        finance = build_effective_seller_finance_settings(get_or_create_global_settings(db), profile)
        monthly_fee = float(finance.seller_subscription_fee)
        # Les frais de creation vendeur sont desactives: seul l'abonnement est facture.
        onboarding_fee = 0.0
        onboarding_fee_paid = profile.onboarding_fee_paid_at is not None
        subscription_paid_until = profile.subscription_paid_until
        # Coherent avec _has_active_subscription: la boutique n'est active qu'apres
        # validation du 1er paiement (onboarding) ET un abonnement non expire.
        subscription_active = (
            onboarding_fee_paid
            and subscription_paid_until is not None
            and subscription_paid_until > datetime.now(UTC)
        )
    amount_due_now = 0.0
    if profile is not None:
        amount_due_now += monthly_fee
        if not onboarding_fee_paid:
            amount_due_now += onboarding_fee
    has_pending_payment_request = False
    if profile is not None:
        has_pending_payment_request = (
            db.scalar(
                select(SellerSubscriptionPayment.id).where(
                    SellerSubscriptionPayment.seller_profile_id == profile.id,
                    SellerSubscriptionPayment.status == "pending",
                )
            )
            is not None
        )
    return SellerSubscriptionStatusResponse(
        has_seller_profile=profile is not None,
        onboarding_fee_paid=onboarding_fee_paid,
        onboarding_fee_paid_at=profile.onboarding_fee_paid_at if profile else None,
        subscription_paid_until=subscription_paid_until,
        subscription_active=subscription_active,
        monthly_fee=monthly_fee,
        onboarding_fee=onboarding_fee,
        amount_due_now=amount_due_now,
        currency="XOF",
        has_pending_payment_request=has_pending_payment_request,
    )


def _seller_subscription_amount_due(
    *,
    monthly_fee: float,
    months: int,
) -> float:
    safe_months = max(1, months)
    return monthly_fee * safe_months


def _payment_request_response(row: SellerSubscriptionPayment) -> SellerSubscriptionPaymentRequestResponse:
    return SellerSubscriptionPaymentRequestResponse(
        id=row.id,
        seller_profile_id=row.seller_profile_id,
        seller_user_id=row.seller_user_id,
        payment_mode=row.payment_mode,  # type: ignore[arg-type]
        transaction_reference=row.transaction_reference,
        months=row.months,
        amount_claimed=row.amount_claimed,
        status=row.status,  # type: ignore[arg-type]
        admin_note=row.admin_note,
        reviewed_by_user_id=row.reviewed_by_user_id,
        reviewed_at=row.reviewed_at,
        created_at=row.created_at,
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
        payment_status=getattr(row, "payment_status", "paid") or "paid",
        special_request=row.special_request,
        status=row.status,  # type: ignore[arg-type]
        created_at=row.created_at,
        departure_time=getattr(row, "departure_time", None),
    )


def _restaurant_reservation_response(row: RestaurantReservation) -> RestaurantReservationResponse:
    return RestaurantReservationResponse(
        id=row.id,
        vendor_id=row.vendor_id,
        customer_name=row.customer_name,
        customer_phone=decrypt_phone_value(row.customer_phone) or "***",
        reservation_at=row.reservation_at,
        guest_count=row.guest_count,
        note=row.note,
        deposit_amount=float(getattr(row, "deposit_amount", 0) or 0),
        payment_status=getattr(row, "payment_status", "paid") or "paid",
        transaction_reference=getattr(row, "transaction_reference", None),
        status=row.status,
        created_at=row.created_at,
    )


def _seller_shop_order_response(
    order: Order, vendor_id: str, *, product_names: dict[str, str] | None = None
) -> SellerShopOrderResponse:
    scoped_items = [item for item in order.items if item.vendor_id == vendor_id]
    scoped_total = sum(float(item.unit_price) * int(item.quantity) for item in scoped_items)
    product_map = product_names or {}
    return SellerShopOrderResponse(
        id=order.id,
        customer_name=order.user.full_name if order.user else "Client AMAZER",
        status=vendor_status(order, vendor_id),
        payment_mode=order.payment_mode,
        payment_status=order.payment_status,
        delivery_type=order.delivery_type,
        tracking_code=order.tracking_code,
        total_amount=scoped_total,
        currency=order.currency,
        created_at=order.created_at,
        items=[
            SellerShopOrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=product_map.get(item.product_id, "Article"),
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=float(item.unit_price) * int(item.quantity),
            )
            for item in scoped_items
        ],
    )


@router.get("/profile", response_model=SellerProfileResponse | None)
def get_profile(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SellerProfileResponse | None:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return None
    background_tasks.add_task(
        run_seller_subscription_reminders_task,
        current_user.id,
        profile.id,
    )
    return _profile_response(profile, db)


@router.post("/profile", response_model=SellerProfileResponse, status_code=status.HTTP_201_CREATED)
def upsert_profile(
    payload: SellerProfileRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SellerProfileResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is not None and _profile_plan_bucket(profile) != _payload_plan_bucket(payload):
        pending_payment_exists = (
            db.scalar(
                select(SellerSubscriptionPayment.id).where(
                    SellerSubscriptionPayment.seller_profile_id == profile.id,
                    SellerSubscriptionPayment.status == "pending",
                )
            )
            is not None
        )
        if pending_payment_exists:
            raise ConflictError(
                "Une demande de paiement vendeur est deja en attente. "
                "Terminez-la avant de changer de formule."
            )
    is_new_shop = profile is None
    profile = create_or_update_seller_profile(
        db,
        user=current_user,
        payload=payload.model_dump(exclude_none=True),
        existing_profile=profile,
    )
    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None:
        vendor.is_active = _has_active_subscription(profile)
    if is_new_shop:
        order_events.notify_seller_welcome(db, current_user.id, profile.vendor_id)
    db.commit()
    db.refresh(profile)
    _invalidate_public_marketplace_cache()
    return _profile_response(profile, db)


@router.get("/subscription-status", response_model=SellerSubscriptionStatusResponse)
def get_subscription_status(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SellerSubscriptionStatusResponse:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is not None:
        background_tasks.add_task(
            run_seller_subscription_reminders_task,
            current_user.id,
            profile.id,
        )
    return _build_subscription_status(profile, db)


@router.post("/subscription/pay", response_model=SellerSubscriptionStatusResponse)
def pay_seller_subscription(
    payload: SellerSubscriptionPayRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SellerSubscriptionStatusResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="seller_subscription_pay", limit=3, window_seconds=600)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Create a seller profile first")
    finance = build_effective_seller_finance_settings(get_or_create_global_settings(db), profile)
    pending_exists = (
        db.scalar(
            select(SellerSubscriptionPayment.id).where(
                SellerSubscriptionPayment.seller_profile_id == profile.id,
                SellerSubscriptionPayment.status == "pending",
            )
        )
        is not None
    )
    if pending_exists:
        raise ConflictError("Une demande de paiement est deja en attente de validation admin.")
    transaction_reference = (payload.transaction_reference or "").strip()
    if not transaction_reference:
        # Flux semi-auto: l'admin valide sur releve operateur meme sans reference saisie.
        transaction_reference = f"AUTO-{current_user.id[:8]}-{int(datetime.now(UTC).timestamp())}"
    amount_claimed = _seller_subscription_amount_due(
        monthly_fee=float(finance.seller_subscription_fee),
        months=payload.months,
    )
    payment_request = SellerSubscriptionPayment(
        seller_profile_id=profile.id,
        seller_user_id=current_user.id,
        payment_mode=payload.payment_mode,
        transaction_reference=transaction_reference,
        months=payload.months,
        amount_claimed=amount_claimed,
        status="pending",
    )
    db.add(payment_request)
    append_audit_log(
        db,
        event_type="seller_subscription_payment_submitted",
        actor=current_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={
            "months": payload.months,
            "payment_mode": payload.payment_mode,
            "transaction_reference": transaction_reference,
            "monthly_fee": float(finance.seller_subscription_fee),
            "onboarding_fee_applied": False,
            "amount_claimed": amount_claimed,
        },
    )
    _notify_admin_pending_seller_payment(
        db,
        seller_user=current_user,
        profile=profile,
        amount=float(payment_request.amount_claimed),
        payment_mode=payment_request.payment_mode,
        payment_id=payment_request.id,
    )
    db.commit()
    return _build_subscription_status(profile, db)


@router.get("/subscription/payment-requests", response_model=list[SellerSubscriptionPaymentRequestResponse])
def list_my_subscription_payment_requests(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SellerSubscriptionPaymentRequestResponse]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return []
    rows = db.scalars(
        select(SellerSubscriptionPayment)
        .where(SellerSubscriptionPayment.seller_profile_id == profile.id)
        .order_by(SellerSubscriptionPayment.created_at.desc())
        .limit(30)
    ).all()
    return [_payment_request_response(row) for row in rows]


@router.get("/storefront/{vendor_id}", response_model=SellerStorefrontResponse)
def get_storefront(
    vendor_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> SellerStorefrontResponse:
    # Vitrine publique : cache court (60 s), vide a chaque modification vendeur (prefixe « catalog: »).
    cache_key = build_cache_key("catalog:storefront", vendor_id=vendor_id)
    cached = cache_get_json(cache_key)
    if isinstance(cached, dict):
        return SellerStorefrontResponse.model_validate(cached)
    response = _build_public_storefront(vendor_id, db)
    cache_set_json(cache_key, response.model_dump(mode="json"), ttl_seconds=60)
    return response


def _build_public_storefront(vendor_id: str, db: Session) -> SellerStorefrontResponse:
    vendor = db.get(Vendor, vendor_id)
    profile = db.scalar(
        select(SellerProfile).where(SellerProfile.vendor_id == vendor_id).options(selectinload(SellerProfile.user))
    )
    if (
        vendor is None
        or not vendor.is_active
        or profile is None
        or (profile.user is not None and not profile.user.is_active)
        or not _has_active_subscription(profile)
    ):
        raise NotFoundError("Storefront not found")

    products = db.scalars(
        select(Price)
        .where(Price.vendor_id == vendor_id, Price.is_active.is_(True))
        .options(selectinload(Price.product).selectinload(Product.images))
        .order_by(Price.updated_at.desc())
        .limit(120)
    ).all()
    restaurant_menu = db.scalars(
        select(RestaurantMenuItem)
        .where(
            RestaurantMenuItem.vendor_id == vendor_id,
            RestaurantMenuItem.is_available.is_(True),
            RestaurantMenuItem.archived.is_(False),
        )
        .order_by(RestaurantMenuItem.category, RestaurantMenuItem.sort_order, RestaurantMenuItem.name)
        .limit(200)
    ).all()
    rating = vendor_review_service.summary(db, vendor_id)
    open_state = restaurant_service.open_state(getattr(profile, "weekly_hours", None), bool(getattr(profile, "orders_paused", False)))
    finance = build_effective_seller_finance_settings(get_or_create_global_settings(db), profile)

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
        payout_phone=getattr(profile, "payout_phone", None),
        effective_commission_rate=finance.commission_rate,
        effective_service_fee=finance.service_fee,
        accepts_table_reservations=bool(profile.accepts_table_reservations),
        accepts_hotel_bookings=bool(profile.accepts_hotel_bookings),
        offers_transport=bool(getattr(profile, "offers_transport", False)),
        offers_shop=bool(getattr(profile, "offers_shop", False)),
        offers_restaurant=bool(getattr(profile, "offers_restaurant", False)),
        is_verified=profile.is_verified,
        local_service=(
            build_local_service_item(profile, get_or_create_global_settings(db), datetime.now(UTC))
            if getattr(profile, "service_kind", None) in local_services.SERVICE_KINDS
            else None
        ),
        local_outlets=(
            [
                build_outlet_item(profile, outlet, get_or_create_global_settings(db), datetime.now(UTC), len(network))
                for network in [active_outlets(db, [profile.vendor_id]).get(profile.vendor_id, [])]
                for outlet in network
            ]
            if getattr(profile, "service_kind", None) == "fuel_station"
            else []
        ),
        products=[
            SellerStorefrontProductResponse(
                price_id=row.id,
                product_id=row.product_id,
                name=row.product.name,
                brand=row.product.brand,
                description=row.product.description,
                amount=row.amount,
                currency=row.currency,
                main_image_url=_resolve_product_main_image(row.product),
                is_digital=bool((row.product.specs or {}).get("is_digital")),
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
                category=item.category or "Plats",
                sort_order=int(item.sort_order or 0),
                sold_out=bool(item.sold_out),
            )
            for item in restaurant_menu
        ],
        restaurant_is_open=open_state.is_open,
        restaurant_open_label=open_state.label,
        rating_average=rating.average,
        rating_count=rating.count,
    )


@router.post("/products", response_model=SellerProductCreateResponse, status_code=status.HTTP_201_CREATED)
def create_product_listing(
    payload: SellerProductCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> SellerProductCreateResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Create a seller profile first")
    if not _can_manage_shop_catalog(profile):
        raise ValidationDomainError(
            "Cette formule vendeur ne permet pas de publier des produits. "
            "Passez en boutique ou en Premium."
        )
    if not is_premium_profile(profile):
        cap = max_products_for_basic_tier(db)
        current = count_vendor_catalog_products(db, profile.vendor_id)
        if current >= cap:
            raise ValidationDomainError(
                f"Limite atteinte: {cap} article(s) maximum pour les comptes hors Premium. "
                "Passez en formule Premium pour publier sans limite, ou retirez des articles."
            )
    # Réactive le mini-site: la boutique (list_vendor_storefronts) ne remonte que si Vendor.is_active=True.
    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None:
        vendor.is_active = _has_active_subscription(profile)

    product = Product(
        name=payload.name,
        brand=payload.brand.strip() or profile.business_name or "AMAZER",
        description=payload.description,
        main_image_url=payload.main_image_url,
        # Sans choix du vendeur, on range le produit automatiquement (sinon il n'apparait dans aucun filtre).
        category_id=payload.category_id or guess_category_id(db, payload.name, payload.description),
        # Code-barres : permet au client de retrouver le produit en le scannant depuis l'accueil.
        specs={**({"barcode": payload.barcode} if payload.barcode else {}), **({"is_digital": True} if payload.is_digital else {})},
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
    _invalidate_public_marketplace_cache()
    return SellerProductCreateResponse(
        product_id=product.id,
        price_id=price.id,
        vendor_id=profile.vendor_id,
    )


def _csv_get(row: dict[str, str], *names: str) -> str:
    """Recupere une valeur en testant plusieurs noms de colonnes (FR/EN), insensible a la casse."""
    lowered = {(k or "").strip().lower(): (v or "") for k, v in row.items()}
    for name in names:
        if name in lowered and str(lowered[name]).strip():
            return str(lowered[name]).strip()
    return ""


_IMPORT_HEADER_KEYWORDS = {
    "nom", "name", "produit", "product", "marque", "brand", "prix", "amount",
    "price", "stock", "quantite", "quantity", "description", "desc",
}
_IMPORT_POSITIONAL_COLUMNS = ["nom", "marque", "prix", "stock", "description"]


def _detect_delimiter(sample: str) -> str:
    """Choisit le separateur le plus probable parmi ; , tabulation | (sans dependance externe)."""
    candidates = [";", ",", "\t", "|"]
    first_line = next((ln for ln in sample.splitlines() if ln.strip()), "")
    counts = {sep: first_line.count(sep) for sep in candidates}
    best = max(counts, key=lambda sep: counts[sep])
    return best if counts[best] > 0 else ","


def _parse_import_rows(text: str) -> list[dict[str, str]]:
    """Import multi-format (pas seulement CSV): JSON, CSV/TSV, point-virgule, pipe, ou
    fichier texte sans en-tete (colonnes positionnelles nom, marque, prix, stock, description)."""
    stripped = text.strip()
    if not stripped:
        return []

    # 1) JSON: tableau d'objets [{"nom": ..., "prix": ...}, ...]
    if stripped[0] in "[{":
        try:
            data = json.loads(stripped)
        except ValueError:
            data = None
        if isinstance(data, dict):
            data = data.get("produits") or data.get("products") or data.get("items") or []
        if isinstance(data, list):
            return [
                {str(k): ("" if v is None else str(v)) for k, v in item.items()}
                for item in data
                if isinstance(item, dict)
            ]

    # 2) Texte tabulaire: detection du separateur + en-tete optionnel
    delimiter = _detect_delimiter(stripped)
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    rows = [r for r in rows if any((cell or "").strip() for cell in r)]
    if not rows:
        return []

    header_cells = [(cell or "").strip().lower() for cell in rows[0]]
    has_header = any(cell in _IMPORT_HEADER_KEYWORDS for cell in header_cells)
    if has_header:
        columns = header_cells
        data_rows = rows[1:]
    else:
        columns = _IMPORT_POSITIONAL_COLUMNS
        data_rows = rows

    parsed: list[dict[str, str]] = []
    for cells in data_rows:
        record: dict[str, str] = {}
        for idx, col in enumerate(columns):
            if idx < len(cells):
                record[col] = (cells[idx] or "").strip()
        parsed.append(record)
    return parsed


@router.post("/products/import")
def import_products_csv(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
    file: Annotated[UploadFile, File()],
) -> dict[str, object]:
    """Import en masse de produits, multi-format (Premium Entreprise uniquement).
    Formats: CSV, TSV, point-virgule, pipe, texte sans en-tete, ou JSON.
    Colonnes: nom/name, marque/brand, prix/amount, stock, description."""
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Create a seller profile first")
    if not getattr(profile, "is_enterprise", False):
        raise ForbiddenError("Import en masse reserve au Premium Entreprise.")

    raw = file.file.read()
    if len(raw) > 2_000_000:
        raise ValidationDomainError("Fichier trop volumineux (max 2 Mo).")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="ignore")

    parsed_rows = _parse_import_rows(text)
    created = 0
    errors: list[str] = []
    vendor = db.get(Vendor, profile.vendor_id)
    for index, row in enumerate(parsed_rows, start=2):
        if created >= 2000:
            errors.append("Limite de 2000 produits par import atteinte.")
            break
        name = _csv_get(row, "nom", "name", "produit", "product")
        brand = _csv_get(row, "marque", "brand") or name
        amount_raw = _csv_get(row, "prix", "amount", "price").replace(" ", "").replace(",", ".")
        stock_raw = _csv_get(row, "stock", "quantite", "quantity") or "0"
        description = _csv_get(row, "description", "desc") or None
        if not name or not amount_raw:
            errors.append(f"Ligne {index}: nom ou prix manquant, ignoree.")
            continue
        try:
            amount = float(amount_raw)
            stock = int(float(stock_raw))
        except ValueError:
            errors.append(f"Ligne {index}: prix ou stock invalide, ignoree.")
            continue
        if amount <= 0:
            errors.append(f"Ligne {index}: prix doit etre positif, ignoree.")
            continue
        product = Product(name=name[:200], brand=brand[:120], description=description, specs={})
        db.add(product)
        db.flush()
        db.add(
            Price(
                product_id=product.id,
                vendor_id=profile.vendor_id,
                currency="XOF",
                amount=amount,
                stock_quantity=max(0, stock),
                is_active=True,
            )
        )
        created += 1

    if vendor is not None and created > 0:
        vendor.is_active = _has_active_subscription(profile)
    append_audit_log(
        db,
        event_type="seller_products_imported",
        actor=current_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="vendor",
        entity_id=profile.vendor_id,
        details={"created": created, "errors": len(errors)},
    )
    db.commit()
    _invalidate_public_marketplace_cache()
    return {"created": created, "errors": errors[:50]}


def _clean_photo_product_name(filename: str | None) -> str:
    """Derive un nom de produit lisible a partir du nom de fichier de la photo."""
    if not filename:
        return ""
    base = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    base = base.rsplit(".", 1)[0]
    base = re.sub(r"[_\-]+", " ", base)
    base = re.sub(r"\s+", " ", base).strip()
    return base[:200]


async def _store_image_bytes(data: bytes) -> str:
    """Stocke des octets d'image via le provider media actif et renvoie l'URL publique."""
    from starlette.datastructures import Headers
    from starlette.datastructures import UploadFile as StarletteUploadFile

    from app.services.media_storage import get_media_storage

    upload = StarletteUploadFile(
        file=io.BytesIO(data),
        filename="import.jpg",
        headers=Headers({"content-type": "image/jpeg"}),
    )
    stored = await get_media_storage().save_upload(upload, ".jpg")
    return stored.url


@router.post("/products/import-photos")
async def import_product_photos(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
    files: Annotated[list[UploadFile], File()],
) -> dict[str, object]:
    """Import en masse par photos: cree un produit brouillon par image (image remplie,
    masque du public). Le vendeur complete ensuite nom/prix/stock dans le dashboard."""
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Create a seller profile first")
    # L'envoi de plusieurs produits a la fois (par photos) est reserve au Premium.
    if not is_premium_profile(profile):
        raise ForbiddenError(
            "L'envoi de plusieurs produits a la fois est reserve aux boutiques Premium."
        )
    if len(files) > 40:
        raise ValidationDomainError("Maximum 40 photos par envoi. Reessayez par lots.")
    remaining = 10_000

    created = 0
    errors: list[str] = []
    vendor = db.get(Vendor, profile.vendor_id)
    for upload in files:
        if created >= remaining:
            errors.append("Limite de catalogue atteinte, photos restantes ignorees.")
            break
        content_type = (upload.content_type or "").lower()
        if not content_type.startswith("image/"):
            errors.append(f"{upload.filename or 'fichier'}: pas une image, ignore.")
            continue
        raw = await upload.read()
        if not raw:
            errors.append(f"{upload.filename or 'fichier'}: vide, ignore.")
            continue
        try:
            data = compress_image_to_limit(raw)
        except Exception:
            errors.append(f"{upload.filename or 'fichier'}: image illisible, ignore.")
            continue
        try:
            url = await _store_image_bytes(data)
        except Exception:
            errors.append(f"{upload.filename or 'fichier'}: stockage impossible, ignore.")
            continue
        name = _clean_photo_product_name(upload.filename) or "Produit a completer"
        product = Product(
            name=name,
            brand=name[:120] or "A completer",
            description=None,
            main_image_url=url,
            specs={"draft_from_photo": True},
        )
        db.add(product)
        db.flush()
        # Produit brouillon: prix placeholder + inactif => masque du public tant que
        # le vendeur n'a pas saisi le vrai prix et reactive l'article.
        db.add(
            Price(
                product_id=product.id,
                vendor_id=profile.vendor_id,
                currency="XOF",
                amount=1,
                stock_quantity=0,
                is_active=False,
            )
        )
        created += 1

    if vendor is not None and created > 0:
        vendor.is_active = _has_active_subscription(profile)
    append_audit_log(
        db,
        event_type="seller_product_photos_imported",
        actor=current_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="vendor",
        entity_id=profile.vendor_id,
        details={"created": created, "errors": len(errors)},
    )
    db.commit()
    _invalidate_public_marketplace_cache()
    return {"created": created, "errors": errors[:50]}


@router.get("/inventory", response_model=list[SellerInventoryItemResponse])
def list_inventory(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[SellerInventoryItemResponse]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return []

    rows = db.scalars(
        select(Price)
        .where(Price.vendor_id == profile.vendor_id)
        .options(selectinload(Price.product).selectinload(Product.images))
        .order_by(Price.updated_at.desc())
    ).all()
    payload: list[SellerInventoryItemResponse] = []
    dirty = False
    for row in rows:
        if _is_seller_deleted_listing(row):
            continue
        if not promo_service.promo_active(row.product.specs or {}) and promo_service.end_promo(row):
            dirty = True
        promo_price, promo_until = _sync_product_flags(row.product)
        payload.append(
            SellerInventoryItemResponse(
                price_id=row.id,
                product_id=row.product_id,
                product_name=row.product.name,
                brand=row.product.brand,
                description=row.product.description,
                main_image_url=_resolve_product_main_image(row.product),
                category_id=row.product.category_id,
                amount=row.amount,
                currency=row.currency,
                stock_quantity=row.stock_quantity,
                is_active=row.is_active,
                promo_price=promo_price,
                promo_until=promo_until,
                regular_amount=promo_service.normal_price(row),
                is_digital=bool((row.product.specs or {}).get("is_digital")),
            )
        )
    if dirty:
        db.commit()
        _invalidate_public_marketplace_cache()
    return payload


@router.get("/orders", response_model=list[SellerShopOrderResponse])
def list_seller_orders(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[SellerShopOrderResponse]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return []

    rows = db.scalars(
        select(Order)
        .join(Order.items)
        .where(OrderItem.vendor_id == profile.vendor_id)
        .options(selectinload(Order.user), selectinload(Order.items), selectinload(Order.fulfillments))
        .order_by(Order.created_at.desc())
        .limit(50)
    ).unique().all()
    product_ids = {item.product_id for order in rows for item in order.items if item.vendor_id == profile.vendor_id}
    product_names = {
        row.id: row.name
        for row in db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
    } if product_ids else {}
    return [
        _seller_shop_order_response(order, profile.vendor_id, product_names=product_names)
        for order in rows
    ]


@router.get("/orders/export")
def export_seller_orders(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> StreamingResponse:
    """Export des ventes du vendeur en fichier texte (Premium Entreprise uniquement)."""
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    if not getattr(profile, "is_enterprise", False):
        raise ForbiddenError("Export reserve au Premium Entreprise.")

    rows = db.scalars(
        select(Order)
        .join(Order.items)
        .where(OrderItem.vendor_id == profile.vendor_id)
        .options(selectinload(Order.user), selectinload(Order.items), selectinload(Order.fulfillments))
        .order_by(Order.created_at.desc())
        .limit(5000)
    ).unique().all()
    product_ids = {item.product_id for order in rows for item in order.items if item.vendor_id == profile.vendor_id}
    product_names = {
        row.id: row.name
        for row in db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
    } if product_ids else {}

    # Export en texte lisible (tout melange sur chaque ligne), pas en colonnes CSV.
    lines: list[str] = []
    lines.append(f"VENTES AMAZER - {profile.business_name}")
    lines.append(f"Genere le {datetime.now(UTC).strftime('%d/%m/%Y %H:%M')} UTC")
    lines.append(f"{len(rows)} commande(s)")
    lines.append("=" * 60)
    total_global = 0.0
    for order in rows:
        items_for_vendor = [it for it in order.items if it.vendor_id == profile.vendor_id]
        articles = ", ".join(
            f"{product_names.get(it.product_id, it.product_id)} x{it.quantity}" for it in items_for_vendor
        )
        montant = sum(float(it.unit_price) * int(it.quantity) for it in items_for_vendor)
        total_global += montant
        date_str = order.created_at.strftime("%d/%m/%Y %H:%M") if order.created_at else "-"
        ref = order.tracking_code or order.id[:8]
        client = order.user.full_name if order.user else "Client AMAZER"
        lines.append(
            f"[{date_str}] #{ref} - {client} - {articles} - "
            f"{round(montant)} XOF - {(order.payment_mode or '').upper()} - {order.status}"
        )
    lines.append("=" * 60)
    lines.append(f"TOTAL: {round(total_global)} XOF")
    content = "\n".join(lines) + "\n"

    filename = f"ventes_amazer_{datetime.now(UTC).strftime('%Y%m%d')}.txt"
    return StreamingResponse(
        iter([content]),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.patch("/orders/{order_id}/status", response_model=SellerShopOrderResponse)
def update_seller_order_status(
    order_id: str,
    payload: SellerShopOrderStatusUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> SellerShopOrderResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")

    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.user), selectinload(Order.items), selectinload(Order.fulfillments))
    )
    if order is None or not any(item.vendor_id == profile.vendor_id for item in order.items):
        raise NotFoundError("Order not found")
    ensure_not_cancelled(order)
    if order.payment_status != "paid":
        raise ConflictError(
            "Paiement non confirme : attendez la validation du paiement avant de traiter cette commande."
        )

    previous_status = order.status
    set_vendor_status(order, profile.vendor_id, payload.status)
    if order.status == "recu":
        mark_order_delivered(db, order, source="seller")
    elif order.status != previous_status:
        order_events.notify_order_status(db, order, order.status)
    db.commit()
    db.refresh(order)
    product_ids = {item.product_id for item in order.items if item.vendor_id == profile.vendor_id}
    product_names = {
        row.id: row.name
        for row in db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
    } if product_ids else {}
    return _seller_shop_order_response(order, profile.vendor_id, product_names=product_names)


@router.patch("/inventory/{price_id}", response_model=SellerInventoryItemResponse)
def update_inventory_item(
    price_id: str,
    payload: SellerInventoryUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
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
    if payload.product_name is not None:
        price.product.name = payload.product_name.strip()
    if payload.brand is not None:
        price.product.brand = payload.brand.strip() or price.product.brand
    if payload.category_id is not None:
        price.product.category_id = payload.category_id or None
    if payload.barcode is not None:
        if payload.barcode:
            specs["barcode"] = payload.barcode
        else:
            specs.pop("barcode", None)
    if payload.description is not None:
        price.product.description = payload.description.strip() or None
    if payload.is_digital is not None:
        if payload.is_digital:
            specs["is_digital"] = True
        else:
            specs.pop("is_digital", None)
    if payload.main_image_url is not None:
        price.product.main_image_url = _normalize_product_image_url(payload.main_image_url)
    if payload.stock_quantity is not None:
        price.stock_quantity = payload.stock_quantity
    if payload.is_active is not None:
        if payload.is_active and getattr(price, "hidden_by_admin", False):
            raise ConflictError(
                "Ce produit a ete masque par l'equipe AMAZER. Contactez le support pour le reafficher."
            )
        price.is_active = payload.is_active
    price.product.specs = specs
    if payload.amount is not None or payload.promo_amount is not None or payload.clear_promo:
        promo_service.apply_price_and_promo(
            price,
            amount=payload.amount,
            promo_amount=payload.promo_amount,
            promo_days=payload.promo_days,
            clear_promo=payload.clear_promo,
            now=now,
        )

    # N'historiser que si le prix ou le stock change reellement (pas pour une edition
    # de nom/marque/description seule).
    if price.amount != previous_amount or price.stock_quantity != previous_stock:
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
            "promo_amount": payload.promo_amount,
        },
    )
    db.commit()
    db.refresh(price)
    _invalidate_public_marketplace_cache()

    promo_price, promo_until = _sync_product_flags(price.product)
    return SellerInventoryItemResponse(
        price_id=price.id,
        product_id=price.product_id,
        product_name=price.product.name,
        brand=price.product.brand,
        description=price.product.description,
        main_image_url=_resolve_product_main_image(price.product),
        category_id=price.product.category_id,
        amount=price.amount,
        currency=price.currency,
        stock_quantity=price.stock_quantity,
        is_active=price.is_active,
        promo_price=promo_price,
        promo_until=promo_until,
        regular_amount=promo_service.normal_price(price),
        is_digital=bool((price.product.specs or {}).get("is_digital")),
    )


@router.delete("/inventory/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory_item(
    price_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> None:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")

    price = db.get(Price, price_id)
    if price is None or price.vendor_id != profile.vendor_id:
        raise NotFoundError("Inventory item not found")

    previous_amount = price.amount
    previous_stock = price.stock_quantity
    price.is_active = False
    price.stock_quantity = 0
    _mark_seller_deleted_listing(price)

    db.add(
        PriceHistory(
            price_id=price.id,
            previous_amount=previous_amount,
            new_amount=price.amount,
            previous_stock_quantity=previous_stock,
            new_stock_quantity=price.stock_quantity,
            reason="seller_inventory_deleted",
        )
    )
    append_audit_log(
        db,
        event_type="seller_price_deleted",
        actor=current_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="price",
        entity_id=price.id,
        details={
            "product_id": price.product_id,
            "previous_amount": float(previous_amount),
            "previous_stock": int(previous_stock),
        },
    )
    db.commit()
    _invalidate_public_marketplace_cache()


def _deposit_payment_status(amount_due: float) -> str:
    """Un acompte du est en attente tant que le vendeur ne l'a pas confirme."""
    return "pending" if amount_due > 0 else "paid"


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
    if profile is None or (
        profile.activity_type != "restaurant" and profile.storefront_tier != "premium"
    ):
        raise NotFoundError("Restaurant storefront not found")
    if not profile.accepts_table_reservations:
        raise ConflictError("Table reservations are disabled for this restaurant")

    # Frais de reservation fixe par le restaurant (le client paie comme une commande
    # boutique). La reference de paiement est facultative: on ne bloque pas la reservation.
    deposit_amount = float(profile.deposit_amount or 0)
    transaction_reference = (payload.transaction_reference or "").strip() or None

    reservation = RestaurantReservation(
        vendor_id=vendor_id,
        user_id=current_user.id,
        customer_name=payload.customer_name,
        customer_phone=encrypt_phone_value(payload.customer_phone) or payload.customer_phone,
        reservation_at=payload.reservation_at,
        guest_count=payload.guest_count,
        note=payload.note,
        deposit_amount=deposit_amount,
        deposit_payment_method=payload.deposit_payment_method,
        transaction_reference=transaction_reference,
        # Acompte verse au vendeur : la reference du client n'est pas une preuve de paiement.
        payment_status=_deposit_payment_status(deposit_amount),
        status="pending",
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return _restaurant_reservation_response(reservation)


@router.get("/restaurant-reservations", response_model=list[RestaurantReservationResponse])
def list_seller_restaurant_reservations(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
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
    return [_restaurant_reservation_response(row) for row in rows]


@router.patch(
    "/restaurant-reservations/{reservation_id}/status",
    response_model=RestaurantReservationResponse,
)
def update_restaurant_reservation_status(
    reservation_id: str,
    payload: RestaurantReservationStatusUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> RestaurantReservationResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    reservation = db.get(RestaurantReservation, reservation_id)
    if reservation is None or reservation.vendor_id != profile.vendor_id:
        raise NotFoundError("Reservation not found")
    reservation.status = payload.status
    if payload.status == "confirmed":
        # Le vendeur confirme apres avoir constate l'acompte sur son propre compte.
        reservation.payment_status = "paid"
    db.commit()
    db.refresh(reservation)
    return _restaurant_reservation_response(reservation)


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
    if profile is None or (
        profile.activity_type not in {"hotel", "enterprise", "transport"}
        and profile.storefront_tier != "premium"
    ):
        raise NotFoundError("Premium storefront not found")
    if not profile.accepts_hotel_bookings:
        raise ConflictError("Hotel bookings are disabled for this storefront")

    is_transport = bool(getattr(profile, "offers_transport", False)) or profile.activity_type == "transport"

    room_map = {
        str(room.get("id")): room
        for room in (profile.room_types or [])
        if isinstance(room, dict) and room.get("id")
    }
    room = room_map.get(payload.room_type_id)
    if room is None:
        raise NotFoundError("Room type not found")

    nights = (payload.check_out_date - payload.check_in_date).days
    if nights <= 0 and not is_transport:
        raise ConflictError("Check-out must be after check-in")
    departure_time: str | None = None
    if is_transport:
        departure_time = transport_service.validate_departure(room, payload.check_in_date, payload.departure_time)
        left = transport_service.seats_left(db, vendor_id, room, payload.check_in_date, departure_time)
        if payload.guest_count > left:
            raise ConflictError(
                "Plus aucune place sur ce départ." if left <= 0 else f"Il ne reste que {left} place(s) sur ce départ."
            )
    if not is_transport:
        nights = hotel_service.validate_stay(payload.check_in_date, payload.check_out_date)
        if payload.guest_count > int(room.get("capacity") or 1) * 1:
            raise ValidationDomainError(f"Cette chambre accueille {int(room.get('capacity') or 1)} personne(s) au maximum.")
        free = hotel_service.availability(
            db, vendor_id, [room], payload.check_in_date, payload.check_out_date
        ).get(str(room.get("id")), 0)
        if free <= 0:
            raise ConflictError("Plus de chambre de ce type disponible pour ces dates. Essayez d'autres dates ou une autre chambre.")
    # Le client paie le montant total (prix unitaire x quantite), comme une commande
    # boutique. La reference de paiement est facultative: on ne bloque pas la reservation.
    unit_price = float(room.get("night_price") or 0)
    quantity = max(1, int(payload.guest_count or 1)) if is_transport else max(1, nights)
    amount_due = round(unit_price * quantity, 2)
    transaction_reference = (payload.transaction_reference or "").strip() or None

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
        deposit_amount=amount_due,
        transaction_reference=transaction_reference,
        # Acompte verse au vendeur : la reference du client n'est pas une preuve de paiement.
        payment_status=_deposit_payment_status(amount_due),
        special_request=payload.special_request,
        status="pending",
        departure_time=departure_time,
    )
    db.add(booking)
    db.flush()
    _notify_booking(
        db,
        profile.user_id,
        "Nouvelle réservation",
        (
            f"{payload.guest_name} · {room.get('name') or 'Trajet'} · {payload.guest_count} place(s) le {payload.check_in_date:%d/%m}"
            + (f" à {departure_time}" if departure_time else "")
            + ". À confirmer."
        )
        if is_transport
        else f"{payload.guest_name} · {room.get('name') or 'Chambre'} · du {payload.check_in_date:%d/%m} au {payload.check_out_date:%d/%m}. À confirmer.",
        f"booking-new-{booking.id}",
        "/seller/dashboard#commandes",
    )
    db.commit()
    db.refresh(booking)
    return _hotel_booking_response(booking)


@router.get("/storefront/{vendor_id}/availability", response_model=RoomAvailabilityResponse)
def room_availability(
    vendor_id: str,
    check_in: Annotated[date, Query()],
    check_out: Annotated[date, Query()],
    db: Annotated[Session, Depends(get_db)],
) -> RoomAvailabilityResponse:
    """Chambres libres par type pour des dates (le client ne voit que ce qu'il peut reserver)."""
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
    if profile is None:
        raise NotFoundError("Storefront not found")
    nights = hotel_service.validate_stay(check_in, check_out)
    rooms = [room for room in (profile.room_types or []) if isinstance(room, dict)]
    return RoomAvailabilityResponse(
        check_in_date=check_in,
        check_out_date=check_out,
        nights=nights,
        available=hotel_service.availability(db, vendor_id, rooms, check_in, check_out),
    )


@router.get("/storefront/{vendor_id}/seats", response_model=SeatAvailabilityResponse)
def trip_seats(
    vendor_id: str,
    trip_id: Annotated[str, Query(min_length=1, max_length=64)],
    day: Annotated[date, Query()],
    db: Annotated[Session, Depends(get_db)],
) -> SeatAvailabilityResponse:
    """Places restantes pour chaque heure de depart d'un trajet, un jour donne."""
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
    trip = next(
        (room for room in ((profile.room_types or []) if profile else []) if isinstance(room, dict) and str(room.get("id")) == trip_id),
        None,
    )
    if trip is None:
        raise NotFoundError("Trip not found")
    times = [str(t) for t in (trip.get("departure_times") or []) if t] or [""]
    return SeatAvailabilityResponse(
        trip_id=trip_id,
        day=day,
        seats_left={time: transport_service.seats_left(db, vendor_id, trip, day, time or None) for time in times},
    )


@router.get("/my-bookings", response_model=list[MyBookingResponse])
def my_bookings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[MyBookingResponse]:
    """Reservations du client (hotels et trajets), avec le billet a QR code des trajets confirmes."""
    rows = db.scalars(
        select(HotelBooking).where(HotelBooking.user_id == current_user.id).order_by(HotelBooking.check_in_date.desc()).limit(100)
    ).all()
    vendor_ids = {row.vendor_id for row in rows}
    profiles = (
        {p.vendor_id: p for p in db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_(vendor_ids)))} if vendor_ids else {}
    )
    result: list[MyBookingResponse] = []
    for row in rows:
        profile = profiles.get(row.vendor_id)
        is_trip = bool(profile and (getattr(profile, "offers_transport", False) or profile.activity_type == "transport"))
        result.append(
            MyBookingResponse(
                id=row.id,
                kind="transport" if is_trip else "hotel",
                vendor_id=row.vendor_id,
                place_name=profile.business_name if profile else "Établissement",
                item_name=str((row.room_snapshot or {}).get("name") or ("Trajet" if is_trip else "Chambre")),
                check_in_date=row.check_in_date,
                check_out_date=row.check_out_date,
                departure_time=getattr(row, "departure_time", None),
                guest_count=row.guest_count,
                amount=float(row.deposit_amount or 0),
                status=row.status,
                payment_status=getattr(row, "payment_status", "pending") or "pending",
                ticket_token=transport_service.ticket_token(row.id) if is_trip and row.status in ("confirmed", "checked_in") else None,
                created_at=row.created_at,
            )
        )
    return result


@router.post("/tickets/scan", response_model=TicketScanResponse)
def scan_ticket(
    payload: TicketScanRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> TicketScanResponse:
    """Embarquement : le transporteur scanne le QR code du billet (authentique, de sa compagnie, une seule fois)."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="ticket_scan", limit=120, window_seconds=60)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    try:
        booking_id = transport_service.read_ticket(payload.token)
    except ValidationDomainError as exc:
        return TicketScanResponse(ok=False, message=str(exc))
    booking = db.get(HotelBooking, booking_id)
    if booking is None or booking.vendor_id != profile.vendor_id:
        return TicketScanResponse(ok=False, message="Ce billet n'est pas pour votre compagnie.")
    trip = str((booking.room_snapshot or {}).get("name") or "Trajet")
    when = f"{booking.check_in_date:%d/%m}" + (f" à {booking.departure_time}" if getattr(booking, "departure_time", None) else "")
    if booking.status == "checked_in":
        return TicketScanResponse(ok=False, message=f"Déjà embarqué : {booking.guest_name}.", booking=_hotel_booking_response(booking))
    if booking.status != "confirmed":
        return TicketScanResponse(ok=False, message="Billet non confirmé ou annulé.", booking=_hotel_booking_response(booking))
    booking.status = "checked_in"
    db.commit()
    db.refresh(booking)
    return TicketScanResponse(
        ok=True,
        message=f"Bon voyage ! {booking.guest_name} · {booking.guest_count} place(s) · {trip} · {when}",
        booking=_hotel_booking_response(booking),
    )


@router.post("/storefront/{vendor_id}/events", status_code=204)
def storefront_event(
    vendor_id: str,
    payload: StorefrontEventRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User | None, Depends(get_current_user_optional)],
) -> None:
    """Compte une visite de la vitrine ou un contact (appel, WhatsApp). Le proprietaire n'est pas compte."""
    try:
        enforce_rate_limit(request, key=f"sf_{payload.kind}_{vendor_id}", limit=30, window_seconds=3600)
    except Exception:  # noqa: BLE001 - au-dela de la limite, on ignore sans erreur (statistique seulement)
        return
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == vendor_id))
    if profile is None or (user is not None and profile.user_id == user.id):
        return
    storefront_stats_service.record(db, vendor_id, payload.kind)
    db.commit()


@router.get("/stats", response_model=SellerStatsResponse)
def seller_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> SellerStatsResponse:
    """Visites, contacts et commandes : cette semaine contre la semaine d'avant ; 30 jours en Premium."""
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    premium = is_premium_profile(profile)
    this_week = storefront_stats_service.week_totals(db, profile.vendor_id, 0)
    last_week = storefront_stats_service.week_totals(db, profile.vendor_id, 1)
    return SellerStatsResponse(
        is_premium=premium,
        this_week=StatsWeek(**this_week.__dict__),
        last_week=StatsWeek(**last_week.__dict__),
        days=[
            StatsDay(day=day, views=views, contacts=contacts)
            for day, views, contacts in storefront_stats_service.daily(db, profile.vendor_id, 30 if premium else 7)
        ],
    )


def _review_items(db: Session, rows: list[VendorReview], me: str | None) -> list[VendorReviewItem]:
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_({r.user_id for r in rows})))} if rows else {}
    return [
        VendorReviewItem(
            id=row.id,
            author=vendor_review_service.public_name(users.get(row.user_id)),
            rating=row.rating,
            comment=row.comment,
            reply=row.reply,
            created_at=row.updated_at or row.created_at,
            is_mine=row.user_id == me,
        )
        for row in rows
    ]


@router.get("/storefront/{vendor_id}/reviews", response_model=VendorReviewsResponse)
def vendor_reviews(vendor_id: str, db: Annotated[Session, Depends(get_db)]) -> VendorReviewsResponse:
    """Avis verifies (publics) : moyenne, repartition et 30 derniers avis."""
    info = vendor_review_service.summary(db, vendor_id)
    rows = db.scalars(
        select(VendorReview)
        .where(VendorReview.vendor_id == vendor_id, VendorReview.is_hidden.is_(False))
        .order_by(VendorReview.updated_at.desc())
        .limit(30)
    ).all()
    return VendorReviewsResponse(average=info.average, count=info.count, distribution=info.distribution, items=_review_items(db, list(rows), None))


@router.post("/storefront/{vendor_id}/reviews", response_model=VendorReviewItem)
def post_vendor_review(
    vendor_id: str,
    payload: VendorReviewRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> VendorReviewItem:
    """Donner (ou modifier) son avis : seulement apres une commande livree, un sejour ou un voyage."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="vendor_review", limit=10, window_seconds=3600)
    if not vendor_review_service.can_review(db, current_user.id, vendor_id):
        raise ValidationDomainError("Vous pourrez donner votre avis après une commande livrée, un séjour ou un voyage avec cet établissement.")
    row = db.scalar(select(VendorReview).where(VendorReview.vendor_id == vendor_id, VendorReview.user_id == current_user.id))
    if row is None:
        row = VendorReview(vendor_id=vendor_id, user_id=current_user.id, rating=payload.rating)
        db.add(row)
    row.rating = payload.rating
    row.comment = payload.comment or None
    db.flush()
    owner = db.scalar(select(SellerProfile.user_id).where(SellerProfile.vendor_id == vendor_id))
    _notify_booking(db, owner, "Nouvel avis client", f"{payload.rating}/5 — {(payload.comment or '').strip()[:80]}", f"review-{row.id}", "/seller/dashboard#accueil")
    db.commit()
    db.refresh(row)
    _invalidate_public_marketplace_cache()
    return _review_items(db, [row], current_user.id)[0]


@router.get("/reviews", response_model=VendorReviewsResponse)
def my_shop_reviews(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> VendorReviewsResponse:
    """Avis recus par l'etablissement du vendeur (pour y repondre)."""
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return VendorReviewsResponse(average=0, count=0, distribution={i: 0 for i in range(1, 6)}, items=[])
    info = vendor_review_service.summary(db, profile.vendor_id)
    rows = db.scalars(
        select(VendorReview).where(VendorReview.vendor_id == profile.vendor_id).order_by(VendorReview.updated_at.desc()).limit(50)
    ).all()
    return VendorReviewsResponse(average=info.average, count=info.count, distribution=info.distribution, items=_review_items(db, list(rows), None))


@router.post("/reviews/{review_id}/reply", response_model=VendorReviewItem)
def reply_to_review(
    review_id: str,
    payload: VendorReviewReplyRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> VendorReviewItem:
    """Reponse publique de l'etablissement a un avis."""
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    row = db.get(VendorReview, review_id)
    if profile is None or row is None or row.vendor_id != profile.vendor_id:
        raise NotFoundError("Review not found")
    row.reply = payload.reply
    _notify_booking(db, row.user_id, "Réponse à votre avis", f"{profile.business_name} a répondu à votre avis.", f"review-reply-{row.id}", f"/shop/{row.vendor_id}")
    db.commit()
    db.refresh(row)
    _invalidate_public_marketplace_cache()
    return _review_items(db, [row], None)[0]


class AdminVendorReview(VendorReviewItem):
    vendor_name: str
    is_hidden: bool


@router.get("/admin/reviews", response_model=list[AdminVendorReview])
def admin_list_reviews(
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> list[AdminVendorReview]:
    """Admin : 100 derniers avis (pour masquer un avis abusif)."""
    rows = list(db.scalars(select(VendorReview).order_by(VendorReview.updated_at.desc()).limit(100)).all())
    names = {
        p.vendor_id: p.business_name
        for p in db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_({r.vendor_id for r in rows})))
    } if rows else {}
    items = _review_items(db, rows, None)
    return [
        AdminVendorReview(**item.model_dump(), vendor_name=names.get(row.vendor_id, "Établissement"), is_hidden=bool(row.is_hidden))
        for item, row in zip(items, rows)
    ]


@router.post("/reviews/{review_id}/hide", response_model=VendorReviewItem)
def hide_review(
    review_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> VendorReviewItem:
    """Admin : masquer (ou reafficher) un avis abusif."""
    enforce_csrf(request)
    row = db.get(VendorReview, review_id)
    if row is None:
        raise NotFoundError("Review not found")
    row.is_hidden = not row.is_hidden
    db.commit()
    db.refresh(row)
    _invalidate_public_marketplace_cache()
    return _review_items(db, [row], None)[0]


def _notify_booking(db: Session, user_id: str | None, title: str, body: str, tag: str, href: str) -> None:
    if not user_id:
        return
    try:
        NotificationService(db).send_to_user(
            user_id=user_id, payload=NotificationPayload(title=title, body=body, data={"tag": tag, "href": href})
        )
    except Exception:  # noqa: BLE001 - la reservation reste enregistree meme si la notification echoue
        logger.exception("Notification de reservation impossible (%s).", tag)


@router.get("/hotel-bookings", response_model=list[HotelBookingResponse])
def list_seller_hotel_bookings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> list[HotelBookingResponse]:
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        return []
    rows = db.scalars(
        select(HotelBooking)
        .where(HotelBooking.vendor_id == profile.vendor_id)
        .order_by(HotelBooking.check_in_date.desc(), HotelBooking.created_at.desc())
        .limit(300)
    ).all()
    return [_hotel_booking_response(row) for row in rows]


@router.patch("/hotel-bookings/{booking_id}/status", response_model=HotelBookingResponse)
def update_hotel_booking_status(
    booking_id: str,
    payload: HotelBookingStatusUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
) -> HotelBookingResponse:
    enforce_csrf(request)
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    booking = db.get(HotelBooking, booking_id)
    if booking is None or booking.vendor_id != profile.vendor_id:
        raise NotFoundError("Hotel booking not found")
    hotel_service.check_transition(booking.status, payload.status)
    changed = booking.status != payload.status
    booking.status = payload.status
    if payload.status == "confirmed":
        # Le vendeur confirme apres avoir constate l'acompte sur son propre compte.
        booking.payment_status = "paid"
    place = getattr(profile, "business_name", None) or "L'établissement"
    messages = {
        "confirmed": ("Réservation confirmée", f"{place} confirme votre réservation du {booking.check_in_date:%d/%m}."),
        "cancelled": ("Réservation annulée", f"{place} a annulé votre réservation du {booking.check_in_date:%d/%m}."),
    }
    if changed and payload.status in messages:
        title, body = messages[payload.status]
        _notify_booking(db, booking.user_id, title, body, f"booking-{payload.status}-{booking.id}", "/dashboard")
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
