import re

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator

from app.schemas.seller import SellerProfileRequest

PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$")
WHATSAPP_REGEX = re.compile(r"^(?:\+?227)\d{8}$")
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    identifier: str | None = Field(default=None, min_length=6, max_length=120)
    email: str | None = Field(default=None, min_length=6, max_length=120)
    whatsapp_phone: str | None = Field(default=None, min_length=8, max_length=20)
    full_name: str = Field(min_length=2, max_length=120)
    password: SecretStr = Field(min_length=8, max_length=72)
    seller_profile: SellerProfileRequest | None = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if not PASSWORD_REGEX.match(raw):
            raise ValueError(
                "Password must contain upper, lower, digit, and special character."
            )
        return value

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if EMAIL_REGEX.match(normalized):
            return normalized.lower()
        compact = normalized.replace(" ", "")
        if WHATSAPP_REGEX.match(compact):
            digits = "".join(ch for ch in compact if ch.isdigit())
            if digits.startswith("227"):
                return f"+{digits}"
        raise ValueError("identifier must be an email or a WhatsApp number starting with +227")

    @field_validator("email")
    @classmethod
    def validate_email_alias(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("email must be valid")
        return normalized

    @field_validator("whatsapp_phone")
    @classmethod
    def validate_whatsapp_alias(cls, value: str | None) -> str | None:
        if value is None:
            return None
        compact = value.strip().replace(" ", "")
        if not WHATSAPP_REGEX.match(compact):
            raise ValueError("whatsapp_phone must start with +227 and contain 8 local digits")
        digits = "".join(ch for ch in compact if ch.isdigit())
        return f"+{digits}"

    @model_validator(mode="after")
    def ensure_identifier(self) -> "RegisterRequest":
        if self.identifier:
            return self
        if self.email:
            self.identifier = self.email
            return self
        if self.whatsapp_phone:
            self.identifier = self.whatsapp_phone
            return self
        raise ValueError("identifier or email or whatsapp_phone is required")


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    identifier: str | None = Field(default=None, min_length=6, max_length=120)
    email: str | None = Field(default=None, min_length=6, max_length=120)
    password: SecretStr = Field(min_length=8, max_length=72)

    @field_validator("identifier")
    @classmethod
    def validate_login_identifier(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if EMAIL_REGEX.match(normalized):
            return normalized.lower()
        compact = normalized.replace(" ", "")
        if WHATSAPP_REGEX.match(compact):
            digits = "".join(ch for ch in compact if ch.isdigit())
            if digits.startswith("227"):
                return f"+{digits}"
        raise ValueError("identifier must be an email or a WhatsApp number starting with +227")

    @field_validator("email")
    @classmethod
    def validate_login_email_alias(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("email must be valid")
        return normalized

    @model_validator(mode="after")
    def ensure_login_identifier(self) -> "LoginRequest":
        if self.identifier:
            return self
        if self.email:
            self.identifier = self.email
            return self
        raise ValueError("identifier or email is required")


class RefreshTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str | None = Field(default=None, min_length=16)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    success: bool = True
    user_id: str
    email: str
    verification_channel: str
    verification_destination_masked: str
    verification_code_preview: str | None = None


class VerifyAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    identifier: str = Field(min_length=6, max_length=120)
    code: str = Field(min_length=4, max_length=8)


class VerifyAccountResponse(BaseModel):
    success: bool = True
    message: str


class UserPreferencesResponse(BaseModel):
    preferred_currency: str = Field(pattern="^(XOF)$")


class UserPreferencesUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preferred_currency: str = Field(pattern="^(XOF)$")


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: SecretStr = Field(min_length=8, max_length=72)
