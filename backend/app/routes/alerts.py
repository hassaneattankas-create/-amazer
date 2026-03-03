from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.price_alert import PriceAlert
from app.models.user import User
from app.schemas.alert import PriceAlertCreateRequest, PriceAlertResponse
from app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=PriceAlertResponse, status_code=status.HTTP_201_CREATED)
def create_alert(
    payload: PriceAlertCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PriceAlert:
    service = AlertService(db)
    return service.create_or_update_alert(
        user_id=current_user.id,
        product_id=payload.product_id,
        target_price=payload.target_price,
    )


@router.get("", response_model=list[PriceAlertResponse])
def list_alerts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[PriceAlert]:
    service = AlertService(db)
    return service.list_active_alerts(current_user.id)
