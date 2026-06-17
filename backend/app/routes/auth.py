from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select

from app.core.deps import get_auth_service, get_current_user
from app.core.cache import cache_delete_prefixes
from app.core.csrf import enforce_csrf, generate_csrf_token
from app.config import get_settings
from app.core.exceptions import NotFoundError, UnauthorizedError
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
from app.schemas.finance import (
    SellerPreRegisterRequest,
    SellerPreRegisterResponse,
    SellerPreRegisterStatusResponse,
)
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.models.seller_pending_registration import SellerPendingRegistration
from app.core.security import hash_password
from app.services.notification_service import NotificationPayload, NotificationService
from app.services.security_log_service import log_security_event
from app.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _invalidate_public_marketplace_cache() -> None:
    cache_delete_prefixes("catalog:", "content:")


def _notify_admin_seller_registration(
    auth_service: AuthService,
    *,
    user_id: str | None,
    identifier: str,
    full_name: str,
) -> None:
    admin_email = settings.admin_email.strip().lower()
    admin_user = auth_service.db.scalar(select(User).where(User.email == admin_email))
    if admin_user is None:
        return
    NotificationService(auth_service.db).send_to_user(
        user_id=admin_user.id,
        payload=NotificationPayload(
            title="Nouveau compte vendeur",
            body=f"{full_name} a cree un compte vendeur ({identifier.strip()}).",
            data={
                "tag": f"seller-register-{user_id or identifier.strip().lower()}",
                "href": "/admin/users",
                "kind": "seller_registration",
            },
        ),
    )


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
    result = auth_service.register(
        identifier=payload.identifier or payload.email or payload.whatsapp_phone or "",
        full_name=payload.full_name,
        password=payload.password.get_secret_value(),
        seller_profile=payload.seller_profile.model_dump(exclude_none=True) if payload.seller_profile else None,
    )
    if result.get("success"):
        log_security_event(
            auth_service.db,
            event_type="account_registered",
            ip_address=request.client.host if request.client else None,
            path=str(request.url.path),
            details={
                "user_id": result.get("user_id"),
                "verification_channel": result.get("verification_channel"),
                "seller": bool(payload.seller_profile),
            },
        )
        if payload.seller_profile:
            _notify_admin_seller_registration(
                auth_service,
                user_id=result.get("user_id") if isinstance(result.get("user_id"), str) else None,
                identifier=payload.identifier or payload.email or payload.whatsapp_phone or "",
                full_name=payload.full_name,
            )
        auth_service.db.commit()
    return result


@router.post("/verify-account", response_model=VerifyAccountResponse)
def verify_account(
    payload: VerifyAccountRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> dict[str, str | bool]:
    enforce_rate_limit(request, key="auth_verify_account", limit=8, window_seconds=300)
    result = auth_service.verify_account(identifier=payload.identifier, code=payload.code)
    if result.get("success") and result.get("message") != "Compte deja verifie":
        log_security_event(
            auth_service.db,
            event_type="account_verified",
            ip_address=request.client.host if request.client else None,
            path=str(request.url.path),
            details={"identifier": (payload.identifier or "").strip()[:120]},
        )
        auth_service.db.commit()
    return result


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
            details={"identifier": (payload.identifier or "")[:3] + "***"},
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
    _invalidate_public_marketplace_cache()
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


@router.post("/pre-register-seller", response_model=SellerPreRegisterResponse, status_code=status.HTTP_201_CREATED)
def pre_register_seller(
    payload: SellerPreRegisterRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> SellerPreRegisterResponse:
    """Soumet une demande d inscription vendeur sans creer de compte. Le compte est cree apres confirmation du paiement par l admin."""
    enforce_rate_limit(request, key="pre_register_seller", limit=5, window_seconds=300)
    reg = SellerPendingRegistration(
        full_name=payload.full_name.strip(),
        identifier=payload.identifier.strip(),
        hashed_password=hash_password(payload.password),
        business_name=payload.business_name.strip() if payload.business_name else None,
        activity_type=payload.activity_type,
        storefront_tier=payload.storefront_tier,
        payment_mode=payload.payment_mode,
        months=payload.months,
        transaction_reference=payload.transaction_reference.strip() if payload.transaction_reference else None,
        status="pending",
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    # Prevenir l'admin qu'une nouvelle demande vendeur attend sa validation
    # (notification in-app, visible dans son espace). N'echoue jamais la demande.
    try:
        admin_user = db.scalar(select(User).where(User.email == settings.admin_email.strip().lower()))
        if admin_user is not None:
            NotificationService(db).send_to_user(
                user_id=admin_user.id,
                payload=NotificationPayload(
                    title="Nouvelle demande vendeur",
                    body=f"{reg.full_name} ({reg.identifier}) a soumis une demande vendeur a valider.",
                    data={
                        "tag": f"seller-prereg-{reg.id}",
                        "href": "/admin/tarifs",
                        "kind": "seller_pre_registration",
                    },
                ),
            )
            db.commit()
    except Exception:
        db.rollback()

    return SellerPreRegisterResponse(
        id=reg.id,
        status="pending",
        message="Votre demande a ete envoyee. Votre compte et votre boutique seront crees apres verification de votre paiement.",
    )


@router.get("/pre-register-seller/{reg_id}", response_model=SellerPreRegisterStatusResponse)
def get_pre_register_seller_status(
    reg_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> SellerPreRegisterStatusResponse:
    """Statut d'une pre-inscription, interroge par l'app du demandeur AVANT connexion.
    L'id est un UUID opaque connu uniquement de l'appareil qui a soumis la demande:
    on ne renvoie donc que le statut et le nom de la boutique (aucune donnee sensible)."""
    enforce_rate_limit(request, key="pre_register_status", limit=60, window_seconds=60)
    reg = db.get(SellerPendingRegistration, reg_id)
    if reg is None:
        raise NotFoundError("Inscription introuvable")
    if reg.status == "approved":
        message = (
            "Felicitations ! Votre compte est pret. Vous pouvez vous connecter "
            "et commencer a utiliser AMAZER."
        )
    elif reg.status == "rejected":
        message = "Votre demande n'a pas ete validee. Contactez le support AMAZER."
    else:
        message = "Votre demande est en cours de verification."
    # Durcissement: ne pas exposer l'identifiant (tel/email) sur un endpoint public,
    # meme keye par UUID. Le client le connait deja sur son appareil.
    return SellerPreRegisterStatusResponse(
        id=reg.id,
        status=reg.status,
        business_name=reg.business_name,
        message=message,
    )


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
