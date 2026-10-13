from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import get_settings
from app.core.permissions import is_admin
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.admin import AdminMeResponse

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()


@router.get("/me", response_model=AdminMeResponse)
def admin_me(current_user: Annotated[User, Depends(get_current_user)]) -> AdminMeResponse:
    return AdminMeResponse(is_admin=is_admin(current_user), email=current_user.email)

