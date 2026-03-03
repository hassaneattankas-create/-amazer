from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from app.schemas.product import CategoryResponse, VendorResponse


class CategoryListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CategoryResponse]


class VendorListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[VendorResponse]
