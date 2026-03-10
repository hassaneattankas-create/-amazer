from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, UnauthorizedError
from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService

http_bearer = HTTPBearer(auto_error=False)


def get_auth_service(db: Annotated[Session, Depends(get_db)]) -> AuthService:
    return AuthService(db)


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> User:
    token = credentials.credentials if credentials else request.cookies.get("access_token")
    if not token:
        raise UnauthorizedError("Authorization header is missing")
    try:
        return auth_service.get_current_user(token)
    except DomainError:
        raise
    except ValueError as exc:
        raise UnauthorizedError("Invalid token") from exc


def get_current_user_optional(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> User | None:
    token = credentials.credentials if credentials else request.cookies.get("access_token")
    if not token:
        return None
    try:
        return auth_service.get_current_user(token)
    except Exception:
        return None


def _require_admin(current_user: User, db: Session) -> User:
    settings = get_settings()
    if current_user.email.lower() != settings.admin_email.lower():
        raise UnauthorizedError("Admin access required")
    return current_user


def get_admin_user(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    return _require_admin(current_user, db)


def get_seller_user(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    return current_user
