from datetime import UTC, date, datetime, timedelta
import csv
import io
import json
import logging
import re
import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.core.cache import cache_delete_prefixes
from app.core.crypto import decrypt_payment_code, decrypt_phone_value, encrypt_payment_code
from app.core.csrf import enforce_csrf
from app.core.deps import get_admin_user
from app.core.exceptions import UnauthorizedError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.finance import FinanceDistrictFee
from app.models.finance import FinanceTransfer
from app.models.global_settings import GlobalSettings
from app.models.order import Order
from app.models.product import Price
from app.models.receipt_scan import ReceiptScan
from app.models.restaurant import RestaurantOrder
from app.models.seller_profile import SellerProfile
from app.models.seller_pending_registration import SellerPendingRegistration
from app.models.seller_subscription_payment import SellerSubscriptionPayment
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.vendor import Vendor
from app.core.security import hash_password
from app.schemas.finance import (
    AdminPendingSellerDecisionRequest,
    AdminPendingSellerResponse,
    AdminSellerResponse,
    AdminSellerSubscriptionPaymentDecisionRequest,
    AdminSellerSubscriptionPaymentRequestResponse,
    AdminSellerPricingUpdateRequest,
    AdminSellerTypeUpdateRequest,
    AdminUserResponse,
    AdminUserStatsResponse,
    AdminOrderStatusUpdateRequest,
    AdminOrderTrackingResponse,
    AuditLogResponse,
    DistrictFeeItem,
    CountersResetResponse,
    FinanceSettingsResponse,
    FinanceSettingsUpdateRequest,
    FinanceSummaryResponse,
    PinVerifyRequest,
    PublicContactInfoResponse,
    RevenuePoint,
    TransferRequest,
    TransferResponse,
    TreasuryTransactionResponse,
    WalletSummaryResponse,
)
from app.services.audit_log_service import append_audit_log
from app.services.notification_service import NotificationPayload, NotificationService
from app.services.seller_finance_service import (
    build_effective_seller_finance_settings,
    get_or_create_global_settings,
)

router = APIRouter(prefix="/admin/finance", tags=["admin-finance"])
settings = get_settings()
AUTO_RECEIPT_TIMEOUT_HOURS = 24


def _looks_like_birth_date(value: str) -> bool:
    return bool(re.match(r"^\d{2}/\d{2}/\d{2,4}$", (value or "").strip()))


def _looks_like_pin(value: str) -> bool:
    return bool(re.match(r"^\d{4,}$", (value or "").strip()))


def _normalize_admin_birth_date(value: str) -> str:
    raw = (value or "").strip().replace("-", "/").replace(".", "/")
    parts = [p for p in raw.split("/") if p]
    if len(parts) != 3:
        return raw.lower()
    day, month, year = parts[0].zfill(2), parts[1].zfill(2), parts[2]
    if len(year) == 4:
        year = year[-2:]
    else:
        year = year.zfill(2)
    return f"{day}/{month}/{year}"


def _admin_finance_keys_match(pin: str, birth_date: str) -> bool:
    expected_pin = (settings.admin_finance_pin or "").strip()
    expected_birth = (settings.admin_birth_date or "").strip()
    if not expected_pin or not expected_birth:
        return False

    p, b = (pin or "").strip(), (birth_date or "").strip()
    if p == expected_pin and _normalize_admin_birth_date(b) == _normalize_admin_birth_date(expected_birth):
        return True
    if _looks_like_birth_date(p) and _looks_like_pin(b):
        return (
            b == expected_pin
            and _normalize_admin_birth_date(p) == _normalize_admin_birth_date(expected_birth)
        )
    return False


def _invalidate_public_marketplace_cache() -> None:
    cache_delete_prefixes("catalog:", "content:")

def _get_or_create_settings(db: Session) -> GlobalSettings:
    return get_or_create_global_settings(db)


def _finance_counters_reset_at(settings: GlobalSettings) -> datetime | None:
    return settings.finance_counters_reset_at


def _ad_click_counters_reset_at(settings: GlobalSettings) -> datetime | None:
    return settings.ad_click_counters_reset_at


def _effective_commission_rate(settings: GlobalSettings, profile: SellerProfile | None = None) -> float:
    return build_effective_seller_finance_settings(settings, profile).commission_rate


def _to_response(settings: GlobalSettings) -> FinanceSettingsResponse:
    return FinanceSettingsResponse(
        commission_rate=_effective_commission_rate(settings),
        service_fee=settings.service_fee,
        default_delivery_fee=settings.default_delivery_fee,
        seller_subscription_fee_shop=settings.seller_subscription_fee_shop,
        seller_subscription_fee_restaurant=settings.seller_subscription_fee_restaurant,
        seller_subscription_fee_premium=settings.seller_subscription_fee_premium,
        ad_boost_price=settings.ad_boost_price,
        ad_boost_duration_days=settings.ad_boost_duration_days,
        urban_delivery_fee=settings.urban_delivery_fee,
        peripheral_delivery_fee=settings.peripheral_delivery_fee,
        ad_boost_price_24h=settings.ad_boost_price_24h,
        ad_boost_price_7d=settings.ad_boost_price_7d,
        launch_mode_zero_commission=settings.launch_mode_zero_commission,
        max_products_basic_tier=int(settings.max_products_basic_tier or 10),
        platform_wallet_phone=settings.platform_wallet_phone,
        support_email=settings.support_email,
        support_phone=settings.support_phone,
        support_whatsapp=settings.support_whatsapp,
    )


def _require_finance_pin(request: Request) -> None:
    pin_cookie = request.cookies.get("finance_pin_verified")
    if pin_cookie != "1":
        raise UnauthorizedError("Finance PIN verification required")


def _commission_from_order(amount: float, finance: GlobalSettings) -> float:
    return (amount * _effective_commission_rate(finance)) + finance.service_fee


def _build_admin_seller_response(
    profile: SellerProfile,
    vendor: Vendor | None,
    settings: GlobalSettings,
) -> AdminSellerResponse:
    finance = build_effective_seller_finance_settings(settings, profile)
    return AdminSellerResponse(
        profile_id=profile.id,
        user_id=profile.user_id,
        vendor_id=profile.vendor_id,
        business_name=profile.business_name,
        city=profile.city,
        phone=decrypt_phone_value(profile.phone),
        is_verified=profile.is_verified,
        is_active=bool(vendor.is_active) if vendor else False,
        activity_type=profile.activity_type or "shop",
        storefront_tier=profile.storefront_tier or "basic",
        is_enterprise=bool(getattr(profile, "is_enterprise", False)),
        offers_transport=bool(getattr(profile, "offers_transport", False)),
        subscription_paid_until=profile.subscription_paid_until.isoformat() if profile.subscription_paid_until else None,
        commission_rate_override=profile.commission_rate_override,
        service_fee_override=profile.service_fee_override,
        seller_subscription_fee_override=profile.seller_subscription_fee_override,
        effective_commission_rate=finance.commission_rate,
        effective_service_fee=finance.service_fee,
        effective_seller_subscription_fee=finance.seller_subscription_fee,
        created_at=profile.created_at.isoformat(),
    )


def _build_admin_subscription_payment_response(
    row: SellerSubscriptionPayment, profile: SellerProfile | None, user: User | None
) -> AdminSellerSubscriptionPaymentRequestResponse:
    return AdminSellerSubscriptionPaymentRequestResponse(
        id=row.id,
        seller_profile_id=row.seller_profile_id,
        seller_user_id=row.seller_user_id,
        business_name=profile.business_name if profile else "Seller",
        seller_email=user.email if user else "",
        payment_mode=row.payment_mode,
        transaction_reference=row.transaction_reference,
        months=row.months,
        amount_claimed=row.amount_claimed,
        status=row.status,
        admin_note=row.admin_note,
        reviewed_by_user_id=row.reviewed_by_user_id,
        reviewed_at=row.reviewed_at.isoformat() if row.reviewed_at else None,
        created_at=row.created_at.isoformat(),
    )


def _seller_profile_map(db: Session, vendor_ids: set[str]) -> dict[str, SellerProfile]:
    if not vendor_ids:
        return {}
    rows = db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_(vendor_ids))).all()
    return {row.vendor_id: row for row in rows}


def _platform_fee_breakdown_for_order(
    order: Order,
    settings: GlobalSettings,
    profiles_by_vendor: dict[str, SellerProfile],
) -> tuple[float, float]:
    subtotal_by_vendor: dict[str, float] = {}
    for item in order.items:
        subtotal_by_vendor[item.vendor_id] = subtotal_by_vendor.get(item.vendor_id, 0.0) + (
            float(item.unit_price) * int(item.quantity)
        )

    commission_total = 0.0
    service_fee_total = 0.0
    for vendor_id, subtotal in subtotal_by_vendor.items():
        finance = build_effective_seller_finance_settings(settings, profiles_by_vendor.get(vendor_id))
        commission_total += subtotal * finance.commission_rate
        service_fee_total += finance.service_fee
    return commission_total, service_fee_total


def _platform_fee_breakdown_for_restaurant_order(
    order: RestaurantOrder,
    settings: GlobalSettings,
    profiles_by_vendor: dict[str, SellerProfile],
) -> tuple[float, float]:
    finance = build_effective_seller_finance_settings(settings, profiles_by_vendor.get(order.vendor_id))
    return float(order.total_amount) * finance.commission_rate, finance.service_fee


def _safe_decrypt_code(token: str | None) -> str | None:
    if not token:
        return None
    try:
        return decrypt_payment_code(token)
    except Exception:
        return None


def _audit_admin_access(db: Session, request: Request, user: User, event_type: str) -> None:
    append_audit_log(
        db,
        event_type=event_type,
        actor=user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="admin_finance",
        details={"method": request.method},
    )
    db.commit()


def _normalize_day(value: object) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def _is_admin_email(email: str | None) -> bool:
    if not email:
        return False
    return email.lower() == settings.admin_email.lower()


def _build_admin_user_response(user: User, seller_user_ids: set[str]) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        whatsapp_phone=user.whatsapp_phone,
        is_active=bool(user.is_active),
        is_admin=_is_admin_email(user.email),
        is_seller=user.id in seller_user_ids,
        created_at=user.created_at.isoformat(),
    )


def _latest_dispatch_marker(db: Session, order_id: str) -> datetime | None:
    marker = db.scalar(
        select(ReceiptScan.scanned_at)
        .where(ReceiptScan.order_id == order_id, ReceiptScan.result == "pending")
        .order_by(ReceiptScan.scanned_at.desc())
        .limit(1)
    )
    return marker


def _auto_finalize_order_without_qr(
    db: Session,
    order: Order,
    request: Request,
    admin_user: User,
) -> bool:
    if order.status != "livraison" or order.payment_status != "paid":
        return False

    already_verified = db.scalar(
        select(ReceiptScan.id)
        .where(
            ReceiptScan.order_id == order.id,
            ReceiptScan.result.in_(["accepted", "auto_verified"]),
        )
        .limit(1)
    )
    if already_verified is not None:
        return False

    reference_time = _latest_dispatch_marker(db, order.id) or order.created_at
    if reference_time.tzinfo is None:
        reference_time = reference_time.replace(tzinfo=UTC)
    elapsed = datetime.now(UTC) - reference_time
    if elapsed < timedelta(hours=AUTO_RECEIPT_TIMEOUT_HOURS):
        return False

    order.status = "recu"
    unique_vendor_ids = {item.vendor_id for item in order.items}
    vendor_id = next(iter(unique_vendor_ids)) if len(unique_vendor_ids) == 1 else None
    db.add(
        ReceiptScan(
            order_id=order.id,
            vendor_id=vendor_id,
            ip_address=request.client.host if request.client else None,
            gps="AUTO_TIMEOUT",
            result="auto_verified",
        )
    )
    append_audit_log(
        db,
        event_type="admin_order_auto_verified_timeout",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="order",
        entity_id=order.id,
        details={
            "status": "recu",
            "reason": "qr_missing_timeout",
            "timeout_hours": AUTO_RECEIPT_TIMEOUT_HOURS,
        },
    )
    return True


@router.post("/pin/verify", status_code=204)
def verify_admin_finance_pin(
    payload: PinVerifyRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> None:
    enforce_csrf(request)
    enforce_rate_limit(request, key="admin_finance_pin", limit=5, window_seconds=300)
    if not _admin_finance_keys_match(payload.pin, payload.birth_date):
        raise UnauthorizedError("Invalid finance PIN")
    same_site = "none" if settings.is_production() else "lax"
    response.set_cookie(
        key="finance_pin_verified",
        value="1",
        httponly=True,
        secure=settings.is_production(),
        samesite=same_site,
        max_age=30 * 60,
        path="/",
    )
    append_audit_log(
        db,
        event_type="admin_finance_pin_verified",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="admin_finance",
        details={},
    )
    db.commit()


@router.get("/settings", response_model=FinanceSettingsResponse)
def get_finance_settings(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> FinanceSettingsResponse:
    _require_finance_pin(request)
    _audit_admin_access(db, request, admin_user, "admin_finance_settings_read")
    settings = _get_or_create_settings(db)
    return _to_response(settings)


@router.put("/settings", response_model=FinanceSettingsResponse)
def update_finance_settings(
    payload: FinanceSettingsUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> FinanceSettingsResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    settings_row = _get_or_create_settings(db)
    settings_row.commission_rate = payload.commission_rate
    settings_row.service_fee = payload.service_fee
    settings_row.default_delivery_fee = payload.default_delivery_fee
    settings_row.urban_delivery_fee = payload.urban_delivery_fee
    settings_row.peripheral_delivery_fee = payload.peripheral_delivery_fee
    settings_row.seller_subscription_fee_shop = payload.seller_subscription_fee_shop
    settings_row.seller_subscription_fee_restaurant = payload.seller_subscription_fee_restaurant
    settings_row.seller_subscription_fee_premium = payload.seller_subscription_fee_premium
    settings_row.seller_subscription_fee = payload.seller_subscription_fee_shop
    settings_row.ad_boost_price = payload.ad_boost_price
    settings_row.ad_boost_duration_days = payload.ad_boost_duration_days
    settings_row.ad_boost_price_24h = payload.ad_boost_price_24h
    settings_row.ad_boost_price_7d = payload.ad_boost_price_7d
    settings_row.launch_mode_zero_commission = payload.launch_mode_zero_commission
    settings_row.max_products_basic_tier = payload.max_products_basic_tier
    settings_row.platform_wallet_phone = payload.platform_wallet_phone
    settings_row.support_email = payload.support_email
    settings_row.support_phone = payload.support_phone
    settings_row.support_whatsapp = payload.support_whatsapp
    append_audit_log(
        db,
        event_type="admin_finance_settings_updated",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="finance_settings",
        details=payload.model_dump(),
    )
    db.commit()
    db.refresh(settings_row)
    return _to_response(settings_row)


@router.get("/summary", response_model=FinanceSummaryResponse)
def get_finance_summary(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> FinanceSummaryResponse:
    _require_finance_pin(request)
    _audit_admin_access(db, request, admin_user, "admin_finance_summary_read")
    settings = _get_or_create_settings(db)
    today = datetime.now(UTC).date()
    start_date = today - timedelta(days=29)
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=UTC)

    active_sellers = db.scalar(select(func.count(SellerProfile.id))) or 0

    revenue_map: dict[date, float] = {start_date + timedelta(days=i): 0 for i in range(30)}
    platform_orders = db.scalars(
        select(Order)
        .where(Order.created_at >= start_dt)
        .options(selectinload(Order.items))
    ).all()
    restaurant_orders = db.scalars(
        select(RestaurantOrder).where(RestaurantOrder.created_at >= start_dt)
    ).all()
    reset_at = _finance_counters_reset_at(settings)
    if reset_at is not None:
        platform_orders = [order for order in platform_orders if order.created_at >= reset_at]
        restaurant_orders = [order for order in restaurant_orders if order.created_at >= reset_at]
    vendor_ids = {item.vendor_id for order in platform_orders for item in order.items}
    vendor_ids.update(order.vendor_id for order in restaurant_orders)
    profiles_by_vendor = _seller_profile_map(db, vendor_ids)

    total_commissions = 0.0
    for order in platform_orders:
        day_value = _normalize_day(order.created_at)
        if day_value is None:
            continue
        commission_total, service_fee_total = _platform_fee_breakdown_for_order(
            order,
            settings,
            profiles_by_vendor,
        )
        amount = commission_total + service_fee_total
        total_commissions += amount
        if day_value in revenue_map:
            revenue_map[day_value] += amount

    for order in restaurant_orders:
        day_value = _normalize_day(order.created_at)
        if day_value is None:
            continue
        commission_total, service_fee_total = _platform_fee_breakdown_for_restaurant_order(
            order,
            settings,
            profiles_by_vendor,
        )
        amount = commission_total + service_fee_total
        total_commissions += amount
        if day_value in revenue_map:
            revenue_map[day_value] += amount

    points = [RevenuePoint(day=day_key, amount=round(revenue_map[day_key], 2)) for day_key in sorted(revenue_map)]
    return FinanceSummaryResponse(
        total_commissions_collected=round(total_commissions, 2),
        active_sellers=active_sellers,
        revenue_last_30_days=points,
    )


@router.get("/wallet-summary", response_model=WalletSummaryResponse)
def get_wallet_summary(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> WalletSummaryResponse:
    _require_finance_pin(request)
    _audit_admin_access(db, request, admin_user, "admin_finance_wallet_read")
    finance = _get_or_create_settings(db)

    platform_totals = db.execute(
        select(Order.payment_mode, func.sum(Order.total_amount)).group_by(Order.payment_mode)
    ).all()
    restaurant_totals = db.execute(
        select(RestaurantOrder.payment_mode, func.sum(RestaurantOrder.total_amount)).group_by(RestaurantOrder.payment_mode)
    ).all()
    reset_at = _finance_counters_reset_at(finance)
    if reset_at is not None:
        platform_totals = db.execute(
            select(Order.payment_mode, func.sum(Order.total_amount))
            .where(Order.created_at >= reset_at)
            .group_by(Order.payment_mode)
        ).all()
        restaurant_totals = db.execute(
            select(RestaurantOrder.payment_mode, func.sum(RestaurantOrder.total_amount))
            .where(RestaurantOrder.created_at >= reset_at)
            .group_by(RestaurantOrder.payment_mode)
        ).all()
    totals = {"nita": 0.0, "amana": 0.0, "cash_on_delivery": 0.0}
    for mode, amount in platform_totals:
        if amount is None:
            continue
        totals[mode] = totals.get(mode, 0.0) + float(amount)
    for mode, amount in restaurant_totals:
        if amount is None:
            continue
        totals[mode] = totals.get(mode, 0.0) + float(amount)

    total_all = sum(totals.values())
    platform_order_query = select(Order).options(selectinload(Order.items))
    restaurant_order_query = select(RestaurantOrder)
    if reset_at is not None:
        platform_order_query = platform_order_query.where(Order.created_at >= reset_at)
        restaurant_order_query = restaurant_order_query.where(RestaurantOrder.created_at >= reset_at)
    platform_orders = db.scalars(platform_order_query).all()
    restaurant_orders = db.scalars(restaurant_order_query).all()
    vendor_ids = {item.vendor_id for order in platform_orders for item in order.items}
    vendor_ids.update(order.vendor_id for order in restaurant_orders)
    profiles_by_vendor = _seller_profile_map(db, vendor_ids)
    commission_total = 0.0
    service_fee_total = 0.0
    for order in platform_orders:
        order_commission_total, order_service_fee_total = _platform_fee_breakdown_for_order(
            order,
            finance,
            profiles_by_vendor,
        )
        commission_total += order_commission_total
        service_fee_total += order_service_fee_total
    for order in restaurant_orders:
        order_commission_total, order_service_fee_total = _platform_fee_breakdown_for_restaurant_order(
            order,
            finance,
            profiles_by_vendor,
        )
        commission_total += order_commission_total
        service_fee_total += order_service_fee_total
    return WalletSummaryResponse(
        total_nita=round(totals.get("nita", 0.0), 2),
        total_amana=round(totals.get("amana", 0.0), 2),
        total_cash_on_delivery=round(totals.get("cash_on_delivery", 0.0), 2),
        total_all=round(total_all, 2),
        amazer_commission_total=round(commission_total, 2),
        service_fee_total=round(service_fee_total, 2),
    )


@router.get("/treasury-history", response_model=list[TreasuryTransactionResponse])
def get_treasury_history(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    limit: int = 80,
) -> list[TreasuryTransactionResponse]:
    _require_finance_pin(request)
    _audit_admin_access(db, request, admin_user, "admin_finance_treasury_read")
    history: list[TreasuryTransactionResponse] = []
    settings_row = _get_or_create_settings(db)
    reset_at = _finance_counters_reset_at(settings_row)
    platform_query = select(Order).order_by(Order.created_at.desc())
    restaurant_query = select(RestaurantOrder).order_by(RestaurantOrder.created_at.desc())
    if reset_at is not None:
        platform_query = platform_query.where(Order.created_at >= reset_at)
        restaurant_query = restaurant_query.where(RestaurantOrder.created_at >= reset_at)
    platform_orders = db.scalars(platform_query.limit(limit)).all()
    restaurant_orders = db.scalars(restaurant_query.limit(limit)).all()
    for order in platform_orders:
        history.append(
            TreasuryTransactionResponse(
                source="ecommerce",
                order_id=order.id,
                payment_mode=order.payment_mode,
                amount=order.total_amount,
                encrypted_transaction_code=order.transaction_code,
                decrypted_transaction_code=_safe_decrypt_code(order.transaction_code),
                created_at=order.created_at.isoformat(),
            )
        )
    for order in restaurant_orders:
        history.append(
            TreasuryTransactionResponse(
                source="restaurant",
                order_id=order.id,
                payment_mode=order.payment_mode,
                amount=order.total_amount,
                encrypted_transaction_code=order.transaction_code,
                decrypted_transaction_code=_safe_decrypt_code(order.transaction_code),
                created_at=order.created_at.isoformat(),
            )
        )
    history.sort(key=lambda row: row.created_at, reverse=True)
    return history[:limit]


@router.post("/transfer", response_model=TransferResponse)
def create_fund_transfer(
    payload: TransferRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> TransferResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    wallet = get_wallet_summary(request, db, admin_user)
    available = wallet.total_all - wallet.amazer_commission_total - wallet.service_fee_total
    if payload.amount > available:
        raise ValidationDomainError("Transfer amount exceeds available balance")
    snapshot = json.dumps(
        {
            "wallet": wallet.model_dump(),
            "requested_transfer": payload.amount,
            "bank_name": payload.bank_name,
            "ts": datetime.now(UTC).isoformat(),
        }
    )
    transfer = FinanceTransfer(
        bank_name=payload.bank_name,
        amount=payload.amount,
        currency="XOF",
        status="simulated",
        encrypted_snapshot=encrypt_payment_code(snapshot),
    )
    db.add(transfer)
    append_audit_log(
        db,
        event_type="admin_fund_transfer_created",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="finance_transfer",
        entity_id=transfer.id,
        details={"amount": payload.amount, "currency": "XOF", "bank_name": payload.bank_name},
    )
    db.commit()
    db.refresh(transfer)
    return TransferResponse(
        id=transfer.id,
        bank_name=transfer.bank_name,
        amount=transfer.amount,
        currency=transfer.currency,
        status=transfer.status,
        created_at=transfer.created_at.isoformat(),
    )


@router.post("/reset-counters", response_model=CountersResetResponse)
def reset_finance_counters(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> CountersResetResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    settings_row = _get_or_create_settings(db)
    now = datetime.now(UTC)
    settings_row.finance_counters_reset_at = now
    settings_row.ad_click_counters_reset_at = now
    append_audit_log(
        db,
        event_type="admin_finance_counters_reset",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="global_settings",
        entity_id=str(settings_row.id),
        details={"reset_at": now.isoformat()},
    )
    db.commit()
    return CountersResetResponse(
        finance_counters_reset_at=now.isoformat(),
        ad_click_counters_reset_at=now.isoformat(),
    )


@router.get("/public-settings", response_model=FinanceSettingsResponse)
def get_public_finance_settings(
    db: Annotated[Session, Depends(get_db)],
) -> FinanceSettingsResponse:
    settings = _get_or_create_settings(db)
    return _to_response(settings)


@router.get("/contact-info", response_model=PublicContactInfoResponse)
def get_public_contact_info(
    db: Annotated[Session, Depends(get_db)],
) -> PublicContactInfoResponse:
    settings = _get_or_create_settings(db)
    return PublicContactInfoResponse(
        support_email=settings.support_email,
        support_phone=settings.support_phone,
        support_whatsapp=settings.support_whatsapp,
    )


@router.get("/district-fees", response_model=list[DistrictFeeItem])
def list_district_fees(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> list[DistrictFeeItem]:
    _require_finance_pin(request)
    _audit_admin_access(db, request, admin_user, "admin_district_fees_read")
    rows = db.scalars(select(FinanceDistrictFee).order_by(FinanceDistrictFee.district_name.asc())).all()
    return [DistrictFeeItem(district_name=row.district_name, delivery_fee=row.delivery_fee) for row in rows]


@router.put("/district-fees", response_model=list[DistrictFeeItem])
def replace_district_fees(
    payload: list[DistrictFeeItem],
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> list[DistrictFeeItem]:
    enforce_csrf(request)
    _require_finance_pin(request)
    db.query(FinanceDistrictFee).delete()
    for item in payload:
        db.add(FinanceDistrictFee(district_name=item.district_name, delivery_fee=item.delivery_fee))
    append_audit_log(
        db,
        event_type="admin_district_fees_updated",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="district_fee",
        details={"count": len(payload)},
    )
    db.commit()
    rows = db.scalars(select(FinanceDistrictFee).order_by(FinanceDistrictFee.district_name.asc())).all()
    return [DistrictFeeItem(district_name=row.district_name, delivery_fee=row.delivery_fee) for row in rows]


@router.get("/orders", response_model=list[AdminOrderTrackingResponse])
def list_admin_orders(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    limit: int = 40,
) -> list[AdminOrderTrackingResponse]:
    _require_finance_pin(request)
    _audit_admin_access(db, request, admin_user, "admin_orders_read")
    settings_row = _get_or_create_settings(db)
    reset_at = _finance_counters_reset_at(settings_row)
    orders_query = (
        select(Order)
        .options(selectinload(Order.user), selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    if reset_at is not None:
        orders_query = orders_query.where(Order.created_at >= reset_at)
    orders = db.scalars(orders_query.limit(limit)).all()
    has_auto_updates = False
    for order in orders:
        if _auto_finalize_order_without_qr(db, order, request, admin_user):
            has_auto_updates = True
    if has_auto_updates:
        db.commit()
    payload: list[AdminOrderTrackingResponse] = []
    for order in orders:
        payload.append(
            AdminOrderTrackingResponse(
                id=order.id,
                customer_name=order.user.full_name if order.user else "Client AMAZER",
                status=order.status,
                payment_mode=order.payment_mode,
                total_amount=order.total_amount,
                tracking_code=order.tracking_code,
                created_at=order.created_at.isoformat(),
            )
        )
    return payload


@router.post("/orders/{order_id}/dispatch", response_model=AdminOrderTrackingResponse)
def dispatch_order_to_delivery(
    order_id: str,
    payload: AdminOrderStatusUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminOrderTrackingResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    order = db.get(Order, order_id)
    if order is None:
        raise ValidationDomainError("Order not found")
    order.status = payload.status
    if payload.status == "livraison":
        db.add(
            ReceiptScan(
                order_id=order.id,
                vendor_id=None,
                ip_address=request.client.host if request.client else None,
                gps="DISPATCH_MARKER",
                result="pending",
            )
        )
    append_audit_log(
        db,
        event_type="admin_order_status_updated",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="order",
        entity_id=order.id,
        details={"status": payload.status},
    )
    db.commit()
    db.refresh(order)
    return AdminOrderTrackingResponse(
        id=order.id,
        customer_name=order.user.full_name if order.user else "Client AMAZER",
        status=order.status,
        payment_mode=order.payment_mode,
        total_amount=order.total_amount,
        tracking_code=order.tracking_code,
        created_at=order.created_at.isoformat(),
    )


@router.post("/mode-launch", response_model=FinanceSettingsResponse)
def toggle_launch_mode(
    enabled: bool,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> FinanceSettingsResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    settings_row = _get_or_create_settings(db)
    settings_row.launch_mode_zero_commission = enabled
    append_audit_log(
        db,
        event_type="admin_launch_mode_toggled",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="global_settings",
        details={"enabled": enabled},
    )
    db.commit()
    db.refresh(settings_row)
    return _to_response(settings_row)


@router.get("/audit-history", response_model=list[AuditLogResponse])
def list_audit_history(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
    limit: int = 120,
) -> list[AuditLogResponse]:
    _require_finance_pin(request)
    rows = db.scalars(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)).all()
    return [
        AuditLogResponse(
            id=row.id,
            event_type=row.event_type,
            actor_email=row.actor_email,
            ip_address=row.ip_address,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            details=row.details or {},
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


@router.get("/audit-history/export")
def export_audit_history_csv(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
    limit: int = 1000,
) -> StreamingResponse:
    _require_finance_pin(request)
    rows = db.scalars(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["created_at", "event_type", "actor_email", "ip_address", "entity_type", "entity_id", "details"])
    for row in rows:
        writer.writerow(
            [
                row.created_at.isoformat(),
                row.event_type,
                row.actor_email or "",
                row.ip_address or "",
                row.entity_type or "",
                row.entity_id or "",
                json.dumps(row.details or {}, ensure_ascii=True),
            ]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=amazer_audit_history.csv"},
    )


@router.get("/users/stats", response_model=AdminUserStatsResponse)
def get_admin_user_stats(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminUserStatsResponse:
    _require_finance_pin(request)
    _audit_admin_access(db, request, admin_user, "admin_users_stats_read")
    now = datetime.now(UTC)
    since_7_days = now - timedelta(days=7)
    since_30_days = now - timedelta(days=30)

    total_users = int(db.scalar(select(func.count(User.id))) or 0)
    active_users = int(db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0)
    inactive_users = max(total_users - active_users, 0)
    seller_accounts = int(db.scalar(select(func.count(SellerProfile.id))) or 0)
    client_only_accounts = max(total_users - seller_accounts, 0)
    admin_accounts = int(
        db.scalar(select(func.count(User.id)).where(func.lower(User.email) == settings.admin_email.lower())) or 0
    )
    new_users_last_7_days = int(db.scalar(select(func.count(User.id)).where(User.created_at >= since_7_days)) or 0)
    new_users_last_30_days = int(db.scalar(select(func.count(User.id)).where(User.created_at >= since_30_days)) or 0)

    return AdminUserStatsResponse(
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        seller_accounts=seller_accounts,
        client_only_accounts=client_only_accounts,
        admin_accounts=admin_accounts,
        new_users_last_7_days=new_users_last_7_days,
        new_users_last_30_days=new_users_last_30_days,
    )


@router.get("/users", response_model=list[AdminUserResponse])
def list_users_admin(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    limit: int = 200,
    query: str | None = None,
) -> list[AdminUserResponse]:
    _require_finance_pin(request)
    _audit_admin_access(db, request, admin_user, "admin_users_read")
    safe_limit = min(max(limit, 1), 500)
    stmt = select(User).order_by(desc(User.created_at)).limit(safe_limit)
    if query:
        needle = query.strip().lower()
        if needle:
            stmt = stmt.where(
                or_(
                    func.lower(User.email).contains(needle),
                    func.lower(User.full_name).contains(needle),
                )
            )
    users = db.scalars(stmt).all()
    user_ids = {row.id for row in users}
    seller_user_ids = set(
        db.scalars(select(SellerProfile.user_id).where(SellerProfile.user_id.in_(user_ids))).all()
    ) if user_ids else set()
    return [_build_admin_user_response(user, seller_user_ids) for user in users]


@router.delete("/users/{user_id}", status_code=204)
def deactivate_user_admin(
    user_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> None:
    enforce_csrf(request)
    _require_finance_pin(request)
    target = db.get(User, user_id)
    if target is None:
        return
    if _is_admin_email(target.email):
        raise ValidationDomainError("Admin account cannot be removed")
    target.is_active = False
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == target.id))
    if profile is not None:
        vendor = db.get(Vendor, profile.vendor_id)
        if vendor is not None:
            vendor.is_active = False
            db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=False))
    append_audit_log(
        db,
        event_type="admin_user_deactivated",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="user",
        entity_id=target.id,
        details={"email": target.email},
    )
    db.commit()
    _invalidate_public_marketplace_cache()


@router.post("/users/{user_id}/restore", response_model=AdminUserResponse)
def restore_user_admin(
    user_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminUserResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    target = db.get(User, user_id)
    if target is None:
        raise ValidationDomainError("User not found")
    target.is_active = True
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == target.id))
    if profile is not None:
        vendor = db.get(Vendor, profile.vendor_id)
        if vendor is not None:
            vendor.is_active = True
            db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=True))
    append_audit_log(
        db,
        event_type="admin_user_restored",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="user",
        entity_id=target.id,
        details={"email": target.email},
    )
    db.commit()
    db.refresh(target)
    _invalidate_public_marketplace_cache()
    seller_user_ids = {profile.user_id} if profile is not None else set()
    return _build_admin_user_response(target, seller_user_ids)


@router.get("/sellers", response_model=list[AdminSellerResponse])
def list_sellers_admin(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> list[AdminSellerResponse]:
    _require_finance_pin(request)
    settings_row = _get_or_create_settings(db)
    # Exclure les vendeurs definitivement supprimes (email anonymise). Garder les desactives (restaurables)
    # et les vendeurs WhatsApp sans email (email NULL).
    rows = db.scalars(
        select(SellerProfile)
        .join(User, User.id == SellerProfile.user_id)
        .where(
            or_(
                User.email.is_(None),
                User.email.notlike("%@users.deleted.amazer.ne"),
            )
        )
        .order_by(desc(SellerProfile.created_at))
        .limit(500)
    ).all()
    vendor_ids = {row.vendor_id for row in rows}
    vendors = db.scalars(select(Vendor).where(Vendor.id.in_(vendor_ids))).all() if vendor_ids else []
    vendor_map = {vendor.id: vendor for vendor in vendors}
    payload: list[AdminSellerResponse] = []
    for row in rows:
        payload.append(_build_admin_seller_response(row, vendor_map.get(row.vendor_id), settings_row))
    return payload


@router.delete("/sellers/{profile_id}", status_code=204)
def disable_seller(
    profile_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> None:
    enforce_csrf(request)
    _require_finance_pin(request)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Seller profile not found")
    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None:
        vendor.is_active = False
        db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=False))
    user = db.get(User, profile.user_id)
    if user is not None:
        user.is_active = False
    append_audit_log(
        db,
        event_type="admin_seller_disabled",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={"vendor_id": profile.vendor_id, "user_id": profile.user_id},
    )
    db.commit()
    _invalidate_public_marketplace_cache()


@router.post("/sellers/{profile_id}/permanent-delete", status_code=204)
def permanently_delete_seller(
    profile_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> None:
    """Suppression definitive: anonymise le compte et libere l'email (meme methode que la
    suppression de compte cote utilisateur). Preserve l'historique des commandes."""
    enforce_csrf(request)
    _require_finance_pin(request)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")
    user = db.get(User, profile.user_id)
    if user is not None and user.email and user.email.lower() == settings.admin_email.lower():
        raise ValidationDomainError("Le compte administrateur ne peut pas etre supprime.")

    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None:
        vendor.is_active = False
        db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=False))

    # Anonymiser le profil vendeur
    profile.phone = None
    profile.address = None
    profile.description = "Compte vendeur supprime"
    profile.whatsapp_contact = None
    profile.contact_email = None
    profile.is_verified = False

    # Anonymiser l'utilisateur et liberer l'email/telephone pour reutilisation
    if user is not None:
        marker = f"deleted-{user.id[:8]}-{uuid.uuid4().hex[:10]}"
        user.email = f"{marker}@users.deleted.amazer.ne"
        user.full_name = "Compte supprime"
        user.whatsapp_phone = None
        user.hashed_password = hash_password(secrets.token_urlsafe(32))
        user.is_active = False

    append_audit_log(
        db,
        event_type="admin_seller_permanently_deleted",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={"vendor_id": profile.vendor_id, "user_id": profile.user_id},
    )
    db.commit()
    _invalidate_public_marketplace_cache()


@router.post("/sellers/{profile_id}/restore", response_model=AdminSellerResponse)
def restore_seller(
    profile_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminSellerResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Seller profile not found")
    now = datetime.now(UTC)
    # S'assurer que l'abonnement est valide pour que _has_active_subscription() retourne True
    if profile.onboarding_fee_paid_at is None:
        profile.onboarding_fee_paid_at = now
    if profile.subscription_paid_until is None or profile.subscription_paid_until <= now:
        profile.subscription_paid_until = now + timedelta(days=30)
    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None:
        vendor.is_active = True
        db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=True))
    user = db.get(User, profile.user_id)
    if user is not None:
        user.is_active = True
    append_audit_log(
        db,
        event_type="admin_seller_restored",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={"vendor_id": profile.vendor_id, "user_id": profile.user_id},
    )
    db.commit()
    db.refresh(profile)
    _invalidate_public_marketplace_cache()
    vendor = db.get(Vendor, profile.vendor_id)
    return _build_admin_seller_response(profile, vendor, _get_or_create_settings(db))


@router.post("/sellers/{profile_id}/grant-subscription", response_model=AdminSellerResponse)
def grant_seller_subscription(
    profile_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    months: Annotated[int, Query(ge=1, le=24)] = 1,
) -> AdminSellerResponse:
    """Active manuellement l'abonnement d'un vendeur sans paiement."""
    enforce_csrf(request)
    _require_finance_pin(request)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")
    now = datetime.now(UTC)
    if profile.onboarding_fee_paid_at is None:
        profile.onboarding_fee_paid_at = now
    start_from = profile.subscription_paid_until if profile.subscription_paid_until and profile.subscription_paid_until > now else now
    profile.subscription_paid_until = start_from + timedelta(days=30 * months)
    profile.subscription_last_payment_reference = f"ADMIN::GRANT::{admin_user.id}"[:180]
    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None:
        vendor.is_active = True
        db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=True))
    user = db.get(User, profile.user_id)
    if user is not None:
        user.is_active = True
    append_audit_log(
        db,
        event_type="admin_seller_subscription_granted",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={"months": months, "subscription_paid_until": profile.subscription_paid_until.isoformat()},
    )
    db.commit()
    db.refresh(profile)
    _invalidate_public_marketplace_cache()
    vendor = db.get(Vendor, profile.vendor_id)
    return _build_admin_seller_response(profile, vendor, _get_or_create_settings(db))


@router.post("/sellers/{profile_id}/verify", response_model=AdminSellerResponse)
def verify_seller(
    profile_id: str,
    verified: bool,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminSellerResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Seller profile not found")
    profile.is_verified = verified
    append_audit_log(
        db,
        event_type="admin_seller_verification_updated",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={"verified": verified},
    )
    db.commit()
    db.refresh(profile)
    _invalidate_public_marketplace_cache()
    vendor = db.get(Vendor, profile.vendor_id)
    return _build_admin_seller_response(profile, vendor, _get_or_create_settings(db))


@router.put("/sellers/{profile_id}/pricing", response_model=AdminSellerResponse)
def update_seller_pricing(
    profile_id: str,
    payload: AdminSellerPricingUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminSellerResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Seller profile not found")

    profile.commission_rate_override = payload.commission_rate_override
    profile.service_fee_override = payload.service_fee_override
    profile.seller_subscription_fee_override = payload.seller_subscription_fee_override
    append_audit_log(
        db,
        event_type="admin_seller_pricing_updated",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details=payload.model_dump(),
    )
    db.commit()
    db.refresh(profile)
    vendor = db.get(Vendor, profile.vendor_id)
    return _build_admin_seller_response(profile, vendor, _get_or_create_settings(db))


@router.put("/sellers/{profile_id}/type", response_model=AdminSellerResponse)
def update_seller_type(
    profile_id: str,
    payload: AdminSellerTypeUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminSellerResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")
    profile.activity_type = payload.activity_type
    profile.storefront_tier = payload.storefront_tier
    append_audit_log(
        db,
        event_type="admin_seller_type_updated",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details=payload.model_dump(),
    )
    db.commit()
    db.refresh(profile)
    _invalidate_public_marketplace_cache()
    vendor = db.get(Vendor, profile.vendor_id)
    return _build_admin_seller_response(profile, vendor, _get_or_create_settings(db))


@router.post("/sellers/{profile_id}/transport", response_model=AdminSellerResponse)
def set_seller_transport(
    profile_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    enabled: Annotated[bool, Query()] = True,
) -> AdminSellerResponse:
    """Marque une entreprise comme societe de transport (reservation de trajets)."""
    enforce_csrf(request)
    _require_finance_pin(request)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")
    profile.offers_transport = bool(enabled)
    if enabled:
        # Le transport est une entreprise : on s'assure du niveau Premium Entreprise + reservations.
        profile.is_enterprise = True
        profile.storefront_tier = "premium"
        if profile.activity_type not in ("enterprise", "hotel"):
            profile.activity_type = "enterprise"
        profile.accepts_hotel_bookings = True
    append_audit_log(
        db,
        event_type="admin_seller_transport_set",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={"enabled": bool(enabled)},
    )
    db.commit()
    db.refresh(profile)
    _invalidate_public_marketplace_cache()
    vendor = db.get(Vendor, profile.vendor_id)
    return _build_admin_seller_response(profile, vendor, _get_or_create_settings(db))


@router.post("/sellers/{profile_id}/enterprise", response_model=AdminSellerResponse)
def set_seller_enterprise(
    profile_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    enabled: Annotated[bool, Query()] = True,
) -> AdminSellerResponse:
    """Active/desactive le niveau Premium Entreprise (sur devis). Un seul switch debloque
    import, export, reservations (chambres/tables/transport) et calendrier."""
    enforce_csrf(request)
    _require_finance_pin(request)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")
    profile.is_enterprise = bool(enabled)
    if enabled:
        # Premium Entreprise = tier premium + activite enterprise + reservations debloquees.
        profile.storefront_tier = "premium"
        if profile.activity_type not in ("restaurant", "enterprise", "hotel", "transport"):
            profile.activity_type = "enterprise"
        profile.accepts_table_reservations = True
        profile.accepts_hotel_bookings = True
    append_audit_log(
        db,
        event_type="admin_seller_enterprise_set",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={"enabled": bool(enabled)},
    )
    db.commit()
    db.refresh(profile)
    _invalidate_public_marketplace_cache()
    vendor = db.get(Vendor, profile.vendor_id)
    return _build_admin_seller_response(profile, vendor, _get_or_create_settings(db))


@router.get(
    "/seller-subscription-payments",
    response_model=list[AdminSellerSubscriptionPaymentRequestResponse],
)
def list_seller_subscription_payment_requests(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    status: str = "pending",
    limit: int = 100,
) -> list[AdminSellerSubscriptionPaymentRequestResponse]:
    _require_finance_pin(request)
    _audit_admin_access(db, request, admin_user, "admin_seller_subscription_payments_read")
    safe_limit = min(max(limit, 1), 500)
    stmt = select(SellerSubscriptionPayment).order_by(desc(SellerSubscriptionPayment.created_at)).limit(safe_limit)
    if status in {"pending", "approved", "rejected"}:
        stmt = stmt.where(SellerSubscriptionPayment.status == status)
    rows = db.scalars(stmt).all()
    profile_ids = {row.seller_profile_id for row in rows}
    user_ids = {row.seller_user_id for row in rows}
    profiles = (
        db.scalars(select(SellerProfile).where(SellerProfile.id.in_(profile_ids))).all() if profile_ids else []
    )
    users = db.scalars(select(User).where(User.id.in_(user_ids))).all() if user_ids else []
    profile_map = {row.id: row for row in profiles}
    user_map = {row.id: row for row in users}
    return [
        _build_admin_subscription_payment_response(row, profile_map.get(row.seller_profile_id), user_map.get(row.seller_user_id))
        for row in rows
    ]


@router.post(
    "/seller-subscription-payments/{payment_id}/decision",
    response_model=AdminSellerSubscriptionPaymentRequestResponse,
)
def decide_seller_subscription_payment(
    payment_id: str,
    payload: AdminSellerSubscriptionPaymentDecisionRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminSellerSubscriptionPaymentRequestResponse:
    enforce_csrf(request)
    _require_finance_pin(request)
    row = db.get(SellerSubscriptionPayment, payment_id)
    if row is None:
        raise ValidationDomainError("Demande de paiement introuvable")
    if row.status != "pending":
        raise ValidationDomainError("Cette demande a deja ete traitee")
    if payload.decision == "rejected" and not (payload.admin_note or "").strip():
        raise ValidationDomainError("Motif obligatoire: ajoutez une note admin pour rejeter cette demande")
    profile = db.get(SellerProfile, row.seller_profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")

    now = datetime.now(UTC)
    row.status = payload.decision
    row.admin_note = payload.admin_note
    row.reviewed_at = now
    row.reviewed_by_user_id = admin_user.id

    if payload.decision == "approved":
        if profile.onboarding_fee_paid_at is None:
            profile.onboarding_fee_paid_at = now
        start_from = profile.subscription_paid_until if profile.subscription_paid_until and profile.subscription_paid_until > now else now
        profile.subscription_paid_until = start_from + timedelta(days=30 * max(1, row.months))
        profile.subscription_last_payment_reference = f"{row.payment_mode.upper()}::{row.transaction_reference}"[:180]
        vendor = db.get(Vendor, profile.vendor_id)
        if vendor is not None:
            vendor.is_active = True
            # Activer aussi tous les prix du vendeur pour qu ils apparaissent dans le catalogue.
            db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=True))
    seller_user = db.get(User, row.seller_user_id)

    append_audit_log(
        db,
        event_type="admin_seller_subscription_payment_decision",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_subscription_payment",
        entity_id=row.id,
        details={
            "decision": payload.decision,
            "months": row.months,
            "seller_profile_id": row.seller_profile_id,
            "seller_user_id": row.seller_user_id,
            "admin_note": payload.admin_note,
        },
    )
    if seller_user is not None:
        decision_label = "accepte" if payload.decision == "approved" else "refuse"
        next_step = (
            "Votre boutique peut maintenant publier et recevoir des commandes."
            if payload.decision == "approved"
            else "Verifiez le numero de versement, l'operateur choisi et votre reference avant un nouvel envoi."
        )
        body_suffix = (
            f" Motif admin: {payload.admin_note.strip()}." if (payload.admin_note or "").strip() else ""
        )
        NotificationService(db).send_to_user(
            user_id=seller_user.id,
            payload=NotificationPayload(
                title="Paiement vendeur accepte" if payload.decision == "approved" else "Paiement vendeur refuse",
                body=(
                    f"Votre paiement {row.payment_mode.upper()} de {row.months} mois a ete {decision_label}."
                    f" Reference: {row.transaction_reference}. {next_step}{body_suffix}"
                ),
                data={
                    "tag": f"seller-payment-decision-{row.id}",
                    "href": "/seller",
                    "kind": "seller_payment_decision",
                    "decision": payload.decision,
                },
            ),
        )
    db.commit()
    db.refresh(row)
    if payload.decision == "approved":
        _invalidate_public_marketplace_cache()
    return _build_admin_subscription_payment_response(row, profile, seller_user)


# ---------------------------------------------------------------------------
# Inscriptions vendeur en attente (pre-registrations)
# ---------------------------------------------------------------------------

@router.get("/seller-pre-registrations", response_model=list[AdminPendingSellerResponse])
def list_seller_pre_registrations(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    status_filter: str = "pending",
) -> list[AdminPendingSellerResponse]:
    _require_finance_pin(request)
    rows = db.scalars(
        select(SellerPendingRegistration)
        .where(SellerPendingRegistration.status == status_filter)
        .order_by(SellerPendingRegistration.submitted_at.desc())
        .limit(200)
    ).all()
    return [
        AdminPendingSellerResponse(
            id=r.id,
            full_name=r.full_name,
            identifier=r.identifier,
            business_name=r.business_name,
            activity_type=r.activity_type,
            storefront_tier=r.storefront_tier,
            payment_mode=r.payment_mode,
            months=r.months,
            transaction_reference=r.transaction_reference,
            status=r.status,
            admin_note=r.admin_note,
            submitted_at=r.submitted_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/seller-pre-registrations/{reg_id}/decide", response_model=AdminPendingSellerResponse)
def decide_seller_pre_registration(
    reg_id: str,
    payload: AdminPendingSellerDecisionRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminPendingSellerResponse:
    """Approuver (cree le compte + boutique) ou rejeter une inscription vendeur en attente."""
    enforce_csrf(request)
    _require_finance_pin(request)
    reg = db.get(SellerPendingRegistration, reg_id)
    if reg is None:
        raise ValidationDomainError("Inscription introuvable")
    if reg.status != "pending":
        raise ValidationDomainError("Cette inscription a deja ete traitee")

    now = datetime.now(UTC)
    reg.status = payload.decision
    reg.admin_note = payload.admin_note
    reg.reviewed_at = now
    reg.reviewed_by_user_id = admin_user.id

    if payload.decision == "approved":
        import uuid as _uuid
        from app.models.vendor import Vendor as _Vendor
        from app.models.seller_profile import SellerProfile as _SP
        from app.repositories.user_repository import UserRepository

        identifier = reg.identifier.strip().lower()
        is_email = "@" in identifier
        existing_user = (
            UserRepository(db).get_by_email(identifier)
            if is_email
            else UserRepository(db).get_by_whatsapp_phone(identifier)
        )
        # 1) Compte: reutiliser s'il existe deja (ancien acheteur, ou demande deja
        #    partiellement traitee), sinon le creer. Evite tout doublon/erreur.
        if existing_user is not None:
            user = existing_user
            user.is_active = True
            if reg.full_name and reg.full_name.strip():
                user.full_name = reg.full_name.strip()
            user.hashed_password = reg.hashed_password
            db.flush()
            if db.scalar(select(UserPreferences).where(UserPreferences.user_id == user.id)) is None:
                db.add(UserPreferences(user_id=user.id, preferred_currency="XOF"))
        else:
            user = User(
                id=str(_uuid.uuid4()),
                email=identifier if is_email else None,
                whatsapp_phone=identifier if not is_email else None,
                full_name=reg.full_name.strip(),
                hashed_password=reg.hashed_password,
                is_active=True,
            )
            db.add(user)
            db.flush()
            db.add(UserPreferences(user_id=user.id, preferred_currency="XOF"))

        # 2) Boutique: reutiliser celle du compte si elle existe (reactivation +
        #    prolongation de l'abonnement), sinon la creer. La confirmation reussit
        #    TOUJOURS, qu'il s'agisse d'un nouveau compte ou d'un compte deja vendeur.
        from app.services.seller_profile_service import build_unique_vendor_slug
        subscription_end = now + timedelta(days=30 * reg.months)
        profile = db.scalar(select(_SP).where(_SP.user_id == user.id))
        if profile is None:
            vendor = _Vendor(
                id=str(_uuid.uuid4()),
                name=reg.business_name or reg.full_name,
                slug=build_unique_vendor_slug(db, reg.business_name or reg.full_name, user.id),
                is_active=True,
            )
            db.add(vendor)
            db.flush()
            profile = _SP(
                id=str(_uuid.uuid4()),
                user_id=user.id,
                vendor_id=vendor.id,
                business_name=reg.business_name or reg.full_name,
                activity_type=reg.activity_type,
                storefront_tier=reg.storefront_tier,
                city="Niamey",
                onboarding_fee_paid_at=now,
                subscription_paid_until=subscription_end,
                subscription_last_payment_reference=(reg.transaction_reference or f"ADMIN::PRE-REG::{reg.id}")[:180],
            )
            db.add(profile)
            db.flush()
        else:
            vendor = db.get(_Vendor, profile.vendor_id)
            if vendor is not None:
                vendor.is_active = True
                db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=True))
            if reg.business_name:
                profile.business_name = reg.business_name
            if reg.activity_type:
                profile.activity_type = reg.activity_type
            if reg.storefront_tier:
                profile.storefront_tier = reg.storefront_tier
            profile.onboarding_fee_paid_at = profile.onboarding_fee_paid_at or now
            start_from = (
                profile.subscription_paid_until
                if profile.subscription_paid_until and profile.subscription_paid_until > now
                else now
            )
            profile.subscription_paid_until = start_from + timedelta(days=30 * reg.months)
            profile.subscription_last_payment_reference = (
                reg.transaction_reference or f"ADMIN::PRE-REG::{reg.id}"
            )[:180]
            db.flush()

        # Creer l enregistrement de paiement approuve
        from app.models.seller_subscription_payment import SellerSubscriptionPayment as _SSP
        settings_obj = _get_or_create_settings(db)
        monthly_fee = (
            settings_obj.seller_subscription_fee_premium if reg.storefront_tier == "premium"
            else settings_obj.seller_subscription_fee_restaurant if reg.activity_type == "restaurant"
            else settings_obj.seller_subscription_fee_shop
        )
        payment = _SSP(
            id=str(_uuid.uuid4()),
            seller_profile_id=profile.id,
            seller_user_id=user.id,
            payment_mode=reg.payment_mode or "nita",
            transaction_reference=reg.transaction_reference or f"PRE-REG::{reg.id}"[:180],
            months=reg.months,
            amount_claimed=monthly_fee * reg.months,
            status="approved",
            reviewed_by_user_id=admin_user.id,
            reviewed_at=now,
        )
        db.add(payment)

        append_audit_log(
            db,
            event_type="admin_pre_registration_approved",
            actor=admin_user,
            ip_address=request.client.host if request.client else None,
            path=str(request.url.path),
            entity_type="seller_pending_registration",
            entity_id=reg.id,
            details={"full_name": reg.full_name, "identifier": reg.identifier, "months": reg.months},
        )

        # Prevenir le vendeur que sa boutique est active (notification in-app, visible
        # des sa connexion). N'echoue jamais l'approbation si la notif ne part pas.
        try:
            from app.services.notification_service import NotificationPayload, NotificationService

            shop_label = reg.business_name or reg.full_name
            NotificationService(db).send_to_user(
                user_id=user.id,
                payload=NotificationPayload(
                    title="Votre boutique est active !",
                    body=(
                        f"Felicitations ! Votre compte vendeur \"{shop_label}\" a ete valide. "
                        "Connectez-vous pour gerer votre boutique et votre abonnement."
                    ),
                    data={
                        "tag": f"seller-approved-{reg.id}",
                        "href": "/seller/dashboard",
                        "kind": "seller_approved",
                    },
                ),
            )
        except Exception:
            logging.getLogger(__name__).warning(
                "Notification d'activation vendeur non envoyee pour %s", reg.identifier
            )

        _invalidate_public_marketplace_cache()
    else:
        append_audit_log(
            db,
            event_type="admin_pre_registration_rejected",
            actor=admin_user,
            ip_address=request.client.host if request.client else None,
            path=str(request.url.path),
            entity_type="seller_pending_registration",
            entity_id=reg.id,
            details={"full_name": reg.full_name, "identifier": reg.identifier},
        )

    db.commit()
    db.refresh(reg)
    return AdminPendingSellerResponse(
        id=reg.id,
        full_name=reg.full_name,
        identifier=reg.identifier,
        business_name=reg.business_name,
        activity_type=reg.activity_type,
        storefront_tier=reg.storefront_tier,
        payment_mode=reg.payment_mode,
        months=reg.months,
        transaction_reference=reg.transaction_reference,
        status=reg.status,
        admin_note=reg.admin_note,
        submitted_at=reg.submitted_at.isoformat(),
    )
