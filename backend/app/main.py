from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app import models as _models  # noqa: F401
from app.config import get_settings
from app.core.exceptions import DomainError
from app.database import Base, engine
from app.database import SessionLocal
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
from app.services.security_log_service import log_security_event

settings = get_settings()
app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # In production we rely on migrations; create_all can fail on managed DB extensions.
    if settings.app_env.lower() != "production":
        Base.metadata.create_all(bind=engine)


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
app.include_router(admin_finance_router, prefix=settings.api_prefix)
app.include_router(content_router, prefix=settings.api_prefix)
app.include_router(admin_content_router, prefix=settings.api_prefix)
app.include_router(ads_router, prefix=settings.api_prefix)


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
