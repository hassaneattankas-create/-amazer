"""Sous-commandes par vendeur : statut propre a chaque boutique, statut global = le moins avance."""

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.models.order import Order, OrderFulfillment, OrderItem
from app.routes import orders as orders_route
from app.services.order_fulfillment_service import (
    create_initial_fulfillments,
    set_vendor_status,
    sync_fulfillments,
    vendor_status,
)


def _order(*vendor_ids: str, status: str = "commande") -> Order:
    order = Order(user_id="client-1", status=status, payment_status="paid")
    order.items = [
        OrderItem(product_id=f"p-{vendor_id}", vendor_id=vendor_id, quantity=1, unit_price=1000.0)
        for vendor_id in vendor_ids
    ]
    return order


def test_checkout_creates_one_fulfillment_per_vendor() -> None:
    order = _order("v1", "v2", "v1")
    create_initial_fulfillments(order)
    assert sorted((row.vendor_id, row.status) for row in order.fulfillments) == [("v1", "commande"), ("v2", "commande")]


def test_single_vendor_order_behaves_as_before() -> None:
    order = _order("v1")
    create_initial_fulfillments(order)
    set_vendor_status(order, "v1", "livraison")
    assert order.status == "livraison"


def test_global_status_follows_least_advanced_vendor() -> None:
    order = _order("v1", "v2")
    create_initial_fulfillments(order)

    set_vendor_status(order, "v1", "livraison")
    assert order.status == "commande"
    assert vendor_status(order, "v1") == "livraison"
    assert vendor_status(order, "v2") == "commande"

    set_vendor_status(order, "v2", "preparation")
    assert order.status == "preparation"

    set_vendor_status(order, "v2", "livraison")
    assert order.status == "livraison"


def test_legacy_order_without_fulfillments_starts_from_global_status() -> None:
    order = _order("v1", "v2", status="preparation")
    assert order.fulfillments == []

    set_vendor_status(order, "v1", "livraison")

    assert vendor_status(order, "v2") == "preparation"
    assert order.status == "preparation"


def test_global_event_applies_to_every_part() -> None:
    order = _order("v1", "v2")
    create_initial_fulfillments(order)
    set_vendor_status(order, "v1", "livraison")

    order.status = "recu"
    sync_fulfillments(order)

    assert {row.status for row in order.fulfillments} == {"recu"}


def test_non_fulfillment_status_is_not_propagated() -> None:
    order = _order("v1", "v2")
    create_initial_fulfillments(order)
    order.status = "CLAIMED"
    sync_fulfillments(order)
    assert {row.status for row in order.fulfillments} == {"commande"}


def test_unknown_status_rejected() -> None:
    order = _order("v1")
    with pytest.raises(ValueError):
        set_vendor_status(order, "v1", "expediee")


def test_customer_response_lists_parts_only_for_multi_vendor_orders() -> None:
    order = _order("v1", "v2")
    order.id = "order-1"
    order.payment_mode = "nita"
    order.delivery_type = "standard"
    order.estimated_minutes = 180
    order.total_amount = 2000.0
    order.currency = "XOF"
    order.created_at = datetime.now(UTC)
    for index, item in enumerate(order.items):
        item.id = f"item-{index}"
    order.fulfillments = [
        OrderFulfillment(vendor_id="v1", status="livraison"),
        OrderFulfillment(vendor_id="v2", status="commande"),
    ]
    order.fulfillments[0].vendor = SimpleNamespace(name="Boutique Une")

    response = orders_route._to_order_response(order)

    assert [(f.vendor_id, f.vendor_name, f.status) for f in response.fulfillments] == [
        ("v1", "Boutique Une", "livraison"),
        ("v2", None, "commande"),
    ]

    single = _order("v1")
    single.id, single.payment_mode, single.delivery_type = "order-2", "nita", "standard"
    single.estimated_minutes, single.total_amount, single.currency = 180, 1000.0, "XOF"
    single.created_at = datetime.now(UTC)
    single.items[0].id = "item-x"
    create_initial_fulfillments(single)
    assert orders_route._to_order_response(single).fulfillments == []
