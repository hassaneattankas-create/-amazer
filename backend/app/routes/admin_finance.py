from datetime import UTC, date, datetime, timedelta
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.crypto import decrypt_payment_code, encrypt_payment_code
from app.core.deps import get_admin_user
from app.core.exceptions import UnauthorizedError, ValidationDomainError
from app.core.rate_limit import enforce_rate_limit
from app.database import get_db
from app.models.finance import FinanceSettings, FinanceTransfer
from app.models.finance import FinanceDistrictFee
from app.models.order import Order
from app.models.restaurant import RestaurantOrder
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.schemas.finance import (
    AdminOrderStatusUpdateRequest,
    AdminOrderTrackingResponse,
    DistrictFeeItem,
    FinanceSettingsResponse,
    FinanceSettingsUpdateRequest,
    FinanceSummaryResponse,
    PinVerifyRequest,
    RevenuePoint,
    TransferRequest,
    TransferResponse,
    TreasuryTransactionResponse,
    WalletSummaryResponse,
)
from app.services.audit_log_service import append_audit_log

router = APIRouter(prefix="/admin/finance", tags=["admin-finance"])
settings = get_settings()


def _get_or_create_settings(db: Session) -> FinanceSettings:
    settings = db.scalar(select(FinanceSettings).order_by(FinanceSettings.id.asc()))
    if settings is None:
        settings = FinanceSettings(
            commission_rate=0.05,
            service_fee=200,
            default_delivery_fee=1500,
            seller_subscription_fee=5000,
            ad_boost_price=2000,
            ad_boost_duration_days=7,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _to_response(settings: FinanceSettings) -> FinanceSettingsResponse:
    return FinanceSettingsResponse(
        commission_rate=settings.commission_rate,
        service_fee=settings.service_fee,
        default_delivery_fee=settings.default_delivery_fee,
        seller_subscription_fee=settings.seller_subscription_fee,
        ad_boost_price=settings.ad_boost_price,
        ad_boost_duration_days=settings.ad_boost_duration_days,
    )


def _require_finance_pin(request: Request) -> None:
    pin_cookie = request.cookies.get("finance_pin_verified")
    if pin_cookie != "1":
        raise UnauthorizedError("Finance PIN verification required")


def _commission_from_order(amount: float, finance: FinanceSettings) -> float:
    return (amount * finance.commission_rate) + finance.service_fee


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


@router.post("/pin/verify", status_code=204)
def verify_admin_finance_pin(
    payload: PinVerifyRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> None:
    enforce_rate_limit(request, key="admin_finance_pin", limit=5, window_seconds=300)
    if payload.pin != settings.admin_finance_pin:
        raise UnauthorizedError("Invalid finance PIN")
    response.set_cookie(
        key="finance_pin_verified",
        value="1",
        httponly=True,
        secure=True,
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
    _require_finance_pin(request)
    settings = _get_or_create_settings(db)
    settings.commission_rate = payload.commission_rate
    settings.service_fee = payload.service_fee
    settings.default_delivery_fee = payload.default_delivery_fee
    settings.seller_subscription_fee = payload.seller_subscription_fee
    settings.ad_boost_price = payload.ad_boost_price
    settings.ad_boost_duration_days = payload.ad_boost_duration_days
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
    db.refresh(settings)
    return _to_response(settings)


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

    platform_orders = db.scalars(select(Order).where(Order.created_at >= start_dt)).all()
    restaurant_orders = db.scalars(
        select(RestaurantOrder).where(RestaurantOrder.created_at >= start_dt)
    ).all()
    active_sellers = len(db.scalars(select(SellerProfile.id)).all())

    revenue_map: dict[date, float] = {start_date + timedelta(days=i): 0 for i in range(30)}

    total_commissions = 0.0
    for platform_order in platform_orders:
        day_value = platform_order.created_at.astimezone(UTC).date()
        amount = _commission_from_order(platform_order.total_amount, settings)
        total_commissions += amount
        if day_value in revenue_map:
            revenue_map[day_value] += amount

    for restaurant_order in restaurant_orders:
        day_value = restaurant_order.created_at.astimezone(UTC).date()
        amount = _commission_from_order(restaurant_order.total_amount, settings)
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

    platform_orders = db.scalars(select(Order)).all()
    restaurant_orders = db.scalars(select(RestaurantOrder)).all()

    totals = {"nita": 0.0, "amana": 0.0, "cash_on_delivery": 0.0}
    for order in platform_orders:
        totals[order.payment_mode] = totals.get(order.payment_mode, 0.0) + order.total_amount
    for order in restaurant_orders:
        totals[order.payment_mode] = totals.get(order.payment_mode, 0.0) + order.total_amount

    total_all = sum(totals.values())
    transaction_count = len(platform_orders) + len(restaurant_orders)
    commission_total = total_all * finance.commission_rate
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
    orders = db.scalars(select(Order).order_by(Order.created_at.desc()).limit(limit)).all()
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
