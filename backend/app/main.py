from collections.abc import Awaitable, Callable
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from sqlalchemy import func, select, text

from app import models as _models  # noqa: F401
from app.config import get_settings
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
from app.routes.admin_finance import router as admin_finance_router
from app.routes.content import router as content_router, admin_router as admin_content_router, ads_router
from app.routes.feedback import router as feedback_router, admin_router as admin_feedback_router
from app.services.security_log_service import log_security_event
from app.services.notification_service import send_test_email

settings = get_settings()
app = FastAPI(title=settings.app_name, version=settings.app_version)
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _bootstrap_database_if_needed() -> None:
    """Initialize schema and seed base marketplace data when DB is empty."""
    try:
        with engine.begin() as conn:
            # Optional extension for text search improvements (safe if unavailable).
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
    except Exception as exc:  # pragma: no cover - depends on managed DB privileges
        logger.warning("pg_trgm extension initialization skipped: %s", exc)

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

    from seed_niger_market import main as seed_market_main

    logger.info("Database empty detected, running Niger market seed bootstrap.")
    seed_market_main()


@app.on_event("startup")
def on_startup() -> None:
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


@app.get("/test-mail")
def test_mail() -> JSONResponse:
    delivered, reason = send_test_email(recipient=settings.admin_email)
    status_code = 200 if delivered else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "delivered": delivered,
            "to": settings.admin_email,
            "reason": reason,
        },
    )


app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(alerts_router, prefix=settings.api_prefix)
app.include_router(products_router, prefix=settings.api_prefix)
app.include_router(reviews_router, prefix=settings.api_prefix)
app.include_router(cart_router, prefix=settings.api_prefix)
app.include_router(catalog_router, prefix=settings.api_prefix)
app.include_router(seller_router, prefix=settings.api_prefix)
app.include_router(orders_router, prefix=settings.api_prefix)
app.include_router(restaurant_router, prefix=settings.api_prefix)
app.include_router(admin_finance_router, prefix=settings.api_prefix)
app.include_router(content_router, prefix=settings.api_prefix)
app.include_router(admin_content_router, prefix=settings.api_prefix)
app.include_router(ads_router, prefix=settings.api_prefix)
app.include_router(feedback_router, prefix=settings.api_prefix)
app.include_router(admin_feedback_router, prefix=settings.api_prefix)


@app.middleware("http")
async def security_access_logger(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
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
