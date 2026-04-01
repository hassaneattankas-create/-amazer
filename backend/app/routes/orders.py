from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.core.crypto import decrypt_payment_code, encrypt_payment_code, payment_code_hash
from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user, get_current_user_optional
from app.core.receipt_security import (
    create_receipt_access_token,
    decode_receipt_access_token,
    receipt_integrity_hash,
)
from app.core.rate_limit import enforce_rate_limit
from app.core.exceptions import UnauthorizedError, ValidationDomainError
from app.database import get_db
from app.models.global_settings import GlobalSettings
from app.models.order import Order, OrderItem
from app.models.product import Price, Product
from app.models.receipt_scan import ReceiptScan
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.schemas.order import (
    CheckoutRequest,
    OrderItemResponse,
    OrderResponse,
    ReceiptItemResponse,
    ReceiptLinkResponse,
    ReceiptResponse,
    PaymentConfirmRequest,
    PaymentConfirmResponse,
    PaymentIntentResponse,
    ReceiptVerifyRequest,
    ReceiptVerifyResponse,
)
from app.services.payment_security_service import verify_payment_code
from app.services.security_log_service import log_security_event

router = APIRouter(prefix="/orders", tags=["orders"])
settings = get_settings()
AUTO_RECEIPT_TIMEOUT_HOURS = 24


def _to_order_response(order: Order) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        status=order.status,
        payment_mode=order.payment_mode,
        delivery_type=order.delivery_type,
        payment_reference=order.payment_reference,
        payment_status=order.payment_status,
        payment_confirmed_at=order.payment_confirmed_at,
        transaction_code=None,
        tracking_code=order.tracking_code,
        estimated_minutes=order.estimated_minutes,
        total_amount=order.total_amount,
        currency=order.currency,
        created_at=order.created_at,
        items=[
            OrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                vendor_id=item.vendor_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.quantity * item.unit_price,
            )
            for item in order.items
        ],
    )


def _is_admin(user: User | None) -> bool:
    if user is None:
        return False
    return user.email.lower() == settings.admin_email.lower()


def _mask_transaction_code(raw_code: str | None) -> str | None:
    if not raw_code:
        return None
    if len(raw_code) <= 5:
        return "*" * len(raw_code)
    return f"{raw_code[:3]}***{raw_code[-2:]}"


def _build_payment_reference(order_id: str) -> str:
    return f"AMZ-{order_id[:6].upper()}-{order_id[-4:].upper()}"


def _build_payment_url(payment_mode: str, payment_reference: str, amount: float) -> str:
    amount_xof = int(round(amount))
    if payment_mode == "nita":
        return f"https://pay.amazer.ne/nita?ref={payment_reference}&amount={amount_xof}"
    return f"https://pay.amazer.ne/amana?ref={payment_reference}&amount={amount_xof}"


def _build_receipt_payload(
    order: Order,
    customer_name: str,
    product_name_by_id: dict[str, str],
) -> dict[str, object]:
    return {
        "order_id": order.id,
        "customer_name": customer_name,
        "payment_mode": order.payment_mode,
        "payment_reference": order.payment_reference,
        "payment_status": order.payment_status,
        "currency": order.currency,
        "total_amount": round(order.total_amount, 2),
        "created_at": order.created_at.isoformat(),
        "tracking_code": order.tracking_code,
        "transaction_code_hash": order.transaction_code_hash,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": product_name_by_id.get(item.product_id, f"Produit {item.product_id[:8]}"),
                "quantity": item.quantity,
                "unit_price": round(item.unit_price, 2),
                "subtotal": round(item.quantity * item.unit_price, 2),
            }
            for item in sorted(order.items, key=lambda row: row.product_id)
        ],
    }


def _resolve_order_for_receipt(db: Session, order_id: str) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.user))
    )


def _latest_dispatch_marker(db: Session, order_id: str) -> datetime | None:
    return db.scalar(
        select(ReceiptScan.scanned_at)
        .where(ReceiptScan.order_id == order_id, ReceiptScan.result == "pending")
        .order_by(ReceiptScan.scanned_at.desc())
        .limit(1)
    )


def _auto_finalize_order_without_qr(
    db: Session,
    order: Order,
    request: Request | None,
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
    if datetime.now(UTC) - reference_time < timedelta(hours=AUTO_RECEIPT_TIMEOUT_HOURS):
        return False
    vendor_ids = {item.vendor_id for item in order.items}
    resolved_vendor_id = next(iter(vendor_ids)) if len(vendor_ids) == 1 else None
    order.status = "recu"
    db.add(
        ReceiptScan(
            order_id=order.id,
            vendor_id=resolved_vendor_id,
            ip_address=request.client.host if request and request.client else None,
            gps="AUTO_TIMEOUT",
            result="auto_verified",
        )
    )
    log_security_event(
        db,
        event_type="order_auto_receipt_timeout",
        ip_address=request.client.host if request and request.client else None,
        path=str(request.url.path) if request else None,
        details={"order_id": order.id, "timeout_hours": AUTO_RECEIPT_TIMEOUT_HOURS},
    )
    return True


def _product_names(db: Session, order: Order) -> dict[str, str]:
    product_ids = [item.product_id for item in order.items]
    if not product_ids:
        return {}
    products = db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
    return {product.id: product.name for product in products}


def _resolve_platform_wallet_phone(db: Session) -> str | None:
    row = db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))
    if row is None:
        return None
    primary = (row.platform_wallet_phone or "").strip()
    if primary:
        return primary
    fallback = (row.support_phone or "").strip()
    return fallback or None


def _to_receipt_response(
    request: Request,
    order: Order,
    customer_name: str,
    product_name_by_id: dict[str, str],
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
    verify_url = f"{str(request.base_url).rstrip('/')}{settings.api_prefix}/orders/receipt/verify?token={token}"
    return ReceiptResponse(
        order_id=order.id,
        customer_name=customer_name,
        payment_mode=order.payment_mode,
        payment_reference=order.payment_reference,
        payment_status=order.payment_status,
        currency=order.currency,
        total_amount=round(order.total_amount, 2),
        transaction_code_masked=_mask_transaction_code(decrypted),
        created_at=order.created_at,
        issued_at=order.created_at,
        items=[
            ReceiptItemResponse(
                product_id=item.product_id,
                product_name=product_name_by_id.get(item.product_id, f"Produit {item.product_id[:8]}"),
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.quantity * item.unit_price,
            )
            for item in order.items
        ],
        integrity_hash=digest,
        verify_url=verify_url,
        payment_url=payment_url,
        platform_wallet_phone=platform_wallet_phone,
    )


@router.get("/me", response_model=list[OrderResponse])
def list_my_orders(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[OrderResponse]:
    orders = db.scalars(
        select(Order)
        .where(Order.user_id == current_user.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    ).all()
    has_auto_updates = False
    for order in orders:
        if _auto_finalize_order_without_qr(db, order, request):
            has_auto_updates = True
    if has_auto_updates:
        db.commit()
    return [_to_order_response(order) for order in orders]


@router.post("/checkout", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def checkout(
    payload: CheckoutRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OrderResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="payment_checkout", limit=10, window_seconds=60)
    estimated_minutes = 45 if payload.delivery_type == "express_niamey" else 180
    validated_items: list[tuple[Price, int]] = []
    total = 0.0
    order_currency: str | None = None
    for item in payload.items:
        price = db.scalar(
            select(Price)
            .where(
                Price.product_id == item.product_id,
                Price.vendor_id == item.vendor_id,
                Price.is_active.is_(True),
            )
            .options(selectinload(Price.product), selectinload(Price.vendor))
        )
        if price is None or price.product is None or price.vendor is None:
            raise ValidationDomainError("Article indisponible")
        if not price.vendor.is_active:
            raise ValidationDomainError("Vendeur inactif")
        if price.stock_quantity < item.quantity:
            raise ValidationDomainError("Stock insuffisant pour cet article")
        if order_currency is None:
            order_currency = price.currency
        elif order_currency != price.currency:
            raise ValidationDomainError("Les devises multiples ne sont pas supportees")
        line_total = float(price.amount) * item.quantity
        total += line_total
        validated_items.append((price, item.quantity))
    encrypted_code: str | None = None
    code_hash: str | None = None
    payment_status = "pending"
    order_status = "payment_pending"
    payment_confirmed_at = None
    if payload.transaction_code:
        if not verify_payment_code(db, payload.transaction_code):
            raise ValidationDomainError("Transaction code already used")
        encrypted_code = encrypt_payment_code(payload.transaction_code)
        code_hash = payment_code_hash(payload.transaction_code)
        payment_status = "paid"
        order_status = "commande"
        payment_confirmed_at = datetime.now(UTC)

    if order_currency and payload.currency.upper() != order_currency:
        raise ValidationDomainError("Devise invalide pour cette commande")

    order = Order(
        user_id=current_user.id,
        payment_mode=payload.payment_mode,
        delivery_type=payload.delivery_type,
        transaction_code=encrypted_code,
        transaction_code_hash=code_hash,
        payment_reference=None,
        payment_status=payment_status,
        payment_confirmed_at=payment_confirmed_at,
        currency=order_currency or payload.currency,
        total_amount=total,
        estimated_minutes=estimated_minutes,
        status=order_status,
    )
    for price, quantity in validated_items:
        order.items.append(
            OrderItem(
                product_id=price.product_id,
                vendor_id=price.vendor_id,
                quantity=quantity,
                unit_price=price.amount,
            )
        )

    db.add(order)
    db.flush()
    if order.tracking_code is None:
        order.tracking_code = f"AMZ-{order.id[:8].upper()}"
    if order.payment_reference is None:
        order.payment_reference = _build_payment_reference(order.id)
    db.commit()
    db.refresh(order)
    return _to_order_response(order)


@router.get("/{order_id}/payment-intent", response_model=PaymentIntentResponse)
def get_payment_intent(
    order_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaymentIntentResponse:
    order = _resolve_order_for_receipt(db, order_id)
    if order is None:
        raise ValidationDomainError("Order not found")
    if order.user_id != current_user.id and not _is_admin(current_user):
        raise UnauthorizedError("Unauthorized order access")
    reference = order.payment_reference or _build_payment_reference(order.id)
    if order.payment_reference is None:
        order.payment_reference = reference
        db.commit()
        db.refresh(order)
    payment_url = _build_payment_url(order.payment_mode, reference, order.total_amount)
    return PaymentIntentResponse(
        order_id=order.id,
        payment_mode=order.payment_mode,
        payment_reference=reference,
        amount=round(order.total_amount, 2),
        currency=order.currency,
        payment_url=payment_url,
        qr_payload=payment_url,
        expires_in_seconds=15 * 60,
    )


@router.post("/{order_id}/payment/confirm", response_model=PaymentConfirmResponse)
def confirm_order_payment(
    order_id: str,
    payload: PaymentConfirmRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaymentConfirmResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="payment_confirm", limit=12, window_seconds=120)
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
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

    reference = order.payment_reference or _build_payment_reference(order.id)
    order.payment_reference = reference
    provider_ref = (payload.provider_reference or payload.code_last4 or "").strip()
    synthetic_code = f"AUTO-{reference}-{provider_ref or 'OK'}"
    order.transaction_code = encrypt_payment_code(synthetic_code)
    order.transaction_code_hash = payment_code_hash(synthetic_code)
    order.payment_status = "paid"
    order.payment_confirmed_at = datetime.now(UTC)
    if order.status == "payment_pending":
        order.status = "commande"

    db.commit()
    db.refresh(order)
    return PaymentConfirmResponse(
        order_id=order.id,
        payment_status=order.payment_status,
        order_status=order.status,
        message="Paiement confirme avec succes.",
    )


@router.get("/{order_id}/receipt-link", response_model=ReceiptLinkResponse)
def get_receipt_link(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReceiptLinkResponse:
    order = _resolve_order_for_receipt(db, order_id)
    if order is None:
        raise ValidationDomainError("Order not found")
    if order.user_id != current_user.id and not _is_admin(current_user):
        raise UnauthorizedError("Unauthorized receipt access")
    customer_name = order.user.full_name if order.user else "Client AMAZER"
    payload = _build_receipt_payload(order, customer_name, _product_names(db, order))
    digest = receipt_integrity_hash(payload)
    token = create_receipt_access_token(order_id=order.id, digest=digest)
    receipt_url = f"/order/receipt/{order.id}?token={token}"
    verify_url = f"/seller/delivery-scan?token={token}"
    return ReceiptLinkResponse(order_id=order.id, token=token, receipt_url=receipt_url, verify_url=verify_url)


@router.get("/receipt/{order_id}", response_model=ReceiptResponse)
def get_secure_receipt(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
    token: Annotated[str | None, Query()] = None,
) -> ReceiptResponse:
    order = _resolve_order_for_receipt(db, order_id)
    if order is None:
        raise ValidationDomainError("Order not found")
    if _auto_finalize_order_without_qr(db, order, request):
        db.commit()
        db.refresh(order)

    customer_name = order.user.full_name if order.user else "Client AMAZER"
    names = _product_names(db, order)
    payload = _build_receipt_payload(order, customer_name, names)
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
    payment_url = _build_payment_url(order.payment_mode, reference, order.total_amount)
    wallet_phone = _resolve_platform_wallet_phone(db)

    return _to_receipt_response(
        request=request,
        order=order,
        customer_name=customer_name,
        product_name_by_id=names,
        digest=digest,
        token=token,
        payment_url=payment_url,
        platform_wallet_phone=wallet_phone,
    )


@router.post("/receipt/verify", response_model=ReceiptVerifyResponse)
def verify_receipt_scan(
    payload: ReceiptVerifyRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReceiptVerifyResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="receipt_scan_verify", limit=20, window_seconds=60)
    is_admin = _is_admin(current_user)
    seller_profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
    if not is_admin and seller_profile is None:
        raise UnauthorizedError("Seller or admin access required")
    try:
        claims = decode_receipt_access_token(payload.token)
    except ValueError as exc:
        raise UnauthorizedError("Invalid or expired receipt token") from exc
    order_id = str(claims.get("sub"))
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.user))
        .with_for_update()
    )
    if order is None:
        raise ValidationDomainError("Order not found")
    resolved_vendor_id = payload.vendor_id
    if not is_admin:
        seller_vendor_id = seller_profile.vendor_id if seller_profile else None
        if not seller_vendor_id:
            raise UnauthorizedError("Seller profile not found")
        if payload.vendor_id and payload.vendor_id != seller_vendor_id:
            raise UnauthorizedError("Vendor mismatch for delivery verification")
        if not any(item.vendor_id == seller_vendor_id for item in order.items):
            raise UnauthorizedError("This order is not linked to your storefront")
        resolved_vendor_id = seller_vendor_id

    customer_name = order.user.full_name if order.user else "Client AMAZER"
    digest = receipt_integrity_hash(_build_receipt_payload(order, customer_name, _product_names(db, order)))
    if claims.get("digest") != digest:
        raise UnauthorizedError("Receipt integrity check failed")

    scan = ReceiptScan(
        order_id=order.id,
        vendor_id=resolved_vendor_id,
        ip_address=request.client.host if request.client else None,
        gps=payload.gps,
    )

    if order.status in {"CLAIMED", "recu"}:
        used_at = db.scalar(
            select(ReceiptScan.scanned_at)
            .where(
                ReceiptScan.order_id == order.id,
                ReceiptScan.result.in_(["accepted", "auto_verified"]),
            )
            .order_by(ReceiptScan.scanned_at.desc())
            .limit(1)
        )
        scan.result = "blocked"
        db.add(scan)
        log_security_event(
            db,
            event_type="critical_double_usage_attempt",
            ip_address=request.client.host if request.client else None,
            path=str(request.url.path),
            details={"message": f"ALERTE DOUBLE USAGE - COMMANDE #{order.id}", "vendor_id": payload.vendor_id},
        )
        db.commit()
        db.refresh(scan)
        used_iso = used_at.isoformat() if used_at else "date inconnue"
        return ReceiptVerifyResponse(
            order_id=order.id,
            status="blocked",
            message=f"RECU DEJA UTILISE le {used_iso}",
            scanned_at=scan.scanned_at,
        )

    order.status = "recu"
    scan.result = "accepted"
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return ReceiptVerifyResponse(
        order_id=order.id,
        status="claimed",
        message="QR VALIDE. COMMANDE MARQUEE COMME LIVREE.",
        scanned_at=scan.scanned_at,
    )
