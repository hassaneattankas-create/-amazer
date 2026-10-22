"""Securite des paiements : aucune commande ne passe a "paid" sur simple declaration du client."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.crypto import decrypt_payment_code, payment_code_hash
from app.core.exceptions import UnauthorizedError, ValidationDomainError
from app.models.order import Order
from app.routes import orders as orders_route
from app.routes import restaurant as restaurant_route
from app.schemas.order import CheckoutItemRequest, CheckoutRequest, PaymentConfirmRequest
from app.services.payment_gateway_service import PaymentGatewayError


def _request() -> SimpleNamespace:
    return SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        url=SimpleNamespace(path="/api/v1/orders/order-1/payment/confirm"),
        headers={},
        cookies={},
    )


def _user(user_id: str = "client-1", email: str = "client@example.test") -> SimpleNamespace:
    return SimpleNamespace(id=user_id, email=email, full_name="Client Test", whatsapp_phone=None)


def _admin(module) -> SimpleNamespace:
    settings = getattr(module, "settings", None) or module._settings
    return _user("admin-1", settings.admin_email)


def _order(**overrides) -> SimpleNamespace:
    values = {
        "id": "order-1",
        "user_id": "client-1",
        "payment_mode": "nita",
        "payment_status": "pending",
        "status": "payment_pending",
        "payment_reference": "PAY-ORDER1",
        "gateway_payment_reference": None,
        "transaction_code": None,
        "transaction_code_hash": None,
        "payment_confirmed_at": None,
        "total_amount": 15000.0,
        "items": [],
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _db(order: SimpleNamespace, *, code_owner: str | None = None) -> Mock:
    """1er scalar = commande verrouillee ; suivants = recherche d'une reference deja utilisee."""
    db = Mock()
    db.scalar.side_effect = [order, code_owner, None]
    return db


@pytest.fixture(autouse=True)
def _no_side_effects(monkeypatch):
    for module in (orders_route, restaurant_route):
        monkeypatch.setattr(module, "enforce_csrf", lambda _request: None)
        monkeypatch.setattr(module, "enforce_rate_limit", lambda *args, **kwargs: None)
    audit_calls: list[dict] = []
    monkeypatch.setattr(orders_route, "append_audit_log", lambda *args, **kwargs: audit_calls.append(kwargs), raising=False)
    monkeypatch.setattr(restaurant_route, "append_audit_log", lambda *args, **kwargs: audit_calls.append(kwargs), raising=False)
    return audit_calls


CONFIRMERS = [
    pytest.param(orders_route, orders_route.confirm_order_payment, id="boutique"),
    pytest.param(restaurant_route, restaurant_route.confirm_restaurant_order_payment, id="restaurant"),
]


# 1. Le client ne peut pas confirmer lui-meme son paiement.
@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_client_cannot_self_confirm_payment(module, confirm) -> None:
    order = _order()
    db = _db(order)

    response = confirm(
        "order-1",
        PaymentConfirmRequest(provider_reference="WAVE-123456"),
        _request(),
        db,
        _user(),
    )

    assert response.payment_status == "pending"
    assert order.payment_status == "pending"
    assert order.status == "payment_pending"
    assert order.payment_confirmed_at is None
    # La reference declaree est conservee chiffree pour le controle admin.
    assert decrypt_payment_code(order.transaction_code) == "WAVE-123456"
    assert order.transaction_code_hash == payment_code_hash("WAVE-123456")


@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_client_confirm_without_reference_stays_pending(module, confirm) -> None:
    order = _order()
    response = confirm("order-1", PaymentConfirmRequest(code_last4="1234"), _request(), _db(order), _user())

    assert response.payment_status == "pending"
    assert order.payment_status == "pending"
    assert order.transaction_code is None


# 2. Un code de transaction arbitraire au checkout ne rend pas la commande payee.
def test_checkout_with_arbitrary_transaction_code_stays_pending(monkeypatch) -> None:
    monkeypatch.setattr(orders_route, "_resolve_checkout_delivery_fee", lambda *_args: 0.0)
    monkeypatch.setattr(orders_route, "get_or_create_global_settings", lambda _db: SimpleNamespace())
    monkeypatch.setattr(orders_route, "marketplace_fees", lambda *args: (0.0, 0.0))
    monkeypatch.setattr(orders_route, "customer_bonus_for_order", lambda *a: (None, 0.0))
    monkeypatch.setattr(orders_route, "_notify_new_order", lambda *args, **kwargs: None)
    monkeypatch.setattr(orders_route, "_to_order_response", lambda order: order)

    price = SimpleNamespace(
        product_id="product-1",
        vendor_id="vendor-1",
        amount=5000.0,
        currency="XOF",
        stock_quantity=10,
        product=SimpleNamespace(id="product-1"),
        vendor=SimpleNamespace(id="vendor-1", is_active=True),
    )
    db = Mock()
    db.scalar.side_effect = [price, None, None]

    def _flush() -> None:
        created = db.add.call_args.args[0]
        created.id = "order-new-1"

    db.flush.side_effect = _flush

    order = orders_route.checkout(
        CheckoutRequest(
            items=[CheckoutItemRequest(product_id="product-1", vendor_id="vendor-1", quantity=1, unit_price=1)],
            payment_mode="nita",
            transaction_code="CODE-INVENTE-999",
        ),
        _request(),
        db,
        _user(),
    )

    assert isinstance(order, Order)
    assert order.payment_status == "pending"
    assert order.status == "payment_pending"
    assert order.payment_confirmed_at is None
    assert order.transaction_code_hash == payment_code_hash("CODE-INVENTE-999")


# 3. Un code deja utilise ne peut pas etre reutilise.
def test_checkout_rejects_reused_transaction_code(monkeypatch) -> None:
    price = SimpleNamespace(
        product_id="product-1",
        vendor_id="vendor-1",
        amount=5000.0,
        currency="XOF",
        stock_quantity=10,
        product=SimpleNamespace(id="product-1"),
        vendor=SimpleNamespace(id="vendor-1", is_active=True),
    )
    db = Mock()
    db.scalar.side_effect = [price, "autre-commande", None]

    with pytest.raises(ValidationDomainError, match="already used"):
        orders_route.checkout(
            CheckoutRequest(
                items=[CheckoutItemRequest(product_id="product-1", vendor_id="vendor-1", quantity=1, unit_price=1)],
                transaction_code="CODE-DEJA-PRIS",
            ),
            _request(),
            db,
            _user(),
        )
    db.add.assert_not_called()


@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_client_cannot_declare_reference_used_elsewhere(module, confirm) -> None:
    order = _order()
    with pytest.raises(ValidationDomainError, match="already used"):
        confirm(
            "order-1",
            PaymentConfirmRequest(provider_reference="WAVE-DEJA-PRIS"),
            _request(),
            _db(order, code_owner="autre-commande"),
            _user(),
        )
    assert order.transaction_code is None


@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_admin_cannot_confirm_with_reference_used_elsewhere(module, confirm) -> None:
    order = _order()
    with pytest.raises(ValidationDomainError, match="already used"):
        confirm(
            "order-1",
            PaymentConfirmRequest(provider_reference="WAVE-DEJA-PRIS"),
            _request(),
            _db(order, code_owner="autre-commande"),
            _admin(module),
        )
    assert order.payment_status == "pending"


# 4. Un utilisateur non autorise ne peut pas confirmer un paiement.
@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_other_user_cannot_confirm_payment(module, confirm) -> None:
    order = _order()
    with pytest.raises(UnauthorizedError):
        confirm(
            "order-1",
            PaymentConfirmRequest(provider_reference="WAVE-123456"),
            _request(),
            _db(order),
            _user("intrus-1", "intrus@example.test"),
        )
    assert order.payment_status == "pending"


# 5. L'admin confirme uniquement avec une reference operateur verifiee.
@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_admin_must_provide_operator_reference(module, confirm) -> None:
    order = _order()
    with pytest.raises(ValidationDomainError, match="obligatoire"):
        confirm("order-1", PaymentConfirmRequest(), _request(), _db(order), _admin(module))
    assert order.payment_status == "pending"


@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_admin_confirms_with_operator_reference_and_is_audited(module, confirm, _no_side_effects) -> None:
    order = _order()
    response = confirm(
        "order-1",
        PaymentConfirmRequest(provider_reference="NITA-778899"),
        _request(),
        _db(order),
        _admin(module),
    )

    assert response.payment_status == "paid"
    assert order.payment_status == "paid"
    assert order.status == "commande"
    assert order.payment_confirmed_at is not None
    assert order.transaction_code_hash == payment_code_hash("NITA-778899")
    assert len(_no_side_effects) == 1
    assert _no_side_effects[0]["entity_id"] == "order-1"
    assert _no_side_effects[0]["details"]["provider_reference_last4"] == "8899"


@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_admin_can_confirm_reference_declared_by_client_on_same_order(module, confirm) -> None:
    order = _order(transaction_code_hash=payment_code_hash("WAVE-123456"))
    # La recherche exclut la commande elle-meme : aucune autre commande ne porte ce code.
    response = confirm(
        "order-1",
        PaymentConfirmRequest(provider_reference="WAVE-123456"),
        _request(),
        _db(order),
        _admin(module),
    )
    assert response.payment_status == "paid"


# 6. Amana : seul le statut fourni par la passerelle fait foi.
@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_amana_success_confirms_payment(module, confirm, monkeypatch) -> None:
    monkeypatch.setattr(module, "get_amana_payment_status", lambda _settings, _ref: "SUCCESS")
    order = _order(payment_mode="amana", gateway_payment_reference="GW-42")

    response = confirm("order-1", PaymentConfirmRequest(), _request(), _db(order), _user())

    assert response.payment_status == "paid"
    assert order.status == "commande"
    assert order.transaction_code_hash == payment_code_hash("AMANA-GW-42")


@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_amana_pending_stays_pending(module, confirm, monkeypatch) -> None:
    monkeypatch.setattr(module, "get_amana_payment_status", lambda _settings, _ref: "PENDING")
    order = _order(payment_mode="amana", gateway_payment_reference="GW-42")

    response = confirm(
        "order-1",
        PaymentConfirmRequest(provider_reference="FAUX-SUCCES"),
        _request(),
        _db(order),
        _user(),
    )

    assert response.payment_status == "pending"
    assert order.payment_status == "pending"


@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_amana_gateway_failure_never_confirms(module, confirm, monkeypatch) -> None:
    def _boom(_settings, _ref):
        raise PaymentGatewayError("down")

    monkeypatch.setattr(module, "get_amana_payment_status", _boom)
    order = _order(payment_mode="amana", gateway_payment_reference="GW-42")

    with pytest.raises(ValidationDomainError):
        confirm("order-1", PaymentConfirmRequest(), _request(), _db(order), _user())
    assert order.payment_status == "pending"


@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_amana_requires_started_payment(module, confirm) -> None:
    order = _order(payment_mode="amana")
    with pytest.raises(ValidationDomainError, match="Demarrez"):
        confirm("order-1", PaymentConfirmRequest(), _request(), _db(order), _user())


# 7. Non-regression : une commande deja payee n'est pas modifiee.
@pytest.mark.parametrize(("module", "confirm"), CONFIRMERS)
def test_already_paid_order_is_untouched(module, confirm) -> None:
    original_hash = payment_code_hash("AMANA-GW-1")
    order = _order(payment_status="paid", status="livraison", transaction_code_hash=original_hash)

    response = confirm(
        "order-1",
        PaymentConfirmRequest(provider_reference="AUTRE-REF"),
        _request(),
        _db(order),
        _user(),
    )

    assert response.payment_status == "paid"
    assert order.status == "livraison"
    assert order.transaction_code_hash == original_hash


# Le client sait a quel numero AMAZER envoyer un transfert Nita.
def test_payment_intent_exposes_platform_wallet_and_real_payment_page(monkeypatch) -> None:
    order = _order(payment_reference="PAY-ORDER1", currency="XOF")
    monkeypatch.setattr(orders_route, "_resolve_order_for_receipt", lambda _db, _id: order)
    monkeypatch.setattr(orders_route, "_resolve_platform_wallet_phone", lambda _db: "+22790000000")

    intent = orders_route.get_payment_intent("order-1", Mock(), _user())

    assert intent.platform_wallet_phone == "+22790000000"
    assert intent.payment_url.endswith("/order/pay/order-1")
    assert "pay.amazer.ne" not in intent.payment_url
