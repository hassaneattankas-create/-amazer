from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class CartItemAddRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1, max_length=36)
    quantity: int = Field(ge=1, le=999)


class CartItemUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantity: int = Field(ge=1, le=999)


class CartItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    product_id: str
    quantity: int


class CartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    user_id: str
    items: list[CartItemResponse]
