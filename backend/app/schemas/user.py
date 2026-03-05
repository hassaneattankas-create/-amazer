from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    email: EmailStr
    full_name: str
    whatsapp_phone: str | None
    is_active: bool
    created_at: datetime
