"""Le client retrouve ses commandes restaurant (paiement a terminer, suivi)."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

from app.routes import restaurant as route


def test_customer_lists_own_restaurant_orders() -> None:
    item = SimpleNamespace(id="i1", menu_item_id="d1", quantity=2, selected_options=[], customer_note=None, unit_price=1500.0, subtotal=3000.0)
    order = SimpleNamespace(
        id="o1", vendor_id="v1", customer_name="Awa", customer_phone="+22790000000", delivery_address="Plateau", distance_km=2.5,
        delivery_fee=1000.0, delivery_minutes=30, payment_mode="nita", payment_reference="RST-1", payment_status="pending",
        status="payment_pending", total_amount=4200.0, currency="XOF", created_at=datetime.now(UTC), items=[item], fee_breakdown=None,
    )
    results = iter([[order], [SimpleNamespace(id="v1", name="Chez Mariama")], [SimpleNamespace(id="d1", name="Riz sauce")]])
    db = Mock()
    db.scalars.side_effect = lambda _q: SimpleNamespace(all=lambda: next(results))
    [row] = route.list_my_restaurant_orders(db, SimpleNamespace(id="u1"))
    assert (row.vendor_name, row.items[0].dish_name, row.payment_status) == ("Chez Mariama", "Riz sauce", "pending")
