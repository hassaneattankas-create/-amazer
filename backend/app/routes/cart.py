from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user
from app.database import get_db
from app.models.cart import Cart
from app.models.user import User
from app.schemas.cart import CartItemAddRequest, CartItemUpdateRequest, CartResponse
from app.services.cart_service import CartService

router = APIRouter(prefix="/cart", tags=["cart"])


@router.get("", response_model=CartResponse)
def get_cart(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Cart:
    service = CartService(db)
    return service.get_cart(current_user.id)


@router.post("/items", response_model=CartResponse, status_code=status.HTTP_200_OK)
def add_item(
    payload: CartItemAddRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Cart:
    enforce_csrf(request)
    service = CartService(db)
    return service.add_item(
        user_id=current_user.id,
        product_id=payload.product_id,
        quantity=payload.quantity,
    )


@router.patch("/items/{item_id}", response_model=CartResponse)
def update_quantity(
    item_id: str,
    payload: CartItemUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Cart:
    enforce_csrf(request)
    service = CartService(db)
    return service.update_quantity(
        user_id=current_user.id,
        item_id=item_id,
        quantity=payload.quantity,
    )


@router.delete("", response_model=CartResponse)
def clear_cart(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Cart:
    enforce_csrf(request)
    service = CartService(db)
    return service.clear_cart(current_user.id)
