from types import SimpleNamespace
from unittest.mock import Mock

from app.services.cart_service import CartService


def _build_service() -> tuple[CartService, Mock]:
    db = Mock()
    service = CartService(db=db)
    service.carts = Mock()
    service.products = Mock()
    return service, db


def test_add_item_existing_item_increases_quantity() -> None:
    service, db = _build_service()
    cart = SimpleNamespace(id="cart-1")
    item = SimpleNamespace(id="item-1", quantity=1)

    service.carts.get_or_create_for_user.return_value = cart
    service.products.get_by_id.return_value = SimpleNamespace(id="prod-1")
    service.carts.get_item.return_value = item

    service.add_item("user-1", "prod-1", 2)

    assert item.quantity == 3
    db.commit.assert_called_once()


def test_update_quantity_and_clear_cart_commit() -> None:
    service, db = _build_service()
    cart = SimpleNamespace(id="cart-1")
    item = SimpleNamespace(id="item-1", quantity=1)

    service.carts.get_or_create_for_user.return_value = cart
    service.carts.get_item_by_id.return_value = item

    service.update_quantity("user-1", "item-1", 5)
    assert item.quantity == 5

    service.clear_cart("user-1")
    assert db.commit.call_count == 2
