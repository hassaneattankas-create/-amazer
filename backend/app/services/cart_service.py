from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationDomainError
from app.models.cart import Cart
from app.repositories.cart_repository import CartRepository
from app.repositories.product_repository import ProductRepository


class CartService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.carts = CartRepository(db)
        self.products = ProductRepository(db)

    def get_cart(self, user_id: str) -> Cart:
        return self.carts.get_or_create_for_user(user_id)

    def add_item(self, user_id: str, product_id: str, quantity: int) -> Cart:
        if quantity < 1:
            raise ValidationDomainError("Quantity must be greater than 0")

        cart = self.carts.get_or_create_for_user(user_id)
        product = self.products.get_by_id(product_id)
        if product is None:
            raise NotFoundError("Product not found")

        existing = self.carts.get_item(cart.id, product_id)
        if existing is not None:
            existing.quantity += quantity
            self.db.add(existing)
        else:
            self.carts.add_item(cart.id, product_id, quantity)

        self.db.commit()
        return self.carts.get_or_create_for_user(user_id)

    def update_quantity(self, user_id: str, item_id: str, quantity: int) -> Cart:
        if quantity < 1:
            raise ValidationDomainError("Quantity must be greater than 0")

        cart = self.carts.get_or_create_for_user(user_id)
        item = self.carts.get_item_by_id(cart.id, item_id)
        if item is None:
            raise NotFoundError("Cart item not found")

        item.quantity = quantity
        self.db.add(item)
        self.db.commit()
        return self.carts.get_or_create_for_user(user_id)

    def clear_cart(self, user_id: str) -> Cart:
        cart = self.carts.get_or_create_for_user(user_id)
        self.carts.delete_all_items(cart.id)
        self.db.commit()
        return self.carts.get_or_create_for_user(user_id)
