from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ConversationStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    vendor_id: str = Field(min_length=1, max_length=36)
    body: str = Field(min_length=1, max_length=2000)


class MessageCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    body: str = Field(min_length=1, max_length=2000)


class ConversationReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    reason: str = Field(min_length=3, max_length=500)


class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    body: str
    created_at: datetime
    is_mine: bool
    read: bool


class ConversationSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    vendor_id: str
    # Ce que l'utilisateur voit de son interlocuteur : la boutique pour le client, le client pour le vendeur.
    counterpart_name: str
    role: Literal["customer", "seller"]
    last_message: str | None
    last_message_at: datetime
    unread_count: int


class ConversationDetailResponse(ConversationSummaryResponse):
    messages: list[MessageResponse]
