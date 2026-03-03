from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PriceAlertCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1, max_length=36)
    target_price: float = Field(gt=0)


class PriceAlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    user_id: str
    product_id: str
    target_price: float
    currency: str
    is_active: bool
    created_at: datetime
