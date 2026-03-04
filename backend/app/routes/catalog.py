from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.catalog import (
    CategoryListResponse,
    PromotionListResponse,
    VendorListResponse,
    VendorStorefrontListResponse,
)
from app.services.catalog_service import CatalogService

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=CategoryListResponse)
def list_categories(
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CategoryListResponse:
    service = CatalogService(db)
    return service.list_categories(limit=limit, offset=offset)


@router.get("/vendors", response_model=VendorListResponse)
def list_vendors(
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> VendorListResponse:
    service = CatalogService(db)
    return service.list_vendors(limit=limit, offset=offset, query=query)


@router.get("/storefronts", response_model=VendorStorefrontListResponse)
def list_storefronts(
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> VendorStorefrontListResponse:
    service = CatalogService(db)
    return service.list_vendor_storefronts(limit=limit, offset=offset, query=query)


@router.get("/promotions", response_model=PromotionListResponse)
def list_promotions(
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PromotionListResponse:
    service = CatalogService(db)
    return service.list_promotions(limit=limit, offset=offset, query=query)
