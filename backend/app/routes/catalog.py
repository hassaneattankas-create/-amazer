from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.cache import build_cache_key, cache_get_json, cache_set_json
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
    cache_key = build_cache_key("catalog:categories", limit=limit, offset=offset)
    cached = cache_get_json(cache_key)
    if cached is not None:
        return CategoryListResponse(**cached)
    service = CatalogService(db)
    response = service.list_categories(limit=limit, offset=offset)
    cache_set_json(cache_key, response.model_dump(), ttl_seconds=120)
    return response


@router.get("/vendors", response_model=VendorListResponse)
def list_vendors(
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> VendorListResponse:
    cache_key = build_cache_key(
        "catalog:vendors",
        limit=limit,
        offset=offset,
        query=(query or "").strip().lower(),
    )
    cached = cache_get_json(cache_key)
    if cached is not None:
        return VendorListResponse(**cached)
    service = CatalogService(db)
    response = service.list_vendors(limit=limit, offset=offset, query=query)
    cache_set_json(cache_key, response.model_dump(), ttl_seconds=120)
    return response


@router.get("/storefronts", response_model=VendorStorefrontListResponse)
def list_storefronts(
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    activity_type: Annotated[str | None, Query(min_length=1, max_length=32)] = None,
    storefront_tier: Annotated[str | None, Query(min_length=1, max_length=32)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> VendorStorefrontListResponse:
    normalized_query = query.strip() if query else None
    normalized_activity_type = activity_type.strip().lower() if activity_type else None
    normalized_storefront_tier = storefront_tier.strip().lower() if storefront_tier else None

    cache_key = build_cache_key(
        "catalog:storefronts",
        limit=limit,
        offset=offset,
        query=(normalized_query or "").lower(),
        activity_type=(normalized_activity_type or ""),
        storefront_tier=(normalized_storefront_tier or ""),
    )
    cached = cache_get_json(cache_key)
    if cached is not None:
        return VendorStorefrontListResponse(**cached)
    service = CatalogService(db)
    response = service.list_vendor_storefronts(
        limit=limit,
        offset=offset,
        query=normalized_query,
        activity_type=normalized_activity_type,
        storefront_tier=normalized_storefront_tier,
    )
    cache_set_json(cache_key, response.model_dump(), ttl_seconds=120)
    return response


@router.get("/promotions", response_model=PromotionListResponse)
def list_promotions(
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PromotionListResponse:
    cache_key = build_cache_key(
        "catalog:promotions",
        limit=limit,
        offset=offset,
        query=(query or "").strip().lower(),
    )
    cached = cache_get_json(cache_key)
    if cached is not None:
        return PromotionListResponse(**cached)
    service = CatalogService(db)
    response = service.list_promotions(limit=limit, offset=offset, query=query)
    cache_set_json(cache_key, response.model_dump(), ttl_seconds=60)
    return response
