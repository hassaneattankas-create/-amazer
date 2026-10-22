from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.database import get_db
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreateRequest, ReviewResponse
from app.services.vendor_review_service import public_name

router = APIRouter(prefix="/products", tags=["reviews"])


@router.get("/{product_id}/reviews", response_model=list[ReviewResponse])
def list_reviews(
    product_id: Annotated[str, Path(min_length=1, max_length=36)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ReviewResponse]:
    reviews = db.scalars(
        select(Review)
        .where(Review.product_id == product_id)
        .order_by(Review.created_at.desc())
        .options(selectinload(Review.user))
        .limit(100)
    ).all()
    return [
        ReviewResponse(
            id=review.id,
            product_id=review.product_id,
            user_id=review.user_id,
            user_name=public_name(review.user),
            rating=review.rating,
            comment=review.comment,
            photo_url=review.photo_url,
            created_at=review.created_at,
        )
        for review in reviews
    ]


@router.post(
    "/{product_id}/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    payload: ReviewCreateRequest,
    product_id: Annotated[str, Path(min_length=1, max_length=36)],
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReviewResponse:
    enforce_csrf(request)
    product = db.get(Product, product_id)
    if product is None:
        raise NotFoundError("Product not found")
    # Avis verifies, comme pour les boutiques : seulement apres avoir recu ce produit, une fois.
    received = db.scalar(
        select(Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.user_id == current_user.id, OrderItem.product_id == product.id, Order.status.in_(("recu", "CLAIMED")))
        .limit(1)
    )
    if not received:
        raise ForbiddenError("Seuls les clients qui ont reçu ce produit peuvent laisser un avis.")
    if db.scalar(select(Review.id).where(Review.product_id == product.id, Review.user_id == current_user.id).limit(1)):
        raise ConflictError("Vous avez déjà donné votre avis sur ce produit.")

    review = Review(
        product_id=product.id,
        user_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment,
        photo_url=payload.photo_url,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return ReviewResponse(
        id=review.id,
        product_id=review.product_id,
        user_id=review.user_id,
        user_name=public_name(current_user),
        rating=review.rating,
        comment=review.comment,
        photo_url=review.photo_url,
        created_at=review.created_at,
    )
