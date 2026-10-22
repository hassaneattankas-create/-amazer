from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    rating: float = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=1500)
    photo_url: str | None = Field(default=None, max_length=1024)

    @field_validator("photo_url")
    @classmethod
    def _http_only(cls, value: str | None) -> str | None:
        # Lien affiche aux autres clients : seulement une vraie adresse web.
        if not value:
            return None
        if not value.lower().startswith(("https://", "http://")):
            raise ValueError("Lien photo invalide (adresse web attendue).")
        return value


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
