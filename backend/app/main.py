from collections.abc import Awaitable, Callable
import logging
from pathlib import Path
import shutil

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pydantic import ValidationError
from sqlalchemy import func, select, text

from app import models as _models  # noqa: F401
from app.config import get_settings
from app.core.csrf import enforce_csrf
from app.core.security import hash_password
from app.core.exceptions import DomainError
from app.database import Base, engine
from app.database import SessionLocal
from app.models.product import Price, Product
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.vendor import Vendor
from app.routes.alerts import router as alerts_router
from app.routes.auth import router as auth_router
from app.routes.cart import router as cart_router
from app.routes.catalog import router as catalog_router
from app.routes.orders import router as orders_router
from app.routes.products import router as products_router
from app.routes.reviews import router as reviews_router
from app.routes.seller import router as seller_router
from app.routes.restaurant import router as restaurant_router
from app.routes.media import router as media_router
from app.routes.admin import router as admin_router
from app.routes.admin_finance import router as admin_finance_router
from app.routes.content import router as content_router, admin_router as admin_content_router, ads_router
from app.routes.feedback import router as feedback_router, admin_router as admin_feedback_router
from app.routes.notifications import router as notifications_router
from app.services.security_log_service import log_security_event

settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url=None if settings.is_production() else "/docs",
    openapi_url=None if settings.is_production() else "/openapi.json",
    redoc_url=None if settings.is_production() else "/redoc",
)
logger = logging.getLogger(__name__)

if settings.media_storage_provider.lower() == "local":
    media_dir = Path(settings.media_upload_dir).resolve()
    media_dir.mkdir(parents=True, exist_ok=True)
    bundled_media_dir = Path(__file__).resolve().parents[1] / "uploads"
    if bundled_media_dir.exists() and bundled_media_dir.resolve() != media_dir:
        for source in bundled_media_dir.iterdir():
            if source.is_file():
                destination = media_dir / source.name
                if not destination.exists():
                    shutil.copy2(source, destination)
    app.mount(settings.media_base_url, StaticFiles(directory=str(media_dir)), name="media")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_origin_regex=settings.get_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=800)

_trusted_hosts = (
    ["*"]
    if not settings.is_production()
    else [h.strip() for h in settings.allowed_hosts.split(",") if h.strip()]
)
if _trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=_trusted_hosts)


def _bootstrap_database_if_needed() -> None:
    """Initialize schema and seed base marketplace data when DB is empty."""
    def _run_ddl_safely(statement: str) -> None:
        try:
            with engine.begin() as conn:
                conn.execute(text(statement))
        except Exception as exc:  # pragma: no cover - depends on managed DB privileges
            logger.warning("Database bootstrap DDL skipped: %s | statement=%s", exc, statement)

    # Optional extension for text search improvements (safe if unavailable).
    _run_ddl_safely("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Keep auth schema compatible on existing databases.
    for statement in (
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(24)",
        (
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_whatsapp_phone "
            "ON users (whatsapp_phone) WHERE whatsapp_phone IS NOT NULL"
        ),
        "ALTER TABLE seller_profiles ALTER COLUMN phone TYPE VARCHAR(255)",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS activity_type VARCHAR(32) DEFAULT 'shop'",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS storefront_tier VARCHAR(32) DEFAULT 'basic'",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS description VARCHAR(2000)",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS logo_url VARCHAR(1024)",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(1024)",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS opening_hours VARCHAR(240)",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS whatsapp_contact VARCHAR(40)",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS contact_email VARCHAR(320)",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS service_offerings JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS room_types JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS deposit_payment_method VARCHAR(20)",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS deposit_amount DOUBLE PRECISION",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS commission_rate_override DOUBLE PRECISION",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS service_fee_override DOUBLE PRECISION",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS seller_subscription_fee_override DOUBLE PRECISION",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS onboarding_fee_paid_at TIMESTAMPTZ",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS subscription_paid_until TIMESTAMPTZ",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS subscription_last_payment_reference VARCHAR(180)",
        (
            "CREATE TABLE IF NOT EXISTS seller_subscription_payments ("
            "id VARCHAR(36) PRIMARY KEY, "
            "seller_profile_id VARCHAR(36) NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE, "
            "seller_user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "payment_mode VARCHAR(20) NOT NULL, "
            "transaction_reference VARCHAR(180) NOT NULL, "
            "months INTEGER NOT NULL DEFAULT 1, "
            "amount_claimed DOUBLE PRECISION NOT NULL DEFAULT 0, "
            "status VARCHAR(20) NOT NULL DEFAULT 'pending', "
            "admin_note TEXT, "
            "reviewed_by_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL, "
            "reviewed_at TIMESTAMPTZ, "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "CREATE INDEX IF NOT EXISTS ix_seller_subscription_payments_profile ON seller_subscription_payments (seller_profile_id)",
        "CREATE INDEX IF NOT EXISTS ix_seller_subscription_payments_status ON seller_subscription_payments (status)",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS accepts_table_reservations BOOLEAN DEFAULT FALSE",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS accepts_hotel_bookings BOOLEAN DEFAULT FALSE",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS is_enterprise BOOLEAN DEFAULT FALSE",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS offers_transport BOOLEAN DEFAULT FALSE",
        "ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS delivery_fee DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_breakdown JSONB",
        "ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(40)",
        "ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending'",
        "ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ",
        "ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS fee_breakdown JSONB",
        "ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS customer_note VARCHAR(500)",
        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS max_products_basic_tier INTEGER DEFAULT 10",
        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS platform_wallet_phone VARCHAR(40)",
        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS seller_subscription_fee_shop DOUBLE PRECISION DEFAULT 5000",
        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS seller_subscription_fee_restaurant DOUBLE PRECISION DEFAULT 5000",
        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS seller_subscription_fee_premium DOUBLE PRECISION DEFAULT 5000",
        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS finance_counters_reset_at TIMESTAMPTZ",
        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS ad_click_counters_reset_at TIMESTAMPTZ",
        (
            "CREATE TABLE IF NOT EXISTS media_files ("
            "id VARCHAR(36) PRIMARY KEY, "
            "filename VARCHAR(260) NOT NULL UNIQUE, "
            "content_type VARCHAR(120) NOT NULL, "
            "data BYTEA NOT NULL, "
            "size_bytes INTEGER NOT NULL, "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "CREATE INDEX IF NOT EXISTS ix_media_files_filename ON media_files (filename)",
        "CREATE INDEX IF NOT EXISTS ix_order_items_product_id ON order_items (product_id)",
        "CREATE INDEX IF NOT EXISTS ix_order_items_vendor_id ON order_items (vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens (user_id)",
        (
            "CREATE TABLE IF NOT EXISTS seller_pending_registrations ("
            "id VARCHAR(36) PRIMARY KEY, "
            "full_name VARCHAR(255) NOT NULL, "
            "identifier VARCHAR(320) NOT NULL, "
            "hashed_password VARCHAR(255) NOT NULL, "
            "business_name VARCHAR(255), "
            "activity_type VARCHAR(32) DEFAULT 'shop', "
            "storefront_tier VARCHAR(32) DEFAULT 'basic', "
            "payment_mode VARCHAR(20), "
            "months INTEGER DEFAULT 1, "
            "transaction_reference VARCHAR(180), "
            "submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), "
            "status VARCHAR(20) DEFAULT 'pending', "
            "admin_note TEXT, "
            "reviewed_at TIMESTAMPTZ, "
            "reviewed_by_user_id VARCHAR(36)"
            ")"
        ),
        "CREATE INDEX IF NOT EXISTS ix_seller_pending_reg_status ON seller_pending_registrations (status)",
        (
            "UPDATE global_settings SET "
            "seller_subscription_fee_shop = COALESCE(seller_subscription_fee_shop, seller_subscription_fee, 5000), "
            "seller_subscription_fee_restaurant = COALESCE(seller_subscription_fee_restaurant, seller_subscription_fee, 5000), "
            "seller_subscription_fee_premium = COALESCE(seller_subscription_fee_premium, seller_subscription_fee, 5000)"
        ),
    ):
        _run_ddl_safely(statement)

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        product_count = db.scalar(select(func.count()).select_from(Product)) or 0
        vendor_count = db.scalar(select(func.count()).select_from(Vendor)) or 0
        price_count = db.scalar(select(func.count()).select_from(Price)) or 0
    finally:
        db.close()

    if product_count > 0 and vendor_count > 0 and price_count > 0:
        return

    if not settings.should_seed_demo_data():
        logger.info("Database empty detected, demo seeding disabled.")
        return

    from seed_demo_storefronts import main as seed_storefronts_main
    from seed_demo_restaurants import main as seed_restaurants_main

    logger.info("Database empty detected, running curated storefront demo seed.")
    seed_storefronts_main()
    logger.info("Running curated restaurant demo seed.")
    seed_restaurants_main()


def _ensure_admin_account() -> None:
    admin_password = settings.admin_password
    if not admin_password:
        return

    db = SessionLocal()
    try:
        admin_email = settings.admin_email.strip().lower()
        admin_user = db.scalar(select(User).where(User.email == admin_email))
        if admin_user is None:
            admin_user = User(
                email=admin_email,
                full_name="Admin Amazer",
                hashed_password=hash_password(admin_password),
                is_active=True,
            )
            db.add(admin_user)
            db.flush()
        else:
            admin_user.email = admin_email
            admin_user.is_active = True
            if settings.admin_sync_password_on_startup:
                admin_user.hashed_password = hash_password(admin_password)
            if not admin_user.full_name.strip():
                admin_user.full_name = "Admin Amazer"

        if db.scalar(select(UserPreferences).where(UserPreferences.user_id == admin_user.id)) is None:
            db.add(UserPreferences(user_id=admin_user.id, preferred_currency="XOF"))

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@app.on_event("startup")
def on_startup() -> None:
    if settings.bootstrap_on_startup:
        _bootstrap_database_if_needed()
    _ensure_admin_account()
    if settings.is_production() and settings.curated_public_catalog_mode:
        from seed_demo_storefronts import main as seed_storefronts_main
        from seed_demo_restaurants import main as seed_restaurants_main

        logger.info("Ensuring curated public demo storefronts in production.")
        seed_storefronts_main()
        logger.info("Ensuring curated public demo restaurant in production.")
        seed_restaurants_main()


@app.get("/health")
def health_check() -> dict[str, str]:
    """Point de controle pour hebergeurs (Render, etc.) sans dependance base."""
    return {"status": "ok"}


@app.get("/ping")
def ping() -> dict[str, str]:
    """Endpoint leger + desactivation lazy des abonnements vendeur expires."""
    from datetime import UTC, datetime
    from sqlalchemy import update
    from app.models.seller_profile import SellerProfile
    from app.models.product import Price

    try:
        now = datetime.now(UTC)
        db = SessionLocal()
        try:
            expired_vendor_ids = list(
                db.scalars(
                    select(SellerProfile.vendor_id).where(
                        SellerProfile.subscription_paid_until.is_not(None),
                        SellerProfile.subscription_paid_until < now,
                    )
                ).all()
            )
            if expired_vendor_ids:
                db.execute(
                    update(Vendor)
                    .where(Vendor.id.in_(expired_vendor_ids), Vendor.is_active.is_(True))
                    .values(is_active=False)
                )
                db.execute(
                    update(Price)
                    .where(Price.vendor_id.in_(expired_vendor_ids), Price.is_active.is_(True))
                    .values(is_active=False)
                )
                db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    except Exception:
        pass

    return {"pong": "ok"}


@app.exception_handler(DomainError)
def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(ValidationError)
def validation_exception_handler(_: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(RequestValidationError)
def request_validation_exception_handler(
    _: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(alerts_router, prefix=settings.api_prefix)
app.include_router(products_router, prefix=settings.api_prefix)
app.include_router(reviews_router, prefix=settings.api_prefix)
app.include_router(cart_router, prefix=settings.api_prefix)
app.include_router(catalog_router, prefix=settings.api_prefix)
app.include_router(seller_router, prefix=settings.api_prefix)
app.include_router(orders_router, prefix=settings.api_prefix)
app.include_router(restaurant_router, prefix=settings.api_prefix)
app.include_router(media_router, prefix=settings.api_prefix)
app.include_router(admin_finance_router, prefix=settings.api_prefix)
app.include_router(admin_router, prefix=settings.api_prefix)
app.include_router(content_router, prefix=settings.api_prefix)
app.include_router(admin_content_router, prefix=settings.api_prefix)
app.include_router(ads_router, prefix=settings.api_prefix)
app.include_router(feedback_router, prefix=settings.api_prefix)
app.include_router(admin_feedback_router, prefix=settings.api_prefix)
app.include_router(notifications_router, prefix=settings.api_prefix)


@app.middleware("http")
async def security_access_logger(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith(
        settings.api_prefix
    ):
        csrf_exempt_paths = {
            f"{settings.api_prefix}/auth/login",
            f"{settings.api_prefix}/auth/register",
            f"{settings.api_prefix}/auth/refresh",
            f"{settings.api_prefix}/auth/verify-account",
            # App mobile (Capacitor) : en-tête Bearer sans cookie csrf — évite les rejets si un proxy envoie des cookies partiels.
            f"{settings.api_prefix}/auth/logout",
            f"{settings.api_prefix}/notifications/register-token",
        }
        if request.url.path not in csrf_exempt_paths:
            try:
                enforce_csrf(request)
            except DomainError as exc:
                return JSONResponse(
                    status_code=exc.status_code,
                    content={"detail": exc.message, "code": exc.code},
                )
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
    )
    if settings.is_production():
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload",
        )
    path = request.url.path
    if path.startswith(f"{settings.api_prefix}/admin") or path.startswith(f"{settings.api_prefix}/seller"):
        db = SessionLocal()
        try:
            log_security_event(
                db,
                event_type="sensitive_api_access",
                ip_address=request.client.host if request.client else None,
                path=path,
                details={"method": request.method, "status_code": response.status_code},
            )
            db.commit()
        finally:
            db.close()
    return response
