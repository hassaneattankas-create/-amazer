from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select

from app.core.deps import get_auth_service, get_current_user
from app.core.csrf import enforce_csrf, generate_csrf_token
from app.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.schemas.auth import (
    DeleteAccountRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    RegisterResponse,
    TokenPair,
    UserPreferencesResponse,
    UserPreferencesUpdateRequest,
    VerifyAccountRequest,
    VerifyAccountResponse,
)
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.services.security_log_service import log_security_event

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_auth_cookies(response: Response, tokens: dict[str, str]) -> None:
    secure_cookie = settings.is_production()
    same_site = "none" if secure_cookie else "lax"
    csrf_token = generate_csrf_token()
    access_max_age = settings.jwt_access_token_expire_minutes * 60
    refresh_max_age = settings.jwt_refresh_token_expire_days * 24 * 60 * 60
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=secure_cookie,
        samesite=same_site,
        max_age=access_max_age,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=secure_cookie,
        samesite=same_site,
        max_age=refresh_max_age,
        path="/",
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=secure_cookie,
        samesite=same_site,
        max_age=7 * 24 * 60 * 60,
        path="/",
    )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> dict[str, str | bool | None]:
    enforce_rate_limit(request, key="auth_register", limit=5, window_seconds=300)
    return auth_service.register(
        identifier=payload.identifier or payload.email or payload.whatsapp_phone or "",
        full_name=payload.full_name,
        password=payload.password.get_secret_value(),
        seller_profile=payload.seller_profile.model_dump(exclude_none=True) if payload.seller_profile else None,
    )


@router.post("/verify-account", response_model=VerifyAccountResponse)
def verify_account(
    payload: VerifyAccountRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> dict[str, str | bool]:
    enforce_rate_limit(request, key="auth_verify_account", limit=8, window_seconds=300)
    return auth_service.verify_account(identifier=payload.identifier, code=payload.code)


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
            identifier=payload.identifier or payload.email or "",
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
            details={"identifier": payload.identifier},
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
    enforce_rate_limit(request, key="auth_refresh", limit=20, window_seconds=300)
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
def logout(
    request: Request,
    response: Response,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    enforce_csrf(request)
    auth_service.refresh_tokens.revoke_all_for_user(user.id)
    auth_service.db.commit()
    secure_cookie = settings.is_production()
    same_site = "none" if secure_cookie else "lax"
    response.delete_cookie("access_token", path="/", secure=secure_cookie, httponly=True, samesite=same_site)
    response.delete_cookie("refresh_token", path="/", secure=secure_cookie, httponly=True, samesite=same_site)
    response.delete_cookie("csrf_token", path="/", secure=secure_cookie, httponly=False, samesite=same_site)


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    request: Request,
    response: Response,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    enforce_csrf(request)
    enforce_rate_limit(request, key="auth_delete_account", limit=4, window_seconds=600)
    auth_service.close_account(user=user, password=payload.password.get_secret_value())
    log_security_event(
        auth_service.db,
        event_type="account_deleted_by_user",
        ip_address=request.client.host if request.client else None,
        path=str(request.url.path),
        details={"user_id": user.id},
    )
    auth_service.db.commit()
    secure_cookie = settings.is_production()
    same_site = "none" if secure_cookie else "lax"
    response.delete_cookie("access_token", path="/", secure=secure_cookie, httponly=True, samesite=same_site)
    response.delete_cookie("refresh_token", path="/", secure=secure_cookie, httponly=True, samesite=same_site)
    response.delete_cookie("csrf_token", path="/", secure=secure_cookie, httponly=False, samesite=same_site)


def _get_or_create_preferences(auth_service: AuthService, user: User) -> UserPreferences:
    row = auth_service.db.scalar(select(UserPreferences).where(UserPreferences.user_id == user.id))
    if row is None:
        row = UserPreferences(user_id=user.id, preferred_currency="XOF")
        auth_service.db.add(row)
        auth_service.db.commit()
        auth_service.db.refresh(row)
    return row


@router.get("/preferences", response_model=UserPreferencesResponse)
def get_preferences(
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    user: Annotated[User, Depends(get_current_user)],
) -> UserPreferencesResponse:
    row = _get_or_create_preferences(auth_service, user)
    if row.preferred_currency.upper() != "XOF":
        row.preferred_currency = "XOF"
        auth_service.db.commit()
        auth_service.db.refresh(row)
    return UserPreferencesResponse(preferred_currency=row.preferred_currency)


@router.put("/preferences", response_model=UserPreferencesResponse)
def update_preferences(
    payload: UserPreferencesUpdateRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    user: Annotated[User, Depends(get_current_user)],
) -> UserPreferencesResponse:
    enforce_csrf(request)
    row = _get_or_create_preferences(auth_service, user)
    row.preferred_currency = "XOF"
    auth_service.db.commit()
    auth_service.db.refresh(row)
    return UserPreferencesResponse(preferred_currency=row.preferred_currency)
