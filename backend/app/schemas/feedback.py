from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: str = Field(min_length=2, max_length=140)
    email: str | None = Field(default=None, max_length=255)
    message: str = Field(min_length=8, max_length=2000)
    rating: int = Field(default=5, ge=1, le=5)


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    user_id: str | None
    full_name: str
    email: str | None
    message: str
    rating: int
    created_at: datetime
