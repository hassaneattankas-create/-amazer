import re

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$")
WHATSAPP_REGEX = re.compile(r"^(?:\+?227)\d{8}$")
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    identifier: str = Field(min_length=6, max_length=120)
    full_name: str = Field(min_length=2, max_length=120)
    password: SecretStr = Field(min_length=8, max_length=72)

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
    def validate_identifier(cls, value: str) -> str:
        normalized = value.strip()
        if EMAIL_REGEX.match(normalized):
            return normalized.lower()
        compact = normalized.replace(" ", "")
        if WHATSAPP_REGEX.match(compact):
            digits = "".join(ch for ch in compact if ch.isdigit())
            if digits.startswith("227"):
                return f"+{digits}"
        raise ValueError("identifier must be an email or a WhatsApp number starting with +227")


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    identifier: str = Field(min_length=6, max_length=120)
    password: SecretStr = Field(min_length=8, max_length=72)

    @field_validator("identifier")
    @classmethod
    def validate_login_identifier(cls, value: str) -> str:
        normalized = value.strip()
        if EMAIL_REGEX.match(normalized):
            return normalized.lower()
        compact = normalized.replace(" ", "")
        if WHATSAPP_REGEX.match(compact):
            digits = "".join(ch for ch in compact if ch.isdigit())
            if digits.startswith("227"):
                return f"+{digits}"
        raise ValueError("identifier must be an email or a WhatsApp number starting with +227")


class RefreshTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str | None = Field(default=None, min_length=16)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MfaSetupResponse(BaseModel):
    secret_key: str
    otpauth_url: str
    issuer: str
    account: str


class MfaEnableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class MfaStatusResponse(BaseModel):
    enabled: bool
    required_for_account: bool


class UserPreferencesResponse(BaseModel):
    preferred_currency: str = Field(pattern="^(XOF)$")


class UserPreferencesUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preferred_currency: str = Field(pattern="^(XOF)$")
