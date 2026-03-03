from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SellerLeadCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    shop_name: str = Field(min_length=2, max_length=140)
    district: str = Field(min_length=2, max_length=120)
    contact: str = Field(min_length=4, max_length=80)
    product_type: str = Field(min_length=2, max_length=140)


class SellerLeadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    shop_name: str
    district: str
    contact: str
    product_type: str
    created_at: datetime
