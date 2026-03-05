from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.core.crypto import decrypt_payment_code, encrypt_payment_code, payment_code_hash
from app.core.csrf import enforce_csrf
from app.core.deps import get_admin_user, get_current_user, get_current_user_optional
from app.core.receipt_security import (
    create_receipt_access_token,
    decode_receipt_access_token,
    receipt_integrity_hash,
)
from app.core.rate_limit import enforce_rate_limit
from app.core.exceptions import UnauthorizedError, ValidationDomainError
from app.database import get_db
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.receipt_scan import ReceiptScan
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
from app.services.notification_service import send_payment_confirmation
from app.services.payment_security_service import verify_payment_code
from app.services.security_log_service import log_security_event

router = APIRouter(prefix="/orders", tags=["orders"])
settings = get_settings()


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
            for item in order.items
        ],
    }


def _resolve_order_for_receipt(db: Session, order_id: str) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.user))
    )


def _product_names(db: Session, order: Order) -> dict[str, str]:
    product_ids = [item.product_id for item in order.items]
    if not product_ids:
        return {}
    products = db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
    return {product.id: product.name for product in products}


def _to_receipt_response(
    request: Request,
    order: Order,
    customer_name: str,
    product_name_by_id: dict[str, str],
    digest: str,
    token: str,
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
    )


def _build_receipt_notification_links(
    request: Request,
    db: Session,
    order: Order,
) -> tuple[str, str]:
    customer_name = order.user.full_name if order.user else "Client AMAZER"
    names = _product_names(db, order)
    payload = _build_receipt_payload(order, customer_name, names)
    digest = receipt_integrity_hash(payload)
    token = create_receipt_access_token(order_id=order.id, digest=digest)
    base = str(request.base_url).rstrip("/")
    receipt_url = f"{base}/order/receipt/{order.id}?token={token}"
    verify_url = f"{base}{settings.api_prefix}/orders/receipt/verify?token={token}"
    return receipt_url, verify_url


@router.get("/me", response_model=list[OrderResponse])
def list_my_orders(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[OrderResponse]:
    orders = db.scalars(
        select(Order)
        .where(Order.user_id == current_user.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    ).all()
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
    total = sum(item.quantity * item.unit_price for item in payload.items)
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

    order = Order(
        user_id=current_user.id,
        payment_mode=payload.payment_mode,
        delivery_type=payload.delivery_type,
        transaction_code=encrypted_code,
        transaction_code_hash=code_hash,
        payment_reference=None,
        payment_status=payment_status,
        payment_confirmed_at=payment_confirmed_at,
        currency=payload.currency,
        total_amount=total,
        estimated_minutes=estimated_minutes,
        status=order_status,
    )
    for item in payload.items:
        order.items.append(
            OrderItem(
                product_id=item.product_id,
                vendor_id=item.vendor_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
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
    if order.payment_status == "paid":
        receipt_url, verify_url = _build_receipt_notification_links(request, db, order)
        send_payment_confirmation(
            recipient=current_user.email,
            order_id=order.id,
            amount=order.total_amount,
            receipt_url=receipt_url,
            qr_payload=verify_url,
        )
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
    receipt_url, verify_url = _build_receipt_notification_links(request, db, order)
    send_payment_confirmation(
        recipient=current_user.email,
        order_id=order.id,
        amount=order.total_amount,
        receipt_url=receipt_url,
        qr_payload=verify_url,
    )
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
    verify_url = f"/admin/receipt-scan?token={token}"
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

    return _to_receipt_response(
        request=request,
        order=order,
        customer_name=customer_name,
        product_name_by_id=names,
        digest=digest,
        token=token,
    )


@router.post("/receipt/verify", response_model=ReceiptVerifyResponse)
def verify_receipt_scan(
    payload: ReceiptVerifyRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> ReceiptVerifyResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="receipt_scan_verify", limit=20, window_seconds=60)
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

    customer_name = order.user.full_name if order.user else "Client AMAZER"
    digest = receipt_integrity_hash(_build_receipt_payload(order, customer_name, _product_names(db, order)))
    if claims.get("digest") != digest:
        raise UnauthorizedError("Receipt integrity check failed")

    scan = ReceiptScan(
        order_id=order.id,
        vendor_id=payload.vendor_id,
        ip_address=request.client.host if request.client else None,
        gps=payload.gps,
    )

    if order.status == "CLAIMED":
        used_at = db.scalar(
            select(ReceiptScan.scanned_at)
            .where(ReceiptScan.order_id == order.id, ReceiptScan.result == "accepted")
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
            details={"message": f"⚠️ TENTATIVE DE DOUBLE USAGE - COMMANDE #{order.id}", "vendor_id": payload.vendor_id},
        )
        db.commit()
        db.refresh(scan)
        used_iso = used_at.isoformat() if used_at else "date inconnue"
        return ReceiptVerifyResponse(
            order_id=order.id,
            status="blocked",
            message=f"❌ RECU DEJA UTILISE le {used_iso}",
            scanned_at=scan.scanned_at,
        )

    order.status = "CLAIMED"
    scan.result = "accepted"
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return ReceiptVerifyResponse(
        order_id=order.id,
        status="claimed",
        message="✅ Recu valide. Commande marquee comme retiree.",
        scanned_at=scan.scanned_at,
    )
