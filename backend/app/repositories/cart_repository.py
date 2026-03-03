from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.cart import Cart, CartItem


class CartRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_user_id(self, user_id: str) -> Cart | None:
        stmt = (
            select(Cart)
            .where(Cart.user_id == user_id)
            .options(selectinload(Cart.items))
        )
        return self.db.scalar(stmt)

    def get_or_create_for_user(self, user_id: str) -> Cart:
        cart = self.get_by_user_id(user_id)
        if cart:
            return cart

        cart = Cart(user_id=user_id)
        self.db.add(cart)
        self.db.flush()
        self.db.refresh(cart)
        return cart

    def get_item(self, cart_id: str, product_id: str) -> CartItem | None:
        stmt = select(CartItem).where(
            CartItem.cart_id == cart_id,
            CartItem.product_id == product_id,
        )
        return self.db.scalar(stmt)

    def get_item_by_id(self, cart_id: str, item_id: str) -> CartItem | None:
        stmt = select(CartItem).where(CartItem.cart_id == cart_id, CartItem.id == item_id)
        return self.db.scalar(stmt)

    def add_item(self, cart_id: str, product_id: str, quantity: int) -> CartItem:
        item = CartItem(cart_id=cart_id, product_id=product_id, quantity=quantity)
        self.db.add(item)
        self.db.flush()
        self.db.refresh(item)
        return item

    def delete_all_items(self, cart_id: str) -> None:
        cart = self.db.get(Cart, cart_id)
        if cart is not None:
            cart.items.clear()
            self.db.add(cart)
