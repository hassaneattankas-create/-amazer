from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.notification_service import NotificationService


router = APIRouter(prefix="/notifications", tags=["notifications"])


class RegisterNotificationTokenRequest(BaseModel):
    device_token: str = Field(min_length=8, max_length=512)


class RegisterNotificationTokenResponse(BaseModel):
    success: bool


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

