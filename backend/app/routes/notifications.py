from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.app_notification import AppNotification
from app.models.user import User
from app.services.notification_service import NotificationService


router = APIRouter(prefix="/notifications", tags=["notifications"])


class RegisterNotificationTokenRequest(BaseModel):
    device_token: str = Field(min_length=8, max_length=512)


class RegisterNotificationTokenResponse(BaseModel):
    success: bool


class AppNotificationResponse(BaseModel):
    id: str
    title: str
    body: str
    tag: str
    href: str | None = None
    data: dict | None = None
    unread: bool
    created_at: datetime


class MarkNotificationReadResponse(BaseModel):
    success: bool


class MarkAllNotificationsReadResponse(BaseModel):
    success: bool
    updated: int


class ClearNotificationsResponse(BaseModel):
    success: bool
    deleted: int


def _to_notification_response(row: AppNotification) -> AppNotificationResponse:
    return AppNotificationResponse(
        id=row.id,
        title=row.title,
        body=row.body,
        tag=row.tag,
        href=row.href,
        data=row.data,
        unread=bool(row.unread),
        created_at=row.created_at,
    )


@router.post(
    "/register-token",
    response_model=RegisterNotificationTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_notification_token(
    payload: RegisterNotificationTokenRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> RegisterNotificationTokenResponse:
    service = NotificationService(db)
    service.register_token(user_id=user.id, device_token=payload.device_token.strip())
    db.commit()
    return RegisterNotificationTokenResponse(success=True)


@router.get("", response_model=list[AppNotificationResponse])
def list_notifications(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 100,
    offset: int = 0,
) -> list[AppNotificationResponse]:
    service = NotificationService(db)
    rows = service.list_notifications_for_user(user.id, limit=limit, offset=max(0, offset))
    return [_to_notification_response(row) for row in rows]


@router.post("/{notification_id}/read", response_model=MarkNotificationReadResponse)
def mark_notification_read(
    notification_id: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MarkNotificationReadResponse:
    service = NotificationService(db)
    ok = service.mark_notification_read(user_id=user.id, notification_id=notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    db.commit()
    return MarkNotificationReadResponse(success=True)


@router.post("/mark-all-read", response_model=MarkAllNotificationsReadResponse)
def mark_all_notifications_read(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MarkAllNotificationsReadResponse:
    service = NotificationService(db)
    updated = service.mark_all_notifications_read(user_id=user.id)
    db.commit()
    return MarkAllNotificationsReadResponse(success=True, updated=updated)


@router.delete("", response_model=ClearNotificationsResponse)
def clear_notifications(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ClearNotificationsResponse:
    service = NotificationService(db)
    deleted = service.clear_notifications(user_id=user.id)
    db.commit()
    return ClearNotificationsResponse(success=True, deleted=deleted)

