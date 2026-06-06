import csv
import io
import re
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, object_session, selectinload

from app.config import get_settings
from app.core.cache import cache_delete_prefixes
from app.core.deps import get_admin_user, get_current_user, get_seller_user
from app.core.crypto import decrypt_phone_value, encrypt_phone_value
from app.core.csrf import enforce_csrf
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.hospitality import HotelBooking, RestaurantReservation
from app.models.order import Order, OrderItem
from app.models.price_history import PriceHistory
from app.models.product import Price, Product
from app.models.restaurant import RestaurantMenuItem
from app.models.seller_profile import SellerProfile
from app.models.seller_subscription_payment import SellerSubscriptionPayment
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
from app.services.audit_log_service import append_audit_log
from app.services.listing_limit_service import (
    count_vendor_catalog_products,
    is_premium_profile,
    max_products_for_basic_tier,
)
from app.services.notification_service import NotificationPayload, NotificationService
from app.services.seller_finance_service import (
    build_effective_seller_finance_settings,
    get_or_create_global_settings,
)
from app.services.seller_profile_service import create_or_update_seller_profile
from app.services.seller_profile_service import resolve_seller_plan_bucket
from app.services.seller_subscription_reminder_service import run_seller_subscription_reminders_task

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
        special_request=row.special_request,
        status=row.status,  # type: ignore[arg-type]
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
        status=order.status,
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
    profile = create_or_update_seller_profile(
        db,
        user=current_user,
        payload=payload.model_dump(exclude_none=True),
        existing_profile=profile,
    )
    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None:
        vendor.is_active = _has_active_subscription(profile)
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
        .where(RestaurantMenuItem.vendor_id == vendor_id, RestaurantMenuItem.is_available.is_(True))
        .order_by(RestaurantMenuItem.updated_at.desc())
        .limit(120)
    ).all()
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
        effective_commission_rate=finance.commission_rate,
        effective_service_fee=finance.service_fee,
        accepts_table_reservations=bool(profile.accepts_table_reservations),
        accepts_hotel_bookings=bool(profile.accepts_hotel_bookings),
        offers_transport=bool(getattr(profile, "offers_transport", False)),
        is_verified=profile.is_verified,
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
        brand=payload.brand,
        description=payload.description,
        main_image_url=payload.main_image_url,
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
    _invalidate_public_marketplace_cache()
    return SellerProductCreateResponse(
        product_id=product.id,
        price_id=price.id,
        vendor_id=profile.vendor_id,
    )


def _csv_get(row: dict[str, str], *names: str) -> str:
    """Recupere une valeur CSV en testant plusieurs noms de colonnes (FR/EN), insensible a la casse."""
    lowered = {(k or "").strip().lower(): (v or "") for k, v in row.items()}
    for name in names:
        if name in lowered and lowered[name].strip():
            return lowered[name].strip()
    return ""


@router.post("/products/import")
def import_products_csv(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_seller_user)],
    file: Annotated[UploadFile, File()],
) -> dict[str, object]:
    """Import en masse de produits via CSV (Premium Entreprise uniquement).
    Colonnes acceptees: nom/name, marque/brand, prix/amount, stock, description."""
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

    reader = csv.DictReader(io.StringIO(text))
    created = 0
    errors: list[str] = []
    vendor = db.get(Vendor, profile.vendor_id)
    for index, row in enumerate(reader, start=2):
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
        .options(selectinload(Order.user), selectinload(Order.items))
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
    """Export CSV des ventes du vendeur (Premium Entreprise uniquement)."""
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if profile is None:
        raise NotFoundError("Seller profile not found")
    if not getattr(profile, "is_enterprise", False):
        raise ForbiddenError("Export reserve au Premium Entreprise.")

    rows = db.scalars(
        select(Order)
        .join(Order.items)
        .where(OrderItem.vendor_id == profile.vendor_id)
        .options(selectinload(Order.user), selectinload(Order.items))
        .order_by(Order.created_at.desc())
        .limit(5000)
    ).unique().all()
    product_ids = {item.product_id for order in rows for item in order.items if item.vendor_id == profile.vendor_id}
    product_names = {
        row.id: row.name
        for row in db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
    } if product_ids else {}

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Date", "Commande", "Client", "Articles", "Montant total XOF", "Paiement", "Statut"])
    for order in rows:
        items_for_vendor = [it for it in order.items if it.vendor_id == profile.vendor_id]
        articles = "; ".join(
            f"{product_names.get(it.product_id, it.product_id)} x{it.quantity}" for it in items_for_vendor
        )
        montant = sum(float(it.unit_price) * int(it.quantity) for it in items_for_vendor)
        writer.writerow([
            order.created_at.strftime("%Y-%m-%d %H:%M") if order.created_at else "",
            (order.tracking_code or order.id[:8]),
            order.user.full_name if order.user else "",
            articles,
            round(montant),
            (order.payment_mode or "").upper(),
            order.status,
        ])
    buffer.seek(0)
    filename = f"ventes_amazer_{datetime.now(UTC).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
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
        .options(selectinload(Order.user), selectinload(Order.items))
    )
    if order is None or not any(item.vendor_id == profile.vendor_id for item in order.items):
        raise NotFoundError("Order not found")

    order.status = payload.status
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
        price.product.brand = payload.brand.strip()
    if payload.category_id is not None:
        price.product.category_id = payload.category_id or None
    if payload.description is not None:
        price.product.description = payload.description.strip() or None
    if payload.main_image_url is not None:
        price.product.main_image_url = _normalize_product_image_url(payload.main_image_url)
    if payload.amount is not None:
        price.amount = payload.amount
    if payload.stock_quantity is not None:
        price.stock_quantity = payload.stock_quantity
    if payload.is_active is not None:
        price.is_active = payload.is_active
    if payload.promo_amount is not None:
        current = float(price.amount)
        if current > float(payload.promo_amount):
            specs["original_price"] = current
        specs["promo_price"] = payload.promo_amount
        specs["promo_until"] = (now + timedelta(days=7)).isoformat()
        price.amount = payload.promo_amount
    price.product.specs = specs

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
    current_user: Annotated[User, Depends(get_seller_user)],
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
    current_user: Annotated[User, Depends(get_seller_user)],
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
