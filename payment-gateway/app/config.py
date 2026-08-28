"""Runtime configuration for the payment gateway."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Load gateway configuration from its private environment file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "production"
    gateway_shared_secret: str = Field(min_length=32)
    allowed_backend_ips: str = ""
    amana_base_url: str | None = None
    amana_user_login: str | None = None
    amana_user_password: str | None = None
    amana_api_key: str | None = None
    amana_webhook_secret: str | None = None

    def backend_ips(self) -> set[str]:
        """Return explicitly allowed backend egress IPs."""
        return {item.strip() for item in self.allowed_backend_ips.split(",") if item.strip()}


@lru_cache
def get_settings() -> Settings:
    """Return the cached runtime settings."""
    return Settings()
