from collections.abc import Awaitable, Callable
import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from sqlalchemy import func, select, text

from app import models as _models  # noqa: F401
from app.config import get_settings
from app.core.csrf import enforce_csrf
from app.core.exceptions import DomainError
from app.database import Base, engine
from app.database import SessionLocal
from app.models.product import Price, Product
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
app = FastAPI(title=settings.app_name, version=settings.app_version)
logger = logging.getLogger(__name__)

if settings.media_storage_provider.lower() == "local":
    media_dir = Path(settings.media_upload_dir).resolve()
    media_dir.mkdir(parents=True, exist_ok=True)
    app.mount(settings.media_base_url, StaticFiles(directory=str(media_dir)), name="media")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS accepts_table_reservations BOOLEAN DEFAULT FALSE",
        "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS accepts_hotel_bookings BOOLEAN DEFAULT FALSE",
        "ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS delivery_fee DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS customer_note VARCHAR(500)",
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

    from seed_niger_market import main as seed_market_main
    from seed_demo_storefronts import main as seed_storefronts_main

    logger.info("Database empty detected, running Niger market seed bootstrap.")
    seed_market_main()
    logger.info("Running premium storefront demo seed.")
    seed_storefronts_main()


@app.on_event("startup")
def on_startup() -> None:
    if settings.should_bootstrap_db():
        _bootstrap_database_if_needed()


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
        enforce_csrf(request)
    response = await call_next(request)
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
