import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.core.permissions import is_admin, is_courier
from app.core.crypto import decrypt_payment_code, encrypt_payment_code, payment_code_hash
from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user, get_current_user_optional
from app.core.receipt_security import (
    create_receipt_access_token,
    decode_receipt_access_token,
    receipt_integrity_hash,
)
from app.core.checkout_fees import marketplace_fees
from app.core.rate_limit import enforce_rate_limit
from app.core.exceptions import UnauthorizedError, ValidationDomainError
from app.database import get_db
from app.models.finance import FinanceDistrictFee
from app.models.global_settings import GlobalSettings
from app.models.order import Order, OrderFulfillment, OrderItem
from app.models.product import Price, Product
from app.models.receipt_scan import ReceiptScan
from app.models.reseller import ResellerListing
from app.services.order_delivery_service import mark_order_delivered
from app.services.reseller_account_service import reseller_terms, split_margin, subscription_active
from app.services.affiliate_service import customer_bonus_for_order, request_fingerprints
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.schemas.order import (
    CheckoutQuoteRequest,
    CheckoutQuoteResponse,
    CheckoutRequest,
    OrderFulfillmentResponse,
    OrderItemResponse,
    OrderResponse,
    ReceiptItemResponse,
    ReceiptLinkResponse,
    ReceiptResponse,
    PaymentConfirmRequest,
    PaymentConfirmResponse,
    PaymentIntentResponse,
    PaymentStartResponse,
    ReceiptVerifyRequest,
    ReceiptVerifyResponse,
)
from app.services import order_event_notifications as order_events
from app.services.notification_service import NotificationPayload, NotificationService
from app.services.audit_log_service import append_audit_log
from app.services.order_cancellation_service import cancel_order, ensure_not_cancelled, notify_order_cancelled
from app.services.order_fulfillment_service import create_initial_fulfillments, sync_fulfillments
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
from app.services.seller_finance_service import auto_receipt_hours, get_or_create_global_settings
from app.services.security_log_service import log_security_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["orders"])
settings = get_settings()


def _notify_new_order(db: Session, *, order: Order, customer: User) -> None:
    notif = NotificationService(db)
    tracking = order.tracking_code or order.id[:8].upper()
    amount = int(round(float(order.total_amount)))

    # Notification admin
    admin_user = db.scalar(select(User).where(User.email == settings.admin_email.strip().lower()))
    if admin_user is not None:
        notif.send_to_user(
            user_id=admin_user.id,
            payload=NotificationPayload(
                title="Nouvelle commande",
                body=f"#{tracking} — {amount} XOF via {order.payment_mode.upper()} de {customer.full_name or customer.email}.",
                data={"tag": f"admin-order-{order.id}", "href": "/admin", "kind": "new_order"},
            ),
        )

    # Notification vendeurs
    vendor_ids = {item.vendor_id for item in order.items}
    seller_profiles = db.scalars(
        select(SellerProfile).where(SellerProfile.vendor_id.in_(vendor_ids))
    ).all()
    shares = order_events.vendor_amounts(order)
    paid = order.payment_status == "paid"
    for profile in seller_profiles:
        share = shares.get(profile.vendor_id, amount)
        notif.send_to_user(
            user_id=profile.user_id,
            payload=NotificationPayload(
                title="Nouvelle commande pour votre boutique",
                body=(
                    f"Commande #{tracking} : {share} XOF pour vous. Paiement confirmé, vous pouvez la préparer."
                    if paid
                    else f"Commande #{tracking} : {share} XOF pour vous. Paiement en cours de vérification : attendez la confirmation avant de préparer."
                ),
                data={"tag": f"seller-order-{order.id}-{profile.vendor_id[:6]}", "href": "/seller/dashboard", "kind": "new_order"},
            ),
        )
    try:
        db.commit()
    except Exception:
        db.rollback()


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
                unit_price=item.customer_unit_price,
                subtotal=item.quantity * item.customer_unit_price,
            )
            for item in order.items
        ],
        fulfillments=[
            OrderFulfillmentResponse(
                vendor_id=row.vendor_id,
                vendor_name=row.vendor.name if row.vendor is not None else None,
                status=row.status,
            )
            for row in order.fulfillments
        ]
        if len(order.fulfillments) > 1
        else [],
    )


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
    """Normalize a Niger phone number to the provider's 00-country-code format."""
    compact = "".join(char for char in (phone or "") if char.isdigit())
    if compact.startswith("227") and len(compact) == 11:
        return f"00{compact}"
    if len(compact) == 8:
        return f"00227{compact}"
    raise ValidationDomainError("Un numero Niger valide est necessaire pour payer par Amana")


def _marketplace_fee_snapshot(order: Order) -> dict[str, float]:
    """Detail des frais pour le reçu (commandes récentes avec fee_breakdown, sinon estimation livraison)."""
    items_subtotal = sum(float(item.quantity) * float(item.unit_price) for item in order.items)
    fb = order.fee_breakdown
    if isinstance(fb, dict) and fb.get("items_subtotal") is not None:
        return {
            "items_subtotal": round(float(fb.get("items_subtotal", 0)), 2),
            "delivery_fee": round(float(fb.get("delivery_fee", 0)), 2),
            "platform_commission": round(float(fb.get("platform_commission", 0)), 2),
            "platform_service_fee": round(float(fb.get("platform_service_fee", 0)), 2),
        }
    extra = float(order.total_amount) - float(items_subtotal)
    return {
        "items_subtotal": round(items_subtotal, 2),
        "delivery_fee": round(max(0.0, extra), 2),
        "platform_commission": 0.0,
        "platform_service_fee": 0.0,
    }


def _resolve_reseller_listing(db: Session, listing_id: str | None, price: Price) -> ResellerListing | None:
    """Annonce de revente valide pour cette offre, sinon None (achat au prix normal)."""
    if not listing_id:
        return None
    listing = db.get(ResellerListing, listing_id)
    if listing is None or not listing.is_active or listing.price_id != price.id:
        return None
    # Abonnement revendeur expire : l'article est vendu au prix normal de la boutique.
    if not subscription_active(db, listing.reseller_user_id):
        return None
    return listing


def _build_receipt_payload(
    order: Order,
    customer_name: str,
    product_name_by_id: dict[str, str],
) -> dict[str, object]:
    fees = _marketplace_fee_snapshot(order)
    return {
        "order_id": order.id,
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
        "tracking_code": order.tracking_code,
        "transaction_code_hash": order.transaction_code_hash,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": product_name_by_id.get(item.product_id, f"Produit {item.product_id[:8]}"),
                "quantity": item.quantity,
                "unit_price": round(item.customer_unit_price, 2),
                "subtotal": round(item.quantity * item.customer_unit_price, 2),
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
    timeout_hours = auto_receipt_hours(db)
    if datetime.now(UTC) - reference_time < timedelta(hours=timeout_hours):
        return False
    vendor_ids = {item.vendor_id for item in order.items}
    resolved_vendor_id = next(iter(vendor_ids)) if len(vendor_ids) == 1 else None
    mark_order_delivered(db, order, source="auto")
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
        details={"order_id": order.id, "timeout_hours": timeout_hours},
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


def _consume_stock(db: Session, order: Order) -> None:
    """Retire du stock les articles d'une commande dont le paiement vient d'etre confirme.

    Le stock est pris au paiement et non au checkout : une commande jamais payee ne
    bloque rien. Si deux paiements se croisent, le stock s'arrete a 0 et l'ecart est
    journalise pour traitement manuel (l'argent est deja recu).
    """
    for item in order.items:
        price = db.scalar(
            select(Price)
            .where(Price.product_id == item.product_id, Price.vendor_id == item.vendor_id)
            .with_for_update()
        )
        if price is None:
            continue
        remaining = int(price.stock_quantity) - int(item.quantity)
        if remaining < 0:
            logger.warning(
                "Stock insuffisant a la confirmation du paiement (commande %s, produit %s, manque %s)",
                order.id,
                item.product_id,
                -remaining,
            )
        price.stock_quantity = max(0, remaining)


def _resolve_checkout_delivery_fee(db: Session, delivery_type: str, district: str | None = None) -> float:
    if district and delivery_type == "standard":
        zone_fee = db.scalar(
            select(FinanceDistrictFee.delivery_fee).where(FinanceDistrictFee.district_name == district.strip())
        )
        if zone_fee is not None:
            return float(zone_fee)
    settings_row = db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))
    if settings_row is None:
        return 1500.0
    if delivery_type == "express_niamey":
        return float(settings_row.urban_delivery_fee or settings_row.default_delivery_fee or 1500)
    return float(settings_row.default_delivery_fee or 1500)


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
    fees = _marketplace_fee_snapshot(order)
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
                product_id=item.product_id,
                product_name=product_name_by_id.get(item.product_id, f"Produit {item.product_id[:8]}"),
                quantity=item.quantity,
                unit_price=item.customer_unit_price,
                subtotal=item.quantity * item.customer_unit_price,
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
        .options(
            selectinload(Order.items),
            selectinload(Order.fulfillments).selectinload(OrderFulfillment.vendor),
        )
        .order_by(Order.created_at.desc())
    ).all()
    has_auto_updates = False
    for order in orders:
        if _auto_finalize_order_without_qr(db, order, request):
            has_auto_updates = True
    if has_auto_updates:
        db.commit()
    return [_to_order_response(order) for order in orders]


class _PricedCart:
    """Articles verifies et montants d'un panier (meme calcul pour le devis et la commande)."""

    def __init__(self) -> None:
        self.validated_items: list[tuple[Price, int, ResellerListing | None]] = []
        self.total = 0.0
        self.currency: str | None = None
        self.vendor_ids: set[str] = set()
        self.shipped_vendor_ids: set[str] = set()
        self.vendor_subtotals: dict[str, float] = {}


def _price_cart(db: Session, items: list, *, lock: bool) -> _PricedCart:
    cart = _PricedCart()
    for item in items:
        stmt = select(Price).where(
            Price.product_id == item.product_id,
            Price.vendor_id == item.vendor_id,
            Price.is_active.is_(True),
        )
        if lock:
            stmt = stmt.with_for_update()
        price = db.scalar(stmt.options(selectinload(Price.product), selectinload(Price.vendor)))
        if price is None or price.product is None or price.vendor is None:
            raise ValidationDomainError("Article indisponible")
        if not price.vendor.is_active:
            raise ValidationDomainError("Vendeur inactif")
        if price.stock_quantity < item.quantity:
            raise ValidationDomainError("Stock insuffisant pour cet article")
        if cart.currency is None:
            cart.currency = price.currency
        elif cart.currency != price.currency:
            raise ValidationDomainError("Les devises multiples ne sont pas supportees")
        listing = _resolve_reseller_listing(db, item.reseller_listing_id, price)
        unit_amount = max(float(listing.resale_amount), float(price.amount)) if listing else float(price.amount)
        line_total = unit_amount * item.quantity
        cart.total += line_total
        cart.vendor_subtotals[price.vendor_id] = cart.vendor_subtotals.get(price.vendor_id, 0.0) + line_total
        cart.validated_items.append((price, item.quantity, listing))
        cart.vendor_ids.add(price.vendor_id)
        # Produit numerique : pas de livraison. Un vendeur n'est facture que s'il a un article physique.
        if not (getattr(price.product, "specs", None) or {}).get("is_digital"):
            cart.shipped_vendor_ids.add(price.vendor_id)
    return cart


def _cart_fees(db: Session, cart: _PricedCart, delivery_type: str, district: str | None) -> dict[str, float]:
    delivery_total = _resolve_checkout_delivery_fee(db, delivery_type, district) * len(cart.shipped_vendor_ids)
    commission_fee, service_fee = marketplace_fees(db, get_or_create_global_settings(db), cart.vendor_subtotals)
    return {
        "items_subtotal": round(cart.total, 2),
        "delivery_fee": round(delivery_total, 2),
        "platform_commission": round(commission_fee, 2),
        "platform_service_fee": round(service_fee, 2),
        "total": round(cart.total + delivery_total + commission_fee + service_fee, 2),
    }


@router.post("/quote", response_model=CheckoutQuoteResponse)
def quote_checkout(
    payload: CheckoutQuoteRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> CheckoutQuoteResponse:
    """Montant exact avant commande (meme calcul que /checkout) : le panier affiche ce qui sera paye."""
    enforce_rate_limit(request, key="checkout_quote", limit=60, window_seconds=60)
    return CheckoutQuoteResponse(**_cart_fees(db, _price_cart(db, payload.items, lock=False), payload.delivery_type, payload.district))


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
    cart = _price_cart(db, payload.items, lock=True)
    validated_items = cart.validated_items
    order_currency = cart.currency
    vendor_ids = cart.vendor_ids
    encrypted_code: str | None = None
    code_hash: str | None = None
    payment_status = "pending"
    order_status = "payment_pending"
    payment_confirmed_at = None
    if payload.transaction_code:
        if not verify_payment_code(db, payload.transaction_code):
            raise ValidationDomainError("Transaction code already used")
        # Code declare par le client : conserve pour controle, jamais une preuve de paiement.
        encrypted_code = encrypt_payment_code(payload.transaction_code)
        code_hash = payment_code_hash(payload.transaction_code)

    if order_currency and payload.currency.upper() != order_currency:
        raise ValidationDomainError("Devise invalide pour cette commande")

    fees = _cart_fees(db, cart, payload.delivery_type, payload.district)
    total = fees.pop("total")
    fee_breakdown = fees

    # Affiliation : bonus fixe sur la premiere commande d'un nouveau client (jamais un % des ventes).
    affiliate_user_id, affiliate_amount = customer_bonus_for_order(
        db, current_user.id, payload.affiliate_code, request_fingerprints(request)[1]
    )

    order = Order(
        user_id=current_user.id,
        affiliate_user_id=affiliate_user_id if affiliate_amount > 0 else None,
        affiliate_commission=affiliate_amount,
        payment_mode=payload.payment_mode,
        delivery_type=payload.delivery_type,
        transaction_code=encrypted_code,
        transaction_code_hash=code_hash,
        payment_reference=None,
        payment_status=payment_status,
        payment_confirmed_at=payment_confirmed_at,
        currency=order_currency or payload.currency,
        total_amount=total,
        fee_breakdown=fee_breakdown,
        estimated_minutes=estimated_minutes,
        status=order_status,
        delivery_address=payload.delivery_address,
        delivery_phone=payload.delivery_phone,
        delivery_district=payload.district,
    )
    reseller_percent = reseller_terms(db)[1] if any(row[2] for row in validated_items) else 0.0
    for price, quantity, listing in validated_items:
        margin = (max(float(listing.resale_amount), float(price.amount)) - float(price.amount)) * quantity if listing else 0.0
        commission, _net = split_margin(margin, reseller_percent)
        order.items.append(
            OrderItem(
                product_id=price.product_id,
                vendor_id=price.vendor_id,
                quantity=quantity,
                unit_price=price.amount,
                reseller_listing_id=listing.id if listing else None,
                reseller_user_id=listing.reseller_user_id if listing else None,
                reseller_margin=round(margin, 2),
                reseller_commission=commission,
            )
        )

    create_initial_fulfillments(order)

    db.add(order)
    db.flush()
    if order.tracking_code is None:
        order.tracking_code = f"AMZ-{order.id[:8].upper()}"
    if order.payment_reference is None:
        order.payment_reference = _build_payment_reference(order.id)
    db.commit()
    db.refresh(order)

    # Notifier l'admin et les vendeurs concernes, puis confirmer au client (site + e-mail).
    _notify_new_order(db, order=order, customer=current_user)
    order_events.notify_order_placed(db, order)
    db.commit()

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
    payment_url = build_payment_page_url(order.id)
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


@router.post("/{order_id}/payment/start", response_model=PaymentStartResponse)
def start_order_payment(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaymentStartResponse:
    """Start an Amana transaction from trusted backend infrastructure only."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="payment_start", limit=6, window_seconds=300)
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise ValidationDomainError("Order not found")
    if order.user_id != current_user.id and not _is_admin(current_user):
        raise UnauthorizedError("Unauthorized order access")
    ensure_not_cancelled(order)
    if order.payment_status == "paid":
        return PaymentStartResponse(order_id=order.id, payment_status="paid", message="Paiement déjà confirmé.")
    if order.payment_mode != "amana":
        raise ValidationDomainError("Ce mode de paiement ne requiert pas Amana")
    if order.gateway_payment_reference:
        return PaymentStartResponse(
            order_id=order.id,
            payment_status="pending",
            message="Paiement Amana déjà lancé. Validez-le dans AmanaTa, puis vérifiez son statut.",
        )
    reference = order.payment_reference or _build_payment_reference(order.id)
    order.payment_reference = reference
    try:
        provider_reference = create_amana_payment(
            settings,
            GatewayPayment(
                reference=reference,
                amount_xof=int(round(order.total_amount)),
                description=f"Commande AMAZER {reference}",
                payer_phone=_amana_phone(current_user.whatsapp_phone),
            ),
        )
    except PaymentGatewayError as exc:
        raise ValidationDomainError("Impossible de demarrer le paiement Amana. Reessayez.") from exc
    order.gateway_payment_reference = provider_reference
    db.commit()
    return PaymentStartResponse(
        order_id=order.id,
        payment_status="pending",
        message="Paiement Amana lancé. Validez-le dans AmanaTa, puis vérifiez son statut.",
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
    ensure_not_cancelled(order)

    if order.payment_status == "paid":
        return PaymentConfirmResponse(
            order_id=order.id,
            payment_status="paid",
            order_status=order.status,
            message="Paiement déjà confirmé.",
        )

    if order.payment_mode == "amana":
        if not order.gateway_payment_reference:
            raise ValidationDomainError("Demarrez d'abord le paiement Amana")
        try:
            provider_status = get_amana_payment_status(settings, order.gateway_payment_reference)
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
            event_type="order_payment_manually_confirmed",
            actor=current_user,
            ip_address=request.client.host if request.client else None,
            path=str(request.url.path),
            entity_type="order",
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
    _consume_stock(db, order)
    order_events.notify_order_paid(db, order)

    db.commit()
    db.refresh(order)
    return PaymentConfirmResponse(
        order_id=order.id,
        payment_status=order.payment_status,
        order_status=order.status,
        message="Paiement confirmé.",
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


@router.post("/{order_id}/confirm-reception", response_model=OrderResponse)
def client_confirm_reception(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OrderResponse:
    """Le client confirme qu il a bien recu sa commande."""
    enforce_csrf(request)
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id).with_for_update())
    if order is None:
        raise ValidationDomainError("Commande introuvable")
    if order.user_id != current_user.id:
        raise UnauthorizedError("Acces non autorise")
    if order.status not in {"livraison", "commande", "preparation"}:
        raise ValidationDomainError("Cette commande ne peut pas etre confirmee dans son etat actuel")
    mark_order_delivered(db, order, source="customer")
    db.commit()
    db.refresh(order)
    return _to_order_response(order)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
def client_cancel_order(
    order_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OrderResponse:
    """Le client annule une commande qu'il n'a pas encore payee."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="order_cancel", limit=10, window_seconds=600)
    order = db.scalar(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.fulfillments))
        .where(Order.id == order_id)
        .with_for_update()
    )
    if order is None or order.user_id != current_user.id:
        raise ValidationDomainError("Commande introuvable")
    cancel_order(db, order, by_admin=False)
    append_audit_log(
        db,
        event_type="order_cancelled_by_customer",
        actor=current_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="order",
        entity_id=order.id,
        details={"payment_status": order.payment_status},
    )
    db.commit()
    db.refresh(order)
    notify_order_cancelled(db, order, by_admin=False)
    return _to_order_response(order)


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
    payment_url = build_payment_page_url(order.id)
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
    # Le livreur scanne le recu du client a la remise du colis (uniquement pour ses livraisons).
    is_courier_scan = not is_admin and seller_profile is None and is_courier(current_user)
    if not is_admin and seller_profile is None and not is_courier_scan:
        raise UnauthorizedError("Seller, courier or admin access required")
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
    if is_courier_scan:
        if order.courier_user_id != current_user.id:
            raise UnauthorizedError("Cette commande n'est pas dans vos livraisons.")
        resolved_vendor_id = None
    elif not is_admin:
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
        # Heure de Niamey (UTC+1), lisible par le livreur.
        used_iso = (used_at + timedelta(hours=1)).strftime("%d/%m/%Y à %H:%M") if used_at else "date inconnue"
        return ReceiptVerifyResponse(
            order_id=order.id,
            status="blocked",
            message=f"Reçu déjà utilisé (livraison confirmée le {used_iso}).",
            scanned_at=scan.scanned_at,
        )

    mark_order_delivered(db, order, source="qr_scan")
    scan.result = "accepted"
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return ReceiptVerifyResponse(
        order_id=order.id,
        status="claimed",
        message="QR valide : commande marquée comme livrée.",
        scanned_at=scan.scanned_at,
    )
