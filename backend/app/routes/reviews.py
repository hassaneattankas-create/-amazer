from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.database import get_db
from app.models.product import Product
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreateRequest, ReviewResponse

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
    ).all()
    return [
        ReviewResponse(
            id=review.id,
            product_id=review.product_id,
            user_id=review.user_id,
            user_name=review.user.full_name,
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
        user_name=current_user.full_name,
        rating=review.rating,
        comment=review.comment,
        photo_url=review.photo_url,
        created_at=review.created_at,
    )
