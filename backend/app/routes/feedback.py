from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.csrf import enforce_csrf
from app.core.deps import get_admin_user, get_current_user_optional
from app.database import get_db
from app.models.customer_feedback import CustomerFeedback
from app.models.user import User
from app.schemas.feedback import FeedbackCreateRequest, FeedbackResponse
from app.services.audit_log_service import append_audit_log

router = APIRouter(prefix="/feedback", tags=["feedback"])
admin_router = APIRouter(prefix="/admin/feedback", tags=["admin-feedback"])


def _to_response(item: CustomerFeedback) -> FeedbackResponse:
    return FeedbackResponse(
        id=item.id,
        user_id=item.user_id,
        full_name=item.full_name,
        email=item.email,
        message=item.message,
        rating=item.rating,
        created_at=item.created_at,
    )


@router.get("", response_model=list[FeedbackResponse])
def list_feedback(
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=200)] = 60,
) -> list[FeedbackResponse]:
    rows = db.scalars(
        select(CustomerFeedback)
        .where(CustomerFeedback.is_visible.is_(True))
        .order_by(desc(CustomerFeedback.created_at))
        .limit(limit)
    ).all()
    return [_to_response(row) for row in rows]


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def create_feedback(
    payload: FeedbackCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
) -> FeedbackResponse:
    enforce_csrf(request)
    row = CustomerFeedback(
        user_id=current_user.id if current_user else None,
        full_name=payload.full_name,
        email=payload.email,
        message=payload.message,
        rating=payload.rating,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_response(row)


@admin_router.get("", response_model=list[FeedbackResponse])
def list_feedback_admin(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[FeedbackResponse]:
    rows = db.scalars(select(CustomerFeedback).order_by(desc(CustomerFeedback.created_at)).limit(limit)).all()
    return [_to_response(row) for row in rows]


@admin_router.delete("/{feedback_id}", status_code=status.HTTP_200_OK)
def hide_feedback_admin(
    feedback_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> dict[str, str]:
    enforce_csrf(request)
    row = db.get(CustomerFeedback, feedback_id)
    if row is None:
        return {"status": "ok"}
    row.is_visible = False
    append_audit_log(
        db,
        event_type="admin_feedback_hidden",
        actor=admin_user,
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        entity_type="customer_feedback",
        entity_id=row.id,
        details={},
    )
    db.commit()
    return {"status": "ok"}
