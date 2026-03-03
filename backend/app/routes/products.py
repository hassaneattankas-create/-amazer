from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.product import ProductDetailResponse, ProductSearchResult, SearchSort
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/search", response_model=ProductSearchResult)
def search_products(
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    barcode: Annotated[str | None, Query(min_length=3, max_length=80)] = None,
    brand: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    category_id: Annotated[str | None, Query(min_length=1, max_length=36)] = None,
    category_slug: Annotated[str | None, Query(min_length=1, max_length=140)] = None,
    spec_key: Annotated[str | None, Query(min_length=1, max_length=80)] = None,
    spec_value: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    min_price: Annotated[float | None, Query(ge=0)] = None,
    max_price: Annotated[float | None, Query(ge=0)] = None,
    in_stock_only: bool = True,
    sort: SearchSort = "relevance",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProductSearchResult:
    service = ProductService(db)
    return service.search_products(
        query=query,
        barcode=barcode,
        brand=brand,
        category_id=category_id,
        category_slug=category_slug,
        spec_key=spec_key,
        spec_value=spec_value,
        min_price=min_price,
        max_price=max_price,
        in_stock_only=in_stock_only,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get("/{product_id}", response_model=ProductDetailResponse)
def get_product_detail(
    product_id: Annotated[str, Path(min_length=1, max_length=36)],
    db: Annotated[Session, Depends(get_db)],
) -> ProductDetailResponse:
    service = ProductService(db)
    return service.get_product_detail(product_id)


@router.get("/{product_id}/recommendations", response_model=ProductSearchResult)
def get_recommendations(
    product_id: Annotated[str, Path(min_length=1, max_length=36)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=12)] = 4,
) -> ProductSearchResult:
    service = ProductService(db)
    detail = service.get_product_detail(product_id)
    category_slug = detail.product.category.slug if detail.product.category else None
    results = service.search_products(
        query=None,
        barcode=None,
        brand=None,
        category_id=None,
        category_slug=category_slug,
        spec_key=None,
        spec_value=None,
        min_price=None,
        max_price=None,
        in_stock_only=True,
        sort="relevance",
        limit=limit + 1,
        offset=0,
    )
    results.items = [item for item in results.items if item.id != product_id][:limit]
    results.meta.returned = len(results.items)
    results.meta.limit = limit
    return results
