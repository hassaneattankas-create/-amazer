import time
import hmac
import hashlib
from datetime import UTC, date, datetime, timedelta
import csv
import io
import json
import logging
import re
import secrets
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.core.phone import normalize_phone
from app.core.permissions import is_admin, is_principal_admin
from app.core.cache import cache_delete_prefixes
from app.core.crypto import decrypt_payment_code, decrypt_phone_value, encrypt_payment_code
from app.core.csrf import enforce_csrf
from pydantic import BaseModel, Field
from app.core.deps import get_admin_user
from app.core.exceptions import UnauthorizedError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.finance import FinanceDistrictFee
from app.models.finance import FinanceTransfer
from app.models.global_settings import GlobalSettings
from app.models.order import Order, OrderItem
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
    AdminBroadcastRequest,
    AdminBroadcastResponse,
    AdminPendingSellerDecisionRequest,
    AdminPendingSellerResponse,
    AdminSellerResponse,
    AdminSellerSubscriptionPaymentDecisionRequest,
    AdminSellerSubscriptionPaymentRequestResponse,
    AdminSellerPricingUpdateRequest,
    AdminSellerTypeUpdateRequest,
    AdminUserResponse,
    AdminUserRoleUpdateRequest,
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
from app.services import order_event_notifications as order_events
from app.routes.resellers import compute_earnings as compute_reseller_earnings
from app.models.reseller import ResellerAccount, ResellerListing, ResellerPayout, ResellerSubscriptionPayment
from app.models.refund import Refund
from app.models.affiliate import AffiliateAccount, AffiliateEarning, AffiliatePayout, AffiliateReferral
from app.routes.affiliates import compute_affiliate_earnings
from app.services.order_delivery_service import mark_order_delivered
from app.services.refund_service import record_refund, settle_refund
from app.services.affiliate_service import (
    PayoutError,
    add_manual_bonus,
    cancel_unpaid,
    credit_subscription_share,
    decide_earning,
    ensure_affiliate_account,
    mature_earnings,
    settle_payout,
)
from app.services.reseller_account_service import ensure_account as ensure_reseller_account
from app.services.reseller_account_service import extend_subscription as extend_reseller_subscription
from app.services.reseller_account_service import reseller_terms
from app.services.vendor_visibility import reactivate_vendor_listings
from app.services.audit_log_service import append_audit_log
from app.services.order_cancellation_service import cancel_order, ensure_not_cancelled, notify_order_cancelled
from app.services.order_fulfillment_service import sync_fulfillments
from app.services.notification_service import NotificationPayload, NotificationService
from app.services.local_services import parse_cities
from app.services.seller_finance_service import (
    auto_receipt_hours,
    build_effective_seller_finance_settings,
    get_or_create_global_settings,
)

router = APIRouter(prefix="/admin/finance", tags=["admin-finance"])
settings = get_settings()


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
        seller_trial_days=int(getattr(settings, "seller_trial_days", 0) or 0),
        seller_launch_discount_percent=float(getattr(settings, "seller_launch_discount_percent", 0) or 0),
        reseller_subscription_fee=float(getattr(settings, "reseller_subscription_fee", 500) or 0),
        reseller_commission_percent=float(getattr(settings, "reseller_commission_percent", 10) or 0),
        affiliate_seller_share_percent=float(getattr(settings, "affiliate_seller_share_percent", 20) or 0),
        affiliate_seller_share_months=int(getattr(settings, "affiliate_seller_share_months", 12) or 12),
        affiliate_customer_bonus=float(getattr(settings, "affiliate_customer_bonus", 250) or 0),
        affiliate_hold_days=int(getattr(settings, "affiliate_hold_days", 30) if getattr(settings, "affiliate_hold_days", None) is not None else 30),
        auto_receipt_hours=int(getattr(settings, "auto_receipt_hours", 72) if getattr(settings, "auto_receipt_hours", None) is not None else 72),
        affiliate_min_payout=float(getattr(settings, "affiliate_min_payout", 2000) if getattr(settings, "affiliate_min_payout", None) is not None else 2000),
        affiliate_new_account_monthly_cap=float(getattr(settings, "affiliate_new_account_monthly_cap", 25000) if getattr(settings, "affiliate_new_account_monthly_cap", None) is not None else 25000),
        affiliate_max_referrals_per_day=int(getattr(settings, "affiliate_max_referrals_per_day", 15) if getattr(settings, "affiliate_max_referrals_per_day", None) is not None else 15),
        ambassador_first_month_percent=float(getattr(settings, "ambassador_first_month_percent", 50) if getattr(settings, "ambassador_first_month_percent", None) is not None else 50),
        ambassador_tier2_shops=int(getattr(settings, "ambassador_tier2_shops", 10) if getattr(settings, "ambassador_tier2_shops", None) is not None else 10),
        ambassador_tier2_percent=float(getattr(settings, "ambassador_tier2_percent", 25) if getattr(settings, "ambassador_tier2_percent", None) is not None else 25),
        ambassador_tier3_shops=int(getattr(settings, "ambassador_tier3_shops", 25) if getattr(settings, "ambassador_tier3_shops", None) is not None else 25),
        ambassador_tier3_percent=float(getattr(settings, "ambassador_tier3_percent", 30) if getattr(settings, "ambassador_tier3_percent", None) is not None else 30),
        ambassador_monthly_top_bonus=float(getattr(settings, "ambassador_monthly_top_bonus", 10000) if getattr(settings, "ambassador_monthly_top_bonus", None) is not None else 10000),
        pharmacy_delivery_phone=getattr(settings, "pharmacy_delivery_phone", None),
        fuel_delivery_phone=getattr(settings, "fuel_delivery_phone", None),
        local_delivery_cities=getattr(settings, "local_delivery_cities", None) or "Niamey",
        **{
            key: getattr(settings, key) if getattr(settings, key, None) is not None else default
            for key, default in (
                ("fuel_included_outlets", 3),
                ("fuel_tier1_price", 2000),
                ("fuel_tier2_price", 1500),
                ("fuel_tier3_price", 1000),
                ("fuel_network_flat", 50000),
                ("fuel_base_subscription", 0),
                ("fuel_tier1_until", 10),
                ("fuel_tier2_until", 30),
            )
        },
        support_email=settings.support_email,
        support_phone=settings.support_phone,
        support_whatsapp=settings.support_whatsapp,
    )


FINANCE_PIN_TTL_SECONDS = 30 * 60


def _finance_pin_signature(user_id: str, expires_at: int) -> str:
    key = settings.jwt_secret_key.encode()
    return hmac.new(key, f"finance-pin:{user_id}:{expires_at}".encode(), hashlib.sha256).hexdigest()[:48]


def issue_finance_pin_token(user_id: str, now: int | None = None) -> str:
    """Jeton signe « PIN finance verifie » : lie a l'admin, expire apres 30 minutes, infalsifiable sans le secret."""
    expires_at = int(now if now is not None else time.time()) + FINANCE_PIN_TTL_SECONDS
    return f"{user_id}.{expires_at}.{_finance_pin_signature(user_id, expires_at)}"


def finance_pin_token_valid(token: str | None, user_id: str | None, now: int | None = None) -> bool:
    parts = (token or "").rsplit(".", 2)
    if len(parts) != 3 or not parts[1].isdigit():
        return False
    token_user, expires_at, signature = parts[0], int(parts[1]), parts[2]
    if not hmac.compare_digest(signature, _finance_pin_signature(token_user, expires_at)):
        return False
    if expires_at < int(now if now is not None else time.time()):
        return False
    return user_id is None or hmac.compare_digest(token_user, user_id)


def _require_finance_pin(request: Request, admin_user: User | None = None) -> None:
    if not finance_pin_token_valid(request.cookies.get("finance_pin_verified"), admin_user.id if admin_user else None):
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
        service_kind=getattr(profile, "service_kind", None),
        email=getattr(getattr(profile, "user", None), "email", None),
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


def _build_admin_user_response(user: User, seller_user_ids: set[str]) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        whatsapp_phone=user.whatsapp_phone,
        is_active=bool(user.is_active),
        is_admin=is_admin(user),
        is_seller=user.id in seller_user_ids,
        role=getattr(user, "role", "user") or "user",
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
    timeout_hours = auto_receipt_hours(db)
    if elapsed < timedelta(hours=timeout_hours):
        return False

    mark_order_delivered(db, order, source="auto")
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
            "timeout_hours": timeout_hours,
        },
    )
    return True


class FinancePinTokenResponse(BaseModel):
    token: str
    expires_in: int


@router.post("/pin/verify", response_model=FinancePinTokenResponse)
def verify_admin_finance_pin(
    payload: PinVerifyRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> FinancePinTokenResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="admin_finance_pin", limit=5, window_seconds=300)
    if not _admin_finance_keys_match(payload.pin, payload.birth_date):
        raise UnauthorizedError("Invalid finance PIN")
    token = issue_finance_pin_token(admin_user.id)
    same_site = "none" if settings.is_production() else "lax"
    response.set_cookie(
        key="finance_pin_verified",
        value=token,
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
    return FinancePinTokenResponse(token=token, expires_in=FINANCE_PIN_TTL_SECONDS)


@router.get("/settings", response_model=FinanceSettingsResponse)
def get_finance_settings(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> FinanceSettingsResponse:
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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
    settings_row.seller_trial_days = payload.seller_trial_days
    settings_row.seller_launch_discount_percent = payload.seller_launch_discount_percent
    settings_row.reseller_subscription_fee = payload.reseller_subscription_fee
    settings_row.reseller_commission_percent = payload.reseller_commission_percent
    settings_row.affiliate_seller_share_percent = payload.affiliate_seller_share_percent
    settings_row.affiliate_seller_share_months = payload.affiliate_seller_share_months
    settings_row.affiliate_customer_bonus = payload.affiliate_customer_bonus
    settings_row.affiliate_hold_days = payload.affiliate_hold_days
    settings_row.auto_receipt_hours = payload.auto_receipt_hours
    settings_row.affiliate_min_payout = payload.affiliate_min_payout
    settings_row.affiliate_new_account_monthly_cap = payload.affiliate_new_account_monthly_cap
    settings_row.affiliate_max_referrals_per_day = payload.affiliate_max_referrals_per_day
    settings_row.ambassador_first_month_percent = payload.ambassador_first_month_percent
    settings_row.ambassador_tier2_shops = payload.ambassador_tier2_shops
    settings_row.ambassador_tier2_percent = payload.ambassador_tier2_percent
    settings_row.ambassador_tier3_shops = payload.ambassador_tier3_shops
    settings_row.ambassador_tier3_percent = payload.ambassador_tier3_percent
    settings_row.ambassador_monthly_top_bonus = payload.ambassador_monthly_top_bonus
    settings_row.support_email = payload.support_email
    settings_row.support_phone = payload.support_phone
    settings_row.support_whatsapp = payload.support_whatsapp
    settings_row.pharmacy_delivery_phone = (payload.pharmacy_delivery_phone or "").strip() or None
    settings_row.fuel_delivery_phone = (payload.fuel_delivery_phone or "").strip() or None
    for key in (
        "fuel_included_outlets",
        "fuel_tier1_price",
        "fuel_tier2_price",
        "fuel_tier3_price",
        "fuel_network_flat",
        "fuel_base_subscription",
    ):
        setattr(settings_row, key, getattr(payload, key))
    # Paliers toujours dans l'ordre : inclus <= fin du palier 1 < fin du palier 2.
    tier1_until = max(int(payload.fuel_tier1_until), int(payload.fuel_included_outlets))
    settings_row.fuel_tier1_until = tier1_until
    settings_row.fuel_tier2_until = max(int(payload.fuel_tier2_until), tier1_until + 1)
    settings_row.local_delivery_cities = ", ".join(parse_cities(payload.local_delivery_cities)) or "Niamey"
    cache_delete_prefixes("services:", "catalog:")
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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


@router.get("/public-district-fees", response_model=list[DistrictFeeItem])
def list_public_district_fees(db: Annotated[Session, Depends(get_db)]) -> list[DistrictFeeItem]:
    """Tarifs de livraison par quartier, affiches au client avant la commande."""
    rows = db.scalars(select(FinanceDistrictFee).order_by(FinanceDistrictFee.district_name.asc())).all()
    return [DistrictFeeItem(district_name=row.district_name, delivery_fee=float(row.delivery_fee)) for row in rows]


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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
    _audit_admin_access(db, request, admin_user, "admin_orders_read")
    # Toutes les commandes recentes : la remise a zero des compteurs ne doit jamais masquer
    # une commande a payer ou a livrer.
    orders_query = (
        select(Order)
        .options(selectinload(Order.user), selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    orders = db.scalars(orders_query.limit(max(1, min(limit, 200)))).all()
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
                payment_status=order.payment_status,
                client_reference=_client_reference(order),
                delivery_district=order.delivery_district,
                item_count=sum(int(item.quantity or 0) for item in order.items),
            )
        )
    payload.extend(_restaurant_orders_for_admin(db, limit))
    payload.sort(key=lambda row: row.created_at, reverse=True)
    return payload[: max(1, min(limit, 200))]


def _restaurant_orders_for_admin(db: Session, limit: int) -> list[AdminOrderTrackingResponse]:
    """Commandes restaurant : leurs paiements Nita se valident aussi ici (le restaurant gere la suite)."""
    rows = db.scalars(
        select(RestaurantOrder)
        .options(selectinload(RestaurantOrder.items))
        .order_by(RestaurantOrder.created_at.desc())
        .limit(max(1, min(limit, 200)))
    ).all()
    names = {
        profile.vendor_id: profile.business_name
        for profile in db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_({r.vendor_id for r in rows}))).all()
    } if rows else {}
    return [
        AdminOrderTrackingResponse(
            id=r.id,
            customer_name=r.customer_name or "Client AMAZER",
            status=r.status,
            payment_mode=r.payment_mode,
            total_amount=r.total_amount,
            tracking_code=r.payment_reference,
            created_at=r.created_at.isoformat(),
            payment_status=r.payment_status,
            kind="restaurant",
            place_name=names.get(r.vendor_id),
            client_reference=_client_reference(r),
            item_count=sum(int(item.quantity or 0) for item in r.items),
        )
        for r in rows
    ]


def _client_reference(order: Order) -> str | None:
    """Reference Nita envoyee par le client (dechiffree), seulement tant que le paiement est a valider."""
    if order.payment_status == "paid" or not order.transaction_code:
        return None
    try:
        return decrypt_payment_code(order.transaction_code)
    except Exception:  # noqa: BLE001 - reference illisible : l'admin verifie sur le releve
        return None


@router.post("/orders/{order_id}/dispatch", response_model=AdminOrderTrackingResponse)
def dispatch_order_to_delivery(
    order_id: str,
    payload: AdminOrderStatusUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminOrderTrackingResponse:
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    order = db.get(Order, order_id)
    if order is None:
        raise ValidationDomainError("Order not found")
    ensure_not_cancelled(order)
    if payload.status in ("livraison", "recu", "CLAIMED") and order.payment_status != "paid":
        # Sinon le vendeur serait credite (et l'affilie aussi) pour une commande jamais payee.
        raise ValidationDomainError("Paiement non confirmé : validez d'abord le paiement de cette commande.")
    previous_status = order.status
    if payload.status == "recu":
        mark_order_delivered(db, order, source="admin")
    else:
        order.status = payload.status
        sync_fulfillments(order)
        if payload.status != previous_status:
            order_events.notify_order_status(db, order, payload.status)
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
    _require_finance_pin(request, admin_user)
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


def _not_deleted_user():
    return or_(User.email.is_(None), User.email.notlike("%@users.deleted.amazer.ne"))


def _subscription_running(profile: SellerProfile, now: datetime) -> bool:
    paid_until = profile.subscription_paid_until
    if paid_until is not None and paid_until.tzinfo is None:
        paid_until = paid_until.replace(tzinfo=UTC)
    return profile.onboarding_fee_paid_at is not None and paid_until is not None and paid_until > now


@router.get("/users/stats", response_model=AdminUserStatsResponse)
def get_admin_user_stats(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminUserStatsResponse:
    _require_finance_pin(request, admin_user)
    _audit_admin_access(db, request, admin_user, "admin_users_stats_read")
    now = datetime.now(UTC)
    since_7_days = now - timedelta(days=7)
    since_30_days = now - timedelta(days=30)

    # Les comptes supprimes (anonymises) ne comptent plus : memes chiffres que la liste.
    kept = _not_deleted_user()
    total_users = int(db.scalar(select(func.count(User.id)).where(kept)) or 0)
    active_users = int(db.scalar(select(func.count(User.id)).where(kept, User.is_active.is_(True))) or 0)
    inactive_users = max(total_users - active_users, 0)
    seller_accounts = int(
        db.scalar(
            select(func.count(SellerProfile.id)).join(User, User.id == SellerProfile.user_id).where(kept, User.is_active.is_(True))
        )
        or 0
    )
    client_only_accounts = max(active_users - seller_accounts, 0)
    admin_accounts = int(
        db.scalar(select(func.count(User.id)).where(func.lower(User.email) == settings.admin_email.lower())) or 0
    )
    new_users_last_7_days = int(db.scalar(select(func.count(User.id)).where(kept, User.created_at >= since_7_days)) or 0)
    new_users_last_30_days = int(db.scalar(select(func.count(User.id)).where(kept, User.created_at >= since_30_days)) or 0)

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
    _require_finance_pin(request, admin_user)
    _audit_admin_access(db, request, admin_user, "admin_users_read")
    safe_limit = min(max(limit, 1), 500)
    stmt = (
        select(User)
        .where(User.email.notlike("%@users.deleted.amazer.ne"))
        .order_by(desc(User.created_at))
        .limit(safe_limit)
    )
    if query:
        needle = query.strip().lower()
        if needle:
            digits = needle.replace(" ", "")
            stmt = stmt.where(
                or_(
                    func.lower(User.email).contains(needle),
                    func.lower(User.full_name).contains(needle),
                    func.replace(func.coalesce(User.whatsapp_phone, ""), " ", "").contains(digits),
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
    _require_finance_pin(request, admin_user)
    target = db.get(User, user_id)
    if target is None:
        return
    if is_admin(target):
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


@router.post("/users/{user_id}/permanent-delete", status_code=204)
def permanently_delete_user(
    user_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> None:
    """Suppression definitive d'un utilisateur : compte anonymise, email libere, historique conserve."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    target = db.get(User, user_id)
    if target is None:
        raise ValidationDomainError("Utilisateur introuvable")
    if is_admin(target):
        raise ValidationDomainError("Le compte administrateur ne peut pas être supprimé.")
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == target.id))
    if profile is not None:
        vendor = db.get(Vendor, profile.vendor_id)
        if vendor is not None:
            vendor.is_active = False
            db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=False))
        profile.phone = None
        profile.address = None
        profile.description = "Compte vendeur supprime"
        profile.whatsapp_contact = None
        profile.contact_email = None
        profile.is_verified = False
    old_email = target.email
    marker = f"deleted-{target.id[:8]}-{uuid.uuid4().hex[:10]}"
    target.email = f"{marker}@users.deleted.amazer.ne"
    target.full_name = "Compte supprime"
    target.whatsapp_phone = None
    target.hashed_password = hash_password(secrets.token_urlsafe(32))
    target.is_active = False
    target.role = "user"
    append_audit_log(
        db,
        event_type="admin_user_permanently_deleted",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="user",
        entity_id=target.id,
        details={"email": old_email},
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
    _require_finance_pin(request, admin_user)
    target = db.get(User, user_id)
    if target is None:
        raise ValidationDomainError("User not found")
    target.is_active = True
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == target.id))
    if profile is not None:
        vendor = db.get(Vendor, profile.vendor_id)
        # Abonnement expire : le compte revient, la boutique reste hors ligne jusqu'au paiement.
        if vendor is not None and _subscription_running(profile, datetime.now(UTC)):
            vendor.is_active = True
            reactivate_vendor_listings(db, vendor.id)
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


@router.patch("/users/{user_id}/role", response_model=AdminUserResponse)
def update_user_role_admin(
    user_id: str,
    payload: AdminUserRoleUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminUserResponse:
    """Nomme ou retire un administrateur. Le compte principal (ADMIN_EMAIL) est intouchable."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    target = db.get(User, user_id)
    if target is None:
        raise ValidationDomainError("User not found")
    if is_principal_admin(target):
        raise ValidationDomainError("Le rôle du compte administrateur principal ne peut pas être modifié.")
    if target.id == admin_user.id:
        raise ValidationDomainError("Vous ne pouvez pas modifier votre propre role.")
    if not target.is_active:
        raise ValidationDomainError("Reactivez le compte avant de modifier son role.")
    previous_role = target.role
    target.role = payload.role
    append_audit_log(
        db,
        event_type="admin_user_role_changed",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="user",
        entity_id=target.id,
        details={"email": target.email, "from": previous_role, "to": payload.role},
    )
    db.commit()
    db.refresh(target)
    is_seller = db.scalar(select(SellerProfile.id).where(SellerProfile.user_id == target.id)) is not None
    return _build_admin_user_response(target, {target.id} if is_seller else set())


@router.post("/orders/{order_id}/cancel", response_model=AdminOrderTrackingResponse)
def cancel_order_admin(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminOrderTrackingResponse:
    """Annule une commande non livree ; le stock est remis si elle etait payee."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    order = db.get(Order, order_id)
    if order is None:
        raise ValidationDomainError("Order not found")
    was_paid = order.payment_status == "paid"
    restocked = cancel_order(db, order, by_admin=True)
    if was_paid:
        record_refund(
            db,
            source="order",
            source_id=order.id,
            user_id=order.user_id,
            customer_name=order.user.full_name if order.user else None,
            phone=order.delivery_phone or (order.user.whatsapp_phone if order.user else None),
            method=order.payment_mode,
            amount=float(order.total_amount or 0),
            reason="Commande annulée par AMAZER",
        )
    append_audit_log(
        db,
        event_type="admin_order_cancelled",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="order",
        entity_id=order.id,
        details={
            "was_paid": was_paid,
            "restocked": restocked,
            # Aucun remboursement automatique n'existe : il se fait hors plateforme.
            "refund_to_handle_manually": was_paid,
        },
    )
    db.commit()
    db.refresh(order)
    notify_order_cancelled(db, order, by_admin=True)
    return AdminOrderTrackingResponse(
        id=order.id,
        customer_name=order.user.full_name if order.user else "Client AMAZER",
        status=order.status,
        payment_mode=order.payment_mode,
        total_amount=order.total_amount,
        tracking_code=order.tracking_code,
        created_at=order.created_at.isoformat(),
    )


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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")
    user = db.get(User, profile.user_id)
    if user is not None and is_admin(user):
        raise ValidationDomainError("Le compte administrateur ne peut pas être supprimé.")

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
    _require_finance_pin(request, admin_user)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Seller profile not found")
    # Meme regle que « Restaurer » dans Utilisateurs : pour offrir du temps, utiliser « Offrir 1 mois ».
    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None and _subscription_running(profile, datetime.now(UTC)):
        vendor.is_active = True
        reactivate_vendor_listings(db, vendor.id)
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
    _require_finance_pin(request, admin_user)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")
    owner = db.get(User, profile.user_id)
    if owner is not None and not owner.is_active:
        raise ValidationDomainError("Ce compte est retiré : restaurez-le d'abord dans Utilisateurs.")
    now = datetime.now(UTC)
    if profile.onboarding_fee_paid_at is None:
        profile.onboarding_fee_paid_at = now
    start_from = profile.subscription_paid_until if profile.subscription_paid_until and profile.subscription_paid_until > now else now
    profile.subscription_paid_until = start_from + timedelta(days=30 * months)
    profile.subscription_last_payment_reference = f"ADMIN::GRANT::{admin_user.id}"[:180]
    vendor = db.get(Vendor, profile.vendor_id)
    if vendor is not None:
        vendor.is_active = True
        reactivate_vendor_listings(db, vendor.id)
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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


SELLER_ACTIVITIES = ("shop", "restaurant", "premium", "transport", "pharmacy", "fuel_station")


def apply_seller_activity(profile: SellerProfile, activity: str) -> None:
    """Un seul choix d'activite, applique de facon coherente (les anciennes options sont retirees).

    Boutique et Restaurant : formule de base. Entreprise, Transport, Pharmacie, Station : Premium.
    """
    profile.service_kind = activity if activity in ("pharmacy", "fuel_station") else None
    profile.offers_transport = activity == "transport"
    if activity in ("shop", "restaurant"):
        profile.activity_type = activity
        profile.storefront_tier = "basic"
        profile.is_enterprise = False
        return
    profile.storefront_tier = "premium"
    profile.is_enterprise = True
    if profile.activity_type not in ("enterprise", "hotel"):
        profile.activity_type = "enterprise"
    if activity in ("premium", "transport"):
        # Entreprise / transport : reservations (chambres, trajets, tables) debloquees.
        profile.accepts_hotel_bookings = True
        profile.accepts_table_reservations = profile.accepts_table_reservations or activity == "premium"


@router.post("/sellers/{profile_id}/activity", response_model=AdminSellerResponse)
def set_seller_activity(
    profile_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    activity: Annotated[Literal["shop", "restaurant", "premium", "transport", "pharmacy", "fuel_station"], Query()],
) -> AdminSellerResponse:
    """Choix unique de l'activite d'un vendeur (remplace types, Premium, transport et services separes)."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")
    apply_seller_activity(profile, activity)
    append_audit_log(
        db,
        event_type="admin_seller_activity_set",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={"activity": activity},
    )
    db.commit()
    db.refresh(profile)
    _invalidate_public_marketplace_cache()
    cache_delete_prefixes("services:")
    vendor = db.get(Vendor, profile.vendor_id)
    return _build_admin_seller_response(profile, vendor, _get_or_create_settings(db))


@router.post("/sellers/{profile_id}/service-kind", response_model=AdminSellerResponse)
def set_seller_service_kind(
    profile_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    kind: Annotated[Literal["pharmacy", "fuel_station", "none"], Query()],
) -> AdminSellerResponse:
    """Fait d'une vitrine Premium une pharmacie ou une station-essence (ou la remet en vitrine normale)."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    profile = db.get(SellerProfile, profile_id)
    if profile is None:
        raise ValidationDomainError("Profil vendeur introuvable")
    profile.service_kind = None if kind == "none" else kind
    if kind != "none":
        # Service de proximite = vitrine Premium (reutilise l'abonnement et la vitrine existants).
        profile.storefront_tier = "premium"
        profile.is_enterprise = True
        if profile.activity_type not in ("enterprise", "hotel"):
            profile.activity_type = "enterprise"
    append_audit_log(
        db,
        event_type="admin_seller_service_kind_set",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="seller_profile",
        entity_id=profile.id,
        details={"service_kind": kind},
    )
    db.commit()
    db.refresh(profile)
    _invalidate_public_marketplace_cache()
    cache_delete_prefixes("services:")
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
    row = db.get(SellerSubscriptionPayment, payment_id)
    if row is None:
        raise ValidationDomainError("Demande de paiement introuvable")
    if row.status != "pending":
        raise ValidationDomainError("Cette demande a déjà été traitée.")
    if payload.decision == "rejected" and not (payload.admin_note or "").strip():
        raise ValidationDomainError("Motif obligatoire : ajoutez une note pour refuser cette demande.")
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
            reactivate_vendor_listings(db, vendor.id)
        credit_subscription_share(db, row.seller_user_id, float(row.amount_claimed or 0), f"seller-sub:{row.id}", row.months)
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
            else "Vérifiez le numéro de versement, l'opérateur choisi et votre référence avant un nouvel envoi."
        )
        body_suffix = (
            f" Motif : {payload.admin_note.strip()}." if (payload.admin_note or "").strip() else ""
        )
        NotificationService(db).send_to_user(
            user_id=seller_user.id,
            payload=NotificationPayload(
                title="Paiement d'abonnement accepté" if payload.decision == "approved" else "Paiement d'abonnement refusé",
                body=(
                    f"Votre paiement {row.payment_mode.upper()} de {row.months} mois a été {decision_label}."
                    f" Référence : {row.transaction_reference}. {next_step}{body_suffix}"
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
    _require_finance_pin(request, admin_user)
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
    _require_finance_pin(request, admin_user)
    reg = db.get(SellerPendingRegistration, reg_id)
    if reg is None:
        raise ValidationDomainError("Inscription introuvable")
    if reg.status != "pending":
        raise ValidationDomainError("Cette inscription a déjà été traitée.")

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
        # Identifiant telephone: on canonicalise le numero (+227...) et on genere un
        # email "fantome" (la colonne email est obligatoire). Meme logique que
        # l'inscription classique, sinon l'INSERT plante (email NULL) => 500.
        if is_email:
            email_value: str = identifier
            whatsapp_value: str | None = None
        else:
            _digits = "".join(ch for ch in identifier if ch.isdigit())
            whatsapp_value = normalize_phone(reg.identifier) or f"+{_digits}"
            _wdigits = "".join(ch for ch in whatsapp_value if ch.isdigit())
            email_value = f"wa-{_wdigits}@users.amazer.ne"
        existing_user = (
            UserRepository(db).get_by_email(email_value)
            if is_email
            else UserRepository(db).get_by_whatsapp_phone(whatsapp_value)
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
                email=email_value,
                whatsapp_phone=whatsapp_value,
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
                reactivate_vendor_listings(db, vendor.id)
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


@router.post("/messages", response_model=AdminBroadcastResponse)
def send_admin_message(
    payload: AdminBroadcastRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminBroadcastResponse:
    """Envoie un message de l'equipe : notification sur le site + e-mail automatique (file d'envoi)."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    stmt = select(User).where(User.is_active.is_(True), User.email.notlike("%@users.deleted.amazer.ne"))
    if payload.audience == "user":
        if not payload.user_email:
            raise ValidationDomainError("Indiquez l'e-mail ou le numéro du destinataire.")
        needle = payload.user_email.strip().lower()
        stmt = stmt.where(or_(func.lower(User.email) == needle, User.whatsapp_phone == payload.user_email.strip()))
    elif payload.audience == "sellers":
        stmt = stmt.where(User.id.in_(select(SellerProfile.user_id)))
    elif payload.audience == "couriers":
        stmt = stmt.where(User.role == "courier")
    elif payload.audience == "customers":
        stmt = stmt.where(User.id.not_in(select(SellerProfile.user_id)), User.role == "user")
    recipients = db.scalars(stmt).all()
    if payload.audience == "user" and not recipients:
        raise ValidationDomainError("Aucun utilisateur actif avec cet e-mail ou ce numéro.")
    tag = f"admin-message-{uuid.uuid4().hex[:12]}"
    service = NotificationService(db)
    for recipient in recipients:
        service.send_to_user(
            user_id=recipient.id,
            payload=NotificationPayload(
                title=payload.title, body=payload.body, data={"tag": tag, "href": payload.href or "/notifications"}
            ),
        )
    append_audit_log(
        db,
        event_type="admin_message_sent",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="notification",
        entity_id=tag,
        details={"audience": payload.audience, "recipients": len(recipients), "title": payload.title},
    )
    db.commit()
    return AdminBroadcastResponse(recipients=len(recipients))


class AdminResellerEarning(BaseModel):
    user_id: str
    full_name: str
    contact: str
    whatsapp_phone: str | None
    earned: float
    pending: float
    orders_delivered: int
    paid: float = 0
    to_pay: float = 0


class AdminResellerPayoutCreate(BaseModel):
    amount: float = Field(gt=0, le=100_000_000)
    reference: str | None = Field(default=None, max_length=180)


@router.get("/reseller-earnings", response_model=list[AdminResellerEarning])
def list_reseller_earnings(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> list[AdminResellerEarning]:
    """Marges des revendeurs a verser (commandes payees et livrees) et en attente de livraison."""
    _require_finance_pin(request, admin_user)
    reseller_ids = db.scalars(
        select(OrderItem.reseller_user_id).where(OrderItem.reseller_user_id.is_not(None)).distinct()
    ).all()
    rows: list[AdminResellerEarning] = []
    for reseller_id in reseller_ids:
        user = db.get(User, reseller_id)
        if user is None:
            continue
        totals = compute_reseller_earnings(db, reseller_id)
        if totals.earned == 0 and totals.pending == 0:
            continue
        rows.append(
            AdminResellerEarning(
                user_id=user.id,
                full_name=user.full_name or "Revendeur",
                contact=user.email,
                whatsapp_phone=user.whatsapp_phone,
                earned=totals.earned,
                pending=totals.pending,
                orders_delivered=totals.orders_delivered,
                paid=totals.paid,
                to_pay=totals.to_pay,
            )
        )
    return sorted(rows, key=lambda row: (row.to_pay, row.earned), reverse=True)


@router.post("/resellers/{user_id}/payouts", response_model=AdminResellerEarning)
def record_reseller_payout(
    user_id: str,
    payload: AdminResellerPayoutCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminResellerEarning:
    """Enregistre un versement de marge (fait hors plateforme par Nita / Amana) : le reste a verser baisse d'autant."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    user = db.get(User, user_id)
    if user is None:
        raise ValidationDomainError("Revendeur introuvable")
    totals = compute_reseller_earnings(db, user_id)
    amount = round(float(payload.amount), 2)
    if amount > totals.to_pay + 0.01:
        raise ValidationDomainError(f"Montant trop élevé : il reste {totals.to_pay:.0f} XOF à verser.")
    payout = ResellerPayout(user_id=user_id, amount=amount, reference=(payload.reference or "").strip() or None, created_by=admin_user.id)
    db.add(payout)
    db.flush()
    NotificationService(db).send_to_user(
        user_id=user_id,
        payload=NotificationPayload(
            title="Gain revendeur versé",
            body=f"AMAZER vous a versé {amount:.0f} XOF.",
            data={"tag": f"reseller-payout-{payout.id}", "href": "/revendre"},
        ),
    )
    append_audit_log(
        db,
        event_type="admin_reseller_payout_recorded",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="reseller_payout",
        entity_id=payout.id,
        details={"user_id": user_id, "amount": amount, "reference": payout.reference},
    )
    db.commit()
    totals = compute_reseller_earnings(db, user_id)
    return AdminResellerEarning(
        user_id=user.id,
        full_name=user.full_name or "Revendeur",
        contact=user.email,
        whatsapp_phone=user.whatsapp_phone,
        earned=totals.earned,
        pending=totals.pending,
        orders_delivered=totals.orders_delivered,
        paid=totals.paid,
        to_pay=totals.to_pay,
    )


class AdminResellerRow(BaseModel):
    user_id: str
    full_name: str
    contact: str
    whatsapp_phone: str | None
    joined_at: str | None
    listings_active: int
    listings_total: int
    # free = abonnement gratuit (0 XOF) ; active = paye ou en essai ; expired = echu ; none = jamais active
    subscription: Literal["free", "active", "expired", "none"]
    paid_until: str | None
    has_paid: bool
    earned: float
    pending: float
    orders_delivered: int


def _reseller_subscription_state(fee: float, paid_until: datetime | None, now: datetime) -> str:
    if fee <= 0:
        return "free"
    if paid_until is None:
        return "none"
    aware = paid_until if paid_until.tzinfo else paid_until.replace(tzinfo=UTC)
    return "active" if aware > now else "expired"


@router.get("/resellers", response_model=list[AdminResellerRow])
def list_all_resellers(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> list[AdminResellerRow]:
    """Tous les revendeurs presents (compte revendeur ou au moins une annonce), meme sans vente."""
    _require_finance_pin(request, admin_user)
    fee, _percent = reseller_terms(db)
    now = datetime.now(UTC)
    counts: dict[str, list[int]] = {}
    for user_id, is_active, total in db.execute(
        select(ResellerListing.reseller_user_id, ResellerListing.is_active, func.count(ResellerListing.id)).group_by(
            ResellerListing.reseller_user_id, ResellerListing.is_active
        )
    ).all():
        entry = counts.setdefault(user_id, [0, 0])
        entry[1] += int(total)
        if is_active:
            entry[0] += int(total)
    accounts = {account.user_id: account for account in db.scalars(select(ResellerAccount)).all()}
    paid_ids = set(
        db.scalars(
            select(ResellerSubscriptionPayment.user_id).where(ResellerSubscriptionPayment.status == "approved").distinct()
        ).all()
    )
    ids = set(accounts) | set(counts)
    users = {user.id: user for user in db.scalars(select(User).where(User.id.in_(ids))).all()} if ids else {}
    rows: list[AdminResellerRow] = []
    for user_id in ids:
        user = users.get(user_id)
        if user is None:
            continue
        account = accounts.get(user_id)
        active, total = counts.get(user_id, [0, 0])
        totals = compute_reseller_earnings(db, user_id)
        joined = (account.created_at if account else None) or user.created_at
        rows.append(
            AdminResellerRow(
                user_id=user.id,
                full_name=user.full_name or "Revendeur",
                contact=user.email,
                whatsapp_phone=user.whatsapp_phone,
                joined_at=joined.isoformat() if joined else None,
                listings_active=active,
                listings_total=total,
                subscription=_reseller_subscription_state(fee, account.paid_until if account else None, now),
                paid_until=account.paid_until.isoformat() if account and account.paid_until else None,
                has_paid=user_id in paid_ids,
                earned=totals.earned,
                pending=totals.pending,
                orders_delivered=totals.orders_delivered,
            )
        )
    return sorted(rows, key=lambda row: (row.listings_active, row.joined_at or ""), reverse=True)


class AdminResellerPayment(BaseModel):
    id: str
    user_id: str
    full_name: str
    contact: str
    payment_mode: str
    transaction_reference: str
    months: int
    amount_claimed: float
    status: str
    created_at: str


class AdminResellerPaymentDecision(BaseModel):
    decision: Literal["approved", "rejected"]


@router.get("/reseller-payments", response_model=list[AdminResellerPayment])
def list_reseller_payments(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    status: Literal["pending", "approved", "rejected", "all"] = "pending",
) -> list[AdminResellerPayment]:
    _require_finance_pin(request, admin_user)
    stmt = select(ResellerSubscriptionPayment).order_by(desc(ResellerSubscriptionPayment.created_at)).limit(200)
    if status != "all":
        stmt = stmt.where(ResellerSubscriptionPayment.status == status)
    rows: list[AdminResellerPayment] = []
    for payment in db.scalars(stmt).all():
        user = db.get(User, payment.user_id)
        rows.append(
            AdminResellerPayment(
                id=payment.id,
                user_id=payment.user_id,
                full_name=(user.full_name if user else None) or "Revendeur",
                contact=(user.whatsapp_phone or user.email) if user else "",
                payment_mode=payment.payment_mode,
                transaction_reference=payment.transaction_reference,
                months=payment.months,
                amount_claimed=float(payment.amount_claimed),
                status=payment.status,
                created_at=payment.created_at.isoformat() if payment.created_at else "",
            )
        )
    return rows


@router.post("/reseller-payments/{payment_id}/decision", response_model=AdminResellerPayment)
def decide_reseller_payment(
    payment_id: str,
    payload: AdminResellerPaymentDecision,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminResellerPayment:
    """Valide (prolonge l'abonnement) ou refuse un paiement d'abonnement revendeur."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    payment = db.get(ResellerSubscriptionPayment, payment_id)
    if payment is None:
        raise ValidationDomainError("Paiement introuvable")
    if payment.status != "pending":
        raise ValidationDomainError("Ce paiement a déjà été traité.")
    payment.status = payload.decision
    payment.reviewed_at = datetime.now(UTC)
    if payload.decision == "approved":
        extend_reseller_subscription(ensure_reseller_account(db, payment.user_id), payment.months)
        credit_subscription_share(db, payment.user_id, float(payment.amount_claimed or 0), f"reseller-sub:{payment.id}", payment.months)
        title, body = "Abonnement revendeur actif", "Votre paiement est validé : vos produits sont en ligne."
    else:
        title, body = "Paiement revendeur refusé", "Votre paiement n'a pas pu être vérifié. Contactez AMAZER sur WhatsApp."
    NotificationService(db).send_to_user(
        user_id=payment.user_id,
        payload=NotificationPayload(title=title, body=body, data={"tag": f"reseller-payment-{payment.id}", "href": "/revendre"}),
    )
    append_audit_log(
        db,
        event_type=f"admin_reseller_payment_{payload.decision}",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="reseller_subscription_payment",
        entity_id=payment.id,
        details={"user_id": payment.user_id, "months": payment.months, "amount": float(payment.amount_claimed)},
    )
    db.commit()
    user = db.get(User, payment.user_id)
    return AdminResellerPayment(
        id=payment.id,
        user_id=payment.user_id,
        full_name=(user.full_name if user else None) or "Revendeur",
        contact=(user.whatsapp_phone or user.email) if user else "",
        payment_mode=payment.payment_mode,
        transaction_reference=payment.transaction_reference,
        months=payment.months,
        amount_claimed=float(payment.amount_claimed),
        status=payment.status,
        created_at=payment.created_at.isoformat() if payment.created_at else "",
    )


class AdminAffiliateEarning(BaseModel):
    user_id: str
    full_name: str
    contact: str
    whatsapp_phone: str | None
    code: str
    tier: str
    status: str
    clicks: int
    referred: int
    flagged_referrals: int
    earned: float
    pending: float
    on_hold: float
    review: float
    available: float
    requested: float
    paid: float
    orders_delivered: int
    ambassador_applied_at: str | None
    ambassador_application: str | None
    admin_note: str | None


class AdminAffiliateLedgerLine(BaseModel):
    id: str
    kind: str
    amount: float
    status: str
    percent: float | None
    note: str | None
    source_name: str | None
    reference: str
    created_at: str
    available_at: str | None


class AdminAffiliatePayout(BaseModel):
    id: str
    user_id: str
    full_name: str
    tier: str
    amount: float
    method: str
    phone: str
    status: str
    transaction_reference: str | None
    admin_note: str | None
    review_amount: float
    created_at: str
    processed_at: str | None


class AdminAffiliateUpdate(BaseModel):
    tier: Literal["affiliate", "ambassador"] | None = None
    status: Literal["active", "suspended"] | None = None
    admin_note: str | None = Field(default=None, max_length=500)
    cancel_unpaid: bool = False
    reason: str | None = Field(default=None, max_length=300)


class AdminEarningDecision(BaseModel):
    action: Literal["approve", "cancel"]
    note: str | None = Field(default=None, max_length=300)


class AdminAffiliateBonus(BaseModel):
    amount: float = Field(gt=0, le=1_000_000)
    reason: str = Field(min_length=3, max_length=300)


class AdminPayoutDecision(BaseModel):
    action: Literal["paid", "rejected"]
    transaction_reference: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=300)
    cancel_earnings: bool = False


def _audit(db: Session, request: Request, admin_user: User, event: str, entity_type: str, entity_id: str, details: dict) -> None:
    append_audit_log(
        db,
        event_type=event,
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )


def _iso_or_none(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _admin_affiliate_row(db: Session, account: AffiliateAccount, user: User) -> AdminAffiliateEarning:
    totals = compute_affiliate_earnings(db, account.user_id)
    referred = db.scalar(
        select(func.count()).select_from(AffiliateReferral).where(AffiliateReferral.affiliate_user_id == account.user_id)
    ) or 0
    flagged = db.scalar(
        select(func.count()).select_from(AffiliateReferral).where(
            AffiliateReferral.affiliate_user_id == account.user_id, AffiliateReferral.flag.is_not(None)
        )
    ) or 0
    return AdminAffiliateEarning(
        user_id=user.id,
        full_name=user.full_name or "Affilié",
        contact=user.email,
        whatsapp_phone=user.whatsapp_phone,
        code=account.code,
        tier=account.tier,
        status=account.status,
        clicks=int(account.click_count or 0),
        referred=int(referred),
        flagged_referrals=int(flagged),
        earned=totals.earned,
        pending=totals.pending,
        on_hold=totals.on_hold,
        review=totals.review,
        available=totals.available,
        requested=totals.requested,
        paid=totals.paid,
        orders_delivered=totals.orders_delivered,
        ambassador_applied_at=_iso_or_none(account.ambassador_applied_at),
        ambassador_application=account.ambassador_application,
        admin_note=account.admin_note,
    )


@router.get("/affiliate-earnings", response_model=list[AdminAffiliateEarning])
def list_affiliate_earnings(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> list[AdminAffiliateEarning]:
    """Affilies et ambassadeurs : soldes, signaux de fraude, candidatures."""
    _require_finance_pin(request, admin_user)
    mature_earnings(db)
    db.commit()
    ids = set(db.scalars(select(Order.affiliate_user_id).where(Order.affiliate_user_id.is_not(None)).distinct()).all())
    ids |= set(db.scalars(select(AffiliateEarning.affiliate_user_id).distinct()).all())
    ids |= set(db.scalars(select(AffiliateReferral.affiliate_user_id).distinct()).all())
    ids |= set(
        db.scalars(
            select(AffiliateAccount.user_id).where(
                (AffiliateAccount.tier == "ambassador")
                | (AffiliateAccount.status != "active")
                | AffiliateAccount.ambassador_applied_at.is_not(None)
            )
        ).all()
    )
    rows: list[AdminAffiliateEarning] = []
    for affiliate_id in ids:
        user = db.get(User, affiliate_id)
        account = db.get(AffiliateAccount, affiliate_id)
        if user is None or account is None:
            continue
        rows.append(_admin_affiliate_row(db, account, user))
    return sorted(rows, key=lambda row: (-row.review, -row.available, -row.earned))


@router.get("/affiliates/{user_id}/ledger", response_model=list[AdminAffiliateLedgerLine])
def affiliate_ledger(
    user_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> list[AdminAffiliateLedgerLine]:
    """Detail des gains d'un affilie (avec les motifs de verification)."""
    _require_finance_pin(request, admin_user)
    earnings = db.scalars(
        select(AffiliateEarning)
        .where(AffiliateEarning.affiliate_user_id == user_id)
        .order_by(AffiliateEarning.created_at.desc())
        .limit(300)
    ).all()
    source_ids = {e.source_user_id for e in earnings if e.source_user_id}
    names = {u.id: u.full_name for u in db.scalars(select(User).where(User.id.in_(source_ids)))} if source_ids else {}
    return [_ledger_line(e, names.get(e.source_user_id or "")) for e in earnings]


def _ledger_line(e: AffiliateEarning, source_name: str | None) -> AdminAffiliateLedgerLine:
    return AdminAffiliateLedgerLine(
        id=e.id,
        kind=e.kind,
        amount=float(e.amount),
        status=e.status,
        percent=e.percent,
        note=e.note,
        source_name=source_name,
        reference=e.reference,
        created_at=_iso_or_none(e.created_at) or "",
        available_at=_iso_or_none(e.available_at),
    )


@router.post("/affiliates/{user_id}", response_model=AdminAffiliateEarning)
def update_affiliate(
    user_id: str,
    payload: AdminAffiliateUpdate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminAffiliateEarning:
    """Nommer/retirer ambassadeur, suspendre/reactiver, annuler les gains non payes (fraude)."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    user = db.get(User, user_id)
    if user is None:
        raise ValidationDomainError("Utilisateur introuvable")
    account = ensure_affiliate_account(db, user_id)
    promoted = payload.tier == "ambassador" and account.tier != "ambassador"
    if payload.tier is not None:
        account.tier = payload.tier
        account.ambassador_applied_at = None
    if payload.status is not None:
        account.status = payload.status
    if payload.admin_note is not None:
        account.admin_note = payload.admin_note.strip() or None
    cancelled = 0
    if payload.cancel_unpaid:
        cancelled = cancel_unpaid(db, user_id, payload.reason or "annulé par AMAZER (fraude)", admin_user.id)
    _audit(
        db, request, admin_user, "admin_affiliate_updated", "affiliate_account", user_id,
        {"tier": payload.tier, "status": payload.status, "cancelled_earnings": cancelled, "reason": payload.reason},
    )
    if promoted:
        NotificationService(db).send_to_user(
            user_id=user_id,
            payload=NotificationPayload(
                title="Vous êtes ambassadeur AMAZER",
                body="Bienvenue ! Vos nouveaux taux et le classement du mois sont sur la page Affiliation.",
                data={"tag": f"ambassador-{user_id}", "href": "/affiliation"},
            ),
        )
    db.commit()
    return _admin_affiliate_row(db, account, user)


@router.post("/affiliate-ledger/{earning_id}", response_model=AdminAffiliateLedgerLine)
def decide_affiliate_earning(
    earning_id: str,
    payload: AdminEarningDecision,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminAffiliateLedgerLine:
    """Valider un gain bloque, ou annuler un gain non paye."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    earning = db.get(AffiliateEarning, earning_id)
    if earning is None:
        raise ValidationDomainError("Gain introuvable")
    try:
        decide_earning(db, earning, admin_id=admin_user.id, approve=payload.action == "approve", note=payload.note)
    except PayoutError as exc:
        raise ValidationDomainError(str(exc)) from exc
    _audit(
        db, request, admin_user, "admin_affiliate_earning_decision", "affiliate_earning", earning.id,
        {"action": payload.action, "amount": float(earning.amount), "note": payload.note},
    )
    db.commit()
    source = db.get(User, earning.source_user_id) if earning.source_user_id else None
    return _ledger_line(earning, source.full_name if source else None)


@router.post("/affiliates/{user_id}/bonus", status_code=204)
def give_affiliate_bonus(
    user_id: str,
    payload: AdminAffiliateBonus,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> None:
    """Prime manuelle (ex. meilleur ambassadeur du mois)."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    account = db.get(AffiliateAccount, user_id)
    if account is None or account.status != "active":
        raise ValidationDomainError("Compte affilié introuvable ou suspendu")
    earning = add_manual_bonus(db, user_id, payload.amount, payload.reason.strip(), admin_user.id)
    _audit(
        db, request, admin_user, "admin_affiliate_bonus", "affiliate_earning", earning.reference,
        {"user_id": user_id, "amount": payload.amount, "reason": payload.reason},
    )
    NotificationService(db).send_to_user(
        user_id=user_id,
        payload=NotificationPayload(
            title="Prime AMAZER reçue",
            body=f"Vous recevez une prime de {int(payload.amount)} F : {payload.reason.strip()}",
            data={"tag": f"affiliate-bonus-{earning.reference}", "href": "/affiliation"},
        ),
    )
    db.commit()


def _payout_row(db: Session, payout: AffiliatePayout) -> AdminAffiliatePayout:
    user = db.get(User, payout.affiliate_user_id)
    account = db.get(AffiliateAccount, payout.affiliate_user_id)
    review = db.scalar(
        select(func.coalesce(func.sum(AffiliateEarning.amount), 0)).where(
            AffiliateEarning.affiliate_user_id == payout.affiliate_user_id, AffiliateEarning.status == "review"
        )
    ) or 0
    return AdminAffiliatePayout(
        id=payout.id,
        user_id=payout.affiliate_user_id,
        full_name=(user.full_name if user else None) or "Affilié",
        tier=account.tier if account else "affiliate",
        amount=float(payout.amount),
        method=payout.method,
        phone=payout.phone,
        status=payout.status,
        transaction_reference=payout.transaction_reference,
        admin_note=payout.admin_note,
        review_amount=float(review),
        created_at=_iso_or_none(payout.created_at) or "",
        processed_at=_iso_or_none(payout.processed_at),
    )


@router.get("/affiliate-payouts", response_model=list[AdminAffiliatePayout])
def list_affiliate_payouts(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    status_filter: Annotated[Literal["requested", "paid", "rejected", "all"], Query(alias="status")] = "requested",
) -> list[AdminAffiliatePayout]:
    """Demandes de paiement des affilies (par defaut : celles a traiter)."""
    _require_finance_pin(request, admin_user)
    query = select(AffiliatePayout).order_by(AffiliatePayout.created_at.desc()).limit(200)
    if status_filter != "all":
        query = query.where(AffiliatePayout.status == status_filter)
    return [_payout_row(db, payout) for payout in db.scalars(query).all()]


@router.post("/affiliate-payouts/{payout_id}", response_model=AdminAffiliatePayout)
def decide_affiliate_payout(
    payout_id: str,
    payload: AdminPayoutDecision,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminAffiliatePayout:
    """Versement effectue (reference de transaction obligatoire) ou refuse."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    payout = db.get(AffiliatePayout, payout_id)
    if payout is None:
        raise ValidationDomainError("Demande introuvable")
    try:
        settle_payout(
            db, payout, admin_id=admin_user.id, paid=payload.action == "paid",
            reference=payload.transaction_reference, note=payload.note, cancel_earnings=payload.cancel_earnings,
        )
    except PayoutError as exc:
        raise ValidationDomainError(str(exc)) from exc
    _audit(
        db, request, admin_user, "admin_affiliate_payout_decision", "affiliate_payout", payout.id,
        {"action": payload.action, "amount": float(payout.amount), "reference": payload.transaction_reference},
    )
    if payload.action == "paid":
        title = "Paiement envoyé"
        body = f"{int(payout.amount)} F vous ont été versés ({payout.method}). Référence : {payout.transaction_reference}."
    else:
        title, body = "Demande de paiement refusée", payload.note or "Contactez AMAZER pour plus de détails."
    NotificationService(db).send_to_user(
        user_id=payout.affiliate_user_id,
        payload=NotificationPayload(title=title, body=body, data={"tag": f"affiliate-payout-{payout.id}", "href": "/affiliation"}),
    )
    db.commit()
    return _payout_row(db, payout)


class AdminRefund(BaseModel):
    id: str
    source: str
    source_id: str
    customer_name: str
    phone: str | None
    method: str | None
    amount: float
    reason: str
    status: str
    reference: str | None
    admin_note: str | None
    created_at: str
    processed_at: str | None


class AdminRefundDecision(BaseModel):
    action: Literal["refunded", "not_needed"]
    reference: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=300)


def _refund_row(row: Refund) -> AdminRefund:
    return AdminRefund(
        id=row.id,
        source=row.source,
        source_id=row.source_id,
        customer_name=row.customer_name,
        phone=row.phone,
        method=row.method,
        amount=float(row.amount),
        reason=row.reason,
        status=row.status,
        reference=row.reference,
        admin_note=row.admin_note,
        created_at=_iso_or_none(row.created_at) or "",
        processed_at=_iso_or_none(row.processed_at),
    )


@router.get("/refunds", response_model=list[AdminRefund])
def list_refunds(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
    status_filter: Annotated[Literal["to_refund", "refunded", "not_needed", "all"], Query(alias="status")] = "to_refund",
) -> list[AdminRefund]:
    """Remboursements a faire (commandes payees puis annulees ou refusees)."""
    _require_finance_pin(request, admin_user)
    query = select(Refund).order_by(Refund.created_at.desc()).limit(300)
    if status_filter != "all":
        query = query.where(Refund.status == status_filter)
    return [_refund_row(row) for row in db.scalars(query).all()]


@router.post("/refunds/{refund_id}", response_model=AdminRefund)
def decide_refund(
    refund_id: str,
    payload: AdminRefundDecision,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> AdminRefund:
    """Rembourse (reference du virement obligatoire) ou « pas necessaire » (ex. client rembourse autrement)."""
    enforce_csrf(request)
    _require_finance_pin(request, admin_user)
    row = db.get(Refund, refund_id)
    if row is None:
        raise ValidationDomainError("Remboursement introuvable")
    try:
        settle_refund(row, admin_id=admin_user.id, refunded=payload.action == "refunded", reference=payload.reference, note=payload.note)
    except ValueError as exc:
        raise ValidationDomainError(str(exc)) from exc
    _audit(db, request, admin_user, "admin_refund_decision", "refund", row.id,
           {"action": payload.action, "amount": float(row.amount), "reference": payload.reference})
    if payload.action == "refunded" and row.user_id:
        NotificationService(db).send_to_user(
            user_id=row.user_id,
            payload=NotificationPayload(
                title="Remboursement effectué",
                body=f"AMAZER vous a remboursé {int(row.amount)} F (référence {row.reference}).",
                data={"tag": f"refund-{row.id}", "href": "/dashboard"},
            ),
        )
    db.commit()
    return _refund_row(row)
