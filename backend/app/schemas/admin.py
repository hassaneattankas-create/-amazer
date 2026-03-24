from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class AdminMeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_admin: bool
    email: str

