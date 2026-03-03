from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories.catalog_repository import CatalogRepository
from app.schemas.catalog import CategoryListResponse, VendorListResponse
from app.schemas.product import CategoryResponse, VendorResponse


class CatalogService:
    def __init__(self, db: Session) -> None:
        self.catalog = CatalogRepository(db)

    def list_categories(self, *, limit: int, offset: int) -> CategoryListResponse:
        categories = self.catalog.list_active_categories(limit=limit, offset=offset)
        return CategoryListResponse(
            items=[
                CategoryResponse(id=category.id, name=category.name, slug=category.slug)
                for category in categories
            ]
        )

    def list_vendors(self, *, limit: int, offset: int) -> VendorListResponse:
        vendors = self.catalog.list_active_vendors(limit=limit, offset=offset)
        return VendorListResponse(
            items=[
                VendorResponse(
                    id=vendor.id,
                    name=vendor.name,
                    slug=vendor.slug,
                    is_active=vendor.is_active,
                )
                for vendor in vendors
            ]
        )
