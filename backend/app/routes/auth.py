from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.core.deps import get_auth_service, get_current_user
from app.config import get_settings
from app.core.mfa import build_provisioning_uri, generate_totp_secret, verify_totp_code
from app.core.exceptions import UnauthorizedError
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MfaEnableRequest,
    MfaSetupResponse,
    MfaStatusResponse,
    RefreshTokenRequest,
    RegisterRequest,
    TokenPair,
)
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
        secure=True,
        samesite="strict",
        max_age=15 * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> User:
    enforce_rate_limit(request, key="auth_register", limit=5, window_seconds=300)
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
            mfa_code=payload.mfa_code,
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
def logout(response: Response) -> None:
    response.delete_cookie("access_token", path="/", secure=True, httponly=True, samesite="strict")
    response.delete_cookie("refresh_token", path="/", secure=True, httponly=True, samesite="strict")


@router.get("/mfa/status", response_model=MfaStatusResponse)
def mfa_status(
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    user: Annotated[User, Depends(get_current_user)],
) -> MfaStatusResponse:
    enabled, required = auth_service.get_mfa_status(user)
    return MfaStatusResponse(enabled=enabled, required_for_account=required)


@router.post("/mfa/setup", response_model=MfaSetupResponse)
def mfa_setup(
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    user: Annotated[User, Depends(get_current_user)],
) -> MfaSetupResponse:
    enforce_rate_limit(request, key="auth_mfa_setup", limit=4, window_seconds=300)
    secret = generate_totp_secret()
    auth_service.save_mfa_secret(user, secret, enabled=False)
    issuer = settings.app_name or "AMAZER"
    uri = build_provisioning_uri(secret=secret, email=user.email, issuer=issuer)
    auth_service.db.commit()
    return MfaSetupResponse(secret_key=secret, otpauth_url=uri, issuer=issuer, account=user.email)


@router.post("/mfa/enable", status_code=status.HTTP_204_NO_CONTENT)
def mfa_enable(
    payload: MfaEnableRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    enforce_rate_limit(request, key="auth_mfa_enable", limit=6, window_seconds=300)
    secret = auth_service.get_mfa_secret(user)
    if not secret:
        raise UnauthorizedError("MFA setup is required before activation")
    if not verify_totp_code(secret=secret, code=payload.code):
        raise UnauthorizedError("Invalid MFA code")
    auth_service.save_mfa_secret(user, secret, enabled=True)
    auth_service.db.commit()
