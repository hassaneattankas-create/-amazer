from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    rating: float = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=1500)
    photo_url: str | None = Field(default=None, max_length=1024)


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    product_id: str
    user_id: str
    user_name: str
    rating: float
    comment: str
    photo_url: str | None
    created_at: datetime
