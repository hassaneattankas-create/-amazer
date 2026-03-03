from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.core.deps import get_auth_service, get_current_user
from app.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshTokenRequest, RegisterRequest, TokenPair
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.services.security_log_service import log_security_event

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_auth_cookies(response: Response, tokens: dict[str, str]) -> None:
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=settings.is_production(),
        samesite="strict",
        max_age=15 * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=settings.is_production(),
        samesite="strict",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> User:
    user = auth_service.register(
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password.get_secret_value(),
    )
    return user


@router.post("/login", response_model=TokenPair)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> dict[str, str]:
    enforce_rate_limit(request, key="auth_login", limit=6, window_seconds=60)
    try:
        tokens = auth_service.login(
            email=payload.email,
            password=payload.password.get_secret_value(),
        )
        _set_auth_cookies(response, tokens)
        return tokens
    except UnauthorizedError:
        log_security_event(
            auth_service.db,
            event_type="login_failed",
            ip_address=request.client.host if request.client else None,
            path=str(request.url.path),
            details={"email": payload.email},
        )
        auth_service.db.commit()
        raise


@router.post("/refresh", response_model=TokenPair)
def refresh(
    payload: RefreshTokenRequest,
    request: Request,
    response: Response,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> dict[str, str]:
    token = payload.refresh_token or request.cookies.get("refresh_token")
    if not token:
        raise UnauthorizedError("Missing refresh token")
    tokens = auth_service.refresh(token)
    _set_auth_cookies(response, tokens)
    return tokens


@router.get("/me", response_model=UserResponse)
def me(user: Annotated[User, Depends(get_current_user)]) -> User:
    return user


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
