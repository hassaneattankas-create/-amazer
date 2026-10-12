"""Etape P1 : IP reelle derriere le proxy, compte admin reserve, stock au paiement, commandes non payees."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.config import get_settings
from app.core.exceptions import ConflictError
from app.core.rate_limit import client_ip
from app.routes import orders as orders_route
from app.routes import seller as seller_route
from app.schemas.order import PaymentConfirmRequest
from app.schemas.seller import SellerShopOrderStatusUpdateRequest
from app.services.auth_service import AuthService


def _request(peer: str, forwarded: str | None = None) -> SimpleNamespace:
    headers = {"x-forwarded-for": forwarded} if forwarded else {}
    return SimpleNamespace(client=SimpleNamespace(host=peer), headers=headers)


# --- IP reelle -----------------------------------------------------------------

def test_client_ip_uses_forwarded_header_behind_private_proxy() -> None:
    assert client_ip(_request("10.201.4.7", "41.203.10.20, 10.201.4.7")) == "41.203.10.20"


def test_client_ip_ignores_forwarded_header_on_direct_public_connection() -> None:
    # Connexion directe : l'en-tete est falsifiable, on garde l'IP reelle du pair.
    assert client_ip(_request("41.203.10.20", "1.2.3.4")) == "41.203.10.20"


def test_client_ip_without_header_or_client() -> None:
    assert client_ip(_request("10.0.0.5")) == "10.0.0.5"
    assert client_ip(SimpleNamespace(client=None, headers={})) == "unknown"


# --- Compte admin reserve --------------------------------------------------------

def test_public_registration_cannot_claim_admin_email() -> None:
    db = Mock()
    db.scalar.return_value = None  # aucun compte existant
    admin_email = get_settings().admin_email.upper()

    with pytest.raises(ConflictError):
        AuthService(db).register(identifier=admin_email, full_name="Intrus", password="MotDePasse!2026")
    db.add.assert_not_called()
    db.commit.assert_not_called()


# --- Stock pris a la confirmation du paiement ---------------------------------------

def _price(stock: int) -> SimpleNamespace:
    return SimpleNamespace(stock_quantity=stock)


def test_consume_stock_decrements_each_line() -> None:
    first, second = _price(10), _price(3)
    db = Mock()
    db.scalar.side_effect = [first, second]
    order = SimpleNamespace(
        id="order-1",
        items=[
            SimpleNamespace(product_id="p1", vendor_id="v1", quantity=4),
            SimpleNamespace(product_id="p2", vendor_id="v2", quantity=1),
        ],
    )

    orders_route._consume_stock(db, order)

    assert first.stock_quantity == 6
    assert second.stock_quantity == 2


def test_consume_stock_never_goes_negative() -> None:
    price = _price(1)
    db = Mock()
    db.scalar.return_value = price
    order = SimpleNamespace(id="order-1", items=[SimpleNamespace(product_id="p1", vendor_id="v1", quantity=3)])

    orders_route._consume_stock(db, order)

    assert price.stock_quantity == 0


def test_confirmed_payment_consumes_stock_and_pending_does_not(monkeypatch) -> None:
    monkeypatch.setattr(orders_route, "enforce_csrf", lambda _request: None)
    monkeypatch.setattr(orders_route, "enforce_rate_limit", lambda *args, **kwargs: None)
    item = SimpleNamespace(product_id="p1", vendor_id="v1", quantity=2)

    def _order() -> SimpleNamespace:
        return SimpleNamespace(
            id="order-1", user_id="client-1", payment_mode="amana", payment_status="pending",
            status="payment_pending", payment_reference="PAY-1", gateway_payment_reference="GW-1",
            transaction_code=None, transaction_code_hash=None, payment_confirmed_at=None,
            total_amount=1000.0, items=[item],
        )

    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/x"), headers={})
    client = SimpleNamespace(id="client-1", email="client@example.test")

    # Paiement en attente cote passerelle : stock intact.
    monkeypatch.setattr(orders_route, "get_amana_payment_status", lambda _s, _r: "PENDING")
    pending_price = _price(5)
    db = Mock()
    db.scalar.side_effect = [_order(), pending_price]
    orders_route.confirm_order_payment("order-1", PaymentConfirmRequest(), request, db, client)
    assert pending_price.stock_quantity == 5

    # Paiement confirme : stock decremente.
    monkeypatch.setattr(orders_route, "get_amana_payment_status", lambda _s, _r: "SUCCESS")
    paid_price = _price(5)
    db = Mock()
    db.scalar.side_effect = [_order(), paid_price]
    orders_route.confirm_order_payment("order-1", PaymentConfirmRequest(), request, db, client)
    assert paid_price.stock_quantity == 3


# --- Le vendeur ne traite pas une commande non payee ----------------------------------

@pytest.mark.parametrize(("payment_status", "allowed"), [("pending", False), ("paid", True)])
def test_seller_cannot_advance_unpaid_order(monkeypatch, payment_status: str, allowed: bool) -> None:
    monkeypatch.setattr(seller_route, "enforce_csrf", lambda _request: None)
    monkeypatch.setattr(seller_route, "_seller_shop_order_response", lambda order, *_a, **_k: order)
    order = SimpleNamespace(
        id="order-1",
        status="commande",
        payment_status=payment_status,
        items=[SimpleNamespace(vendor_id="vendor-1", product_id="p1")],
    )
    db = Mock()
    db.scalar.side_effect = [SimpleNamespace(vendor_id="vendor-1"), order]
    db.scalars.return_value.all.return_value = []
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})
    seller = SimpleNamespace(id="seller-1", email="seller@example.test")

    if allowed:
        seller_route.update_seller_order_status(
            "order-1", SellerShopOrderStatusUpdateRequest(status="preparation"), request, db, seller
        )
        assert order.status == "preparation"
    else:
        with pytest.raises(ConflictError):
            seller_route.update_seller_order_status(
                "order-1", SellerShopOrderStatusUpdateRequest(status="preparation"), request, db, seller
            )
        assert order.status == "commande"
