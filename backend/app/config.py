from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AMAZER API"
    app_version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    app_env: str = Field(default="development")

    database_url: str = Field(..., min_length=1)

    jwt_secret_key: str = Field(..., min_length=16)
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = Field(default=15, ge=1, le=1440)
    jwt_refresh_token_expire_days: int = Field(default=7, ge=1, le=30)
    admin_email: str = Field(default="owner@amazer.ne")
    admin_finance_pin: str = Field(default="7391")
    cors_allowed_origins: str = Field(
        default="https://amazer.vercel.app,https://www.amazer.vercel.app,https://amazerniger.vercel.app,https://www.amazerniger.vercel.app"
    )
    payment_encryption_key: str = Field(
        default="REPLACE_WITH_BASE64URL_32BYTE_KEY_REPLACE_WITH_KEY_1234="
    )
    redis_url: str | None = Field(default=None)

    smtp_host: str | None = Field(default=None)
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = Field(default=None)
    smtp_password: str | None = Field(default=None)
    smtp_from_email: str | None = Field(default=None)
    smtp_use_ssl: bool = Field(default=True)
    smtp_use_starttls: bool = Field(default=True)

    def get_cors_origins(self) -> list[str]:
        if self.app_env.lower() == "development":
            return ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001", *[
                origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()
            ]]
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
