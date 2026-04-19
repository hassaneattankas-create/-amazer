from functools import lru_cache

from pydantic import Field, model_validator
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
    jwt_refresh_token_expire_days: int = Field(default=30, ge=1, le=30)
    auto_activate_new_accounts: bool = Field(default=True)
    registration_requires_verification: bool = Field(default=False)
    verification_code_ttl_minutes: int = Field(default=10, ge=3, le=30)
    verification_code_max_attempts: int = Field(default=5, ge=3, le=10)
    admin_email: str = Field(default="amazer.niger@gmail.com")
    # Utilise uniquement a la creation du compte admin ou si admin_sync_password_on_startup=true.
    admin_password: str | None = Field(default="AmazerAdmin@2026")
    # Si true, re-applique admin_password au demarrage (ecrase le hash en base). Defaut: false.
    admin_sync_password_on_startup: bool = Field(default=False)
    admin_finance_pin: str = Field(default="7391")
    admin_birth_date: str = Field(default="07/11/03")
    cors_allowed_origins: str = Field(
        default=(
            "https://amazer.vercel.app,"
            "https://www.amazer.vercel.app,"
            "https://amazerniger.vercel.app,"
            "https://www.amazerniger.vercel.app,"
            "https://amazerniger-hub-amazer.vercel.app,"
            "https://amazerapp.com,"
            "https://www.amazerapp.com,"
            "https://localhost,"
            "http://localhost:3000,"
            "http://127.0.0.1:3000,"
            "http://localhost:3001,"
            "http://127.0.0.1:3001,"
            "http://localhost,"
            "http://127.0.0.1,"
            "https://127.0.0.1,"
            "capacitor://localhost"
        )
    )
    cors_allowed_origin_regex: str = Field(
        default=(
            r"^("
            r"https://.*\.vercel\.app"
            r"|https://(www\.)?amazerapp\.com"
            r"|https://localhost(:\d+)?"
            r"|https://127\.0\.0\.1(:\d+)?"
            r"|capacitor://localhost"
            r"|http://localhost:\d+"
            r"|http://localhost"
            r"|http://127\.0\.0\.1:\d+"
            r"|http://127\.0\.0\.1"
            r")$"
        )
    )
    # Hostnames acceptes par l API (header Host). En production, lister explicitement (ex: api.tondomaine.com).
    allowed_hosts: str = Field(default="*")
    payment_encryption_key: str = Field(
        default="REPLACE_WITH_BASE64URL_32BYTE_KEY_REPLACE_WITH_KEY_1234="
    )
    curated_public_catalog_mode: bool = Field(default=False)
    bootstrap_on_startup: bool = Field(default=True)
    seed_demo_data: bool = Field(default=False)
    redis_url: str | None = Field(default=None)
    whatsapp_verification_enabled: bool = Field(default=True)
    whatsapp_api_version: str = Field(default="v22.0")
    whatsapp_access_token: str | None = Field(default=None)
    whatsapp_phone_number_id: str | None = Field(default=None)
    media_upload_dir: str = Field(default="uploads")
    media_base_url: str = Field(default="/media")
    media_max_bytes: int = Field(default=5_000_000, ge=1_000_000, le=20_000_000)
    media_storage_provider: str = Field(default="local")
    media_public_base_url: str | None = Field(default=None)
    s3_bucket_name: str | None = Field(default=None)
    s3_endpoint_url: str | None = Field(default=None)
    s3_region: str | None = Field(default=None)
    s3_access_key_id: str | None = Field(default=None)
    s3_secret_access_key: str | None = Field(default=None)
    firebase_project_id: str | None = Field(default=None)
    firebase_service_account_json: str | None = Field(default=None)
    firebase_service_account_base64: str | None = Field(default=None)
    firebase_service_account_path: str | None = Field(default=None)

    def get_cors_origins(self) -> list[str]:
        defaults = [
            "https://localhost",
            "https://127.0.0.1",
            "http://localhost",
            "http://127.0.0.1",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "capacitor://localhost",
        ]
        configured = [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]
        merged: list[str] = []
        for origin in [*defaults, *configured]:
            if origin not in merged:
                merged.append(origin)
        return merged

    def get_cors_origin_regex(self) -> str | None:
        value = self.cors_allowed_origin_regex.strip()
        return value or None

    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    def should_bootstrap_db(self) -> bool:
        return self.bootstrap_on_startup and not self.is_production()

    def should_seed_demo_data(self) -> bool:
        return self.seed_demo_data and not self.is_production()

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if not self.is_production():
            return self

        weak_jwt_values = {
            "supersecretkey-supersecretkey",
            "replace-with-a-strong-secret",
            "changeme",
            "CHANGE_ME",
        }
        if self.jwt_secret_key.strip() in weak_jwt_values or len(self.jwt_secret_key.strip()) < 32:
            raise ValueError("JWT_SECRET_KEY must be a strong secret in production")

        if self.admin_finance_pin in {"CHANGE_ME", "0000", "1234"} or len(self.admin_finance_pin.strip()) < 4:
            raise ValueError("ADMIN_FINANCE_PIN must be set to a strong value in production")

        if len(self.admin_birth_date.strip()) < 6:
            raise ValueError("ADMIN_BIRTH_DATE must be set in production")

        if self.payment_encryption_key.startswith("REPLACE_WITH"):
            raise ValueError("PAYMENT_ENCRYPTION_KEY must be set in production")

        if not self.cors_allowed_origins.strip():
            raise ValueError("CORS_ALLOWED_ORIGINS must be configured in production")

        hosts = self.allowed_hosts.strip()
        if not hosts or hosts == "*":
            raise ValueError(
                "ALLOWED_HOSTS must list explicit API hostnames in production (comma-separated, e.g. api.example.com)"
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
