from app.routes.auth import router as auth_router
from app.routes.cart import router as cart_router
from app.routes.catalog import router as catalog_router
from app.routes.products import router as products_router

__all__ = ["auth_router", "products_router", "cart_router", "catalog_router"]
