from datetime import UTC, date, datetime, timedelta
import csv
import io
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.core.crypto import decrypt_payment_code, encrypt_payment_code
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
from app.models.restaurant import RestaurantOrder
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.finance import (
    AdminSellerResponse,
    AdminOrderStatusUpdateRequest,
    AdminOrderTrackingResponse,
    AuditLogResponse,
    DistrictFeeItem,
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

router = APIRouter(prefix="/admin/finance", tags=["admin-finance"])
settings = get_settings()

def _get_or_create_settings(db: Session) -> GlobalSettings:
    row = db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))
    if row is None:
        row = GlobalSettings(
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
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _effective_commission_rate(settings: GlobalSettings) -> float:
    return 0.0 if settings.launch_mode_zero_commission else settings.commission_rate


def _to_response(settings: GlobalSettings) -> FinanceSettingsResponse:
    return FinanceSettingsResponse(
        commission_rate=_effective_commission_rate(settings),
        service_fee=settings.service_fee,
        default_delivery_fee=settings.default_delivery_fee,
        seller_subscription_fee=settings.seller_subscription_fee,
        ad_boost_price=settings.ad_boost_price,
        ad_boost_duration_days=settings.ad_boost_duration_days,
        urban_delivery_fee=settings.urban_delivery_fee,
        peripheral_delivery_fee=settings.peripheral_delivery_fee,
        ad_boost_price_24h=settings.ad_boost_price_24h,
        ad_boost_price_7d=settings.ad_boost_price_7d,
        launch_mode_zero_commission=settings.launch_mode_zero_commission,
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
    if payload.pin != settings.admin_finance_pin or payload.birth_date != settings.admin_birth_date:
        raise UnauthorizedError("Invalid finance PIN")
    response.set_cookie(
        key="finance_pin_verified",
        value="1",
        httponly=True,
        secure=settings.is_production(),
        samesite="strict",
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
    settings_row.seller_subscription_fee = payload.seller_subscription_fee
    settings_row.ad_boost_price = payload.ad_boost_price
    settings_row.ad_boost_duration_days = payload.ad_boost_duration_days
    settings_row.ad_boost_price_24h = payload.ad_boost_price_24h
    settings_row.ad_boost_price_7d = payload.ad_boost_price_7d
    settings_row.launch_mode_zero_commission = payload.launch_mode_zero_commission
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

    platform_daily = db.execute(
        select(
            func.date(Order.created_at).label("day"),
            func.sum(Order.total_amount).label("amount"),
            func.count(Order.id).label("count"),
        )
        .where(Order.created_at >= start_dt)
        .group_by(func.date(Order.created_at))
    ).all()

    restaurant_daily = db.execute(
        select(
            func.date(RestaurantOrder.created_at).label("day"),
            func.sum(RestaurantOrder.total_amount).label("amount"),
            func.count(RestaurantOrder.id).label("count"),
        )
        .where(RestaurantOrder.created_at >= start_dt)
        .group_by(func.date(RestaurantOrder.created_at))
    ).all()

    total_commissions = 0.0
    for row in platform_daily:
        if row.amount is None or row.count is None:
            continue
        day_value = _normalize_day(row.day)
        if day_value is None:
            continue
        amount = (float(row.amount) * _effective_commission_rate(settings)) + (int(row.count) * settings.service_fee)
        total_commissions += amount
        if day_value in revenue_map:
            revenue_map[day_value] += amount

    for row in restaurant_daily:
        if row.amount is None or row.count is None:
            continue
        day_value = _normalize_day(row.day)
        if day_value is None:
            continue
        amount = (float(row.amount) * _effective_commission_rate(settings)) + (int(row.count) * settings.service_fee)
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
    platform_count = db.scalar(select(func.count(Order.id))) or 0
    restaurant_count = db.scalar(select(func.count(RestaurantOrder.id))) or 0

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
    transaction_count = int(platform_count) + int(restaurant_count)
    commission_total = total_all * _effective_commission_rate(finance)
    service_fee_total = transaction_count * finance.service_fee
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
    platform_orders = db.scalars(select(Order).order_by(Order.created_at.desc()).limit(limit)).all()
    restaurant_orders = db.scalars(
        select(RestaurantOrder).order_by(RestaurantOrder.created_at.desc()).limit(limit)
    ).all()
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
    orders = db.scalars(
        select(Order)
        .options(selectinload(Order.user))
        .order_by(Order.created_at.desc())
        .limit(limit)
    ).all()
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


@router.get("/sellers", response_model=list[AdminSellerResponse])
def list_sellers_admin(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> list[AdminSellerResponse]:
    _require_finance_pin(request)
    rows = db.scalars(select(SellerProfile).order_by(desc(SellerProfile.created_at)).limit(500)).all()
    vendor_ids = {row.vendor_id for row in rows}
    vendors = db.scalars(select(Vendor).where(Vendor.id.in_(vendor_ids))).all() if vendor_ids else []
    vendor_map = {vendor.id: vendor for vendor in vendors}
    payload: list[AdminSellerResponse] = []
    for row in rows:
        vendor = vendor_map.get(row.vendor_id)
        payload.append(
            AdminSellerResponse(
                profile_id=row.id,
                user_id=row.user_id,
                vendor_id=row.vendor_id,
                business_name=row.business_name,
                city=row.city,
                phone=row.phone,
                is_verified=row.is_verified,
                is_active=bool(vendor.is_active) if vendor else False,
                created_at=row.created_at.isoformat(),
            )
        )
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
    vendor = db.get(Vendor, profile.vendor_id)
    return AdminSellerResponse(
        profile_id=profile.id,
        user_id=profile.user_id,
        vendor_id=profile.vendor_id,
        business_name=profile.business_name,
        city=profile.city,
        phone=profile.phone,
        is_verified=profile.is_verified,
        is_active=bool(vendor.is_active) if vendor else False,
        created_at=profile.created_at.isoformat(),
    )


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
    vendor = db.get(Vendor, profile.vendor_id)
    return AdminSellerResponse(
        profile_id=profile.id,
        user_id=profile.user_id,
        vendor_id=profile.vendor_id,
        business_name=profile.business_name,
        city=profile.city,
        phone=profile.phone,
        is_verified=profile.is_verified,
        is_active=bool(vendor.is_active) if vendor else False,
        created_at=profile.created_at.isoformat(),
    )
