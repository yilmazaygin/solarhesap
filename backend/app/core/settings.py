# ./backend/app/core/settings.py
"""Application settings using Pydantic BaseSettings."""

from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration loaded from .env file."""

    APP_NAME: str = "Solarhesap"
    APP_VERSION: str = "v0.1.0"
    APP_DESCRIPTION: str = "Solarhesap is a Tübitak 2209 project"
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = 8000
    APP_ENV: str = "production"
    APP_DEBUG: bool = False

    PVGIS_BASE_URL: str = "https://re.jrc.ec.europa.eu/api/v5_3"
    OPEN_METEO_BASE_URL: str = "https://archive-api.open-meteo.com/v1/archive"

    LOG_BASE_LEVEL: str = "INFO"
    LOG_STREAM_HANDLER: bool = False
    LOG_DIR: Optional[str] = None

    OPENMETEO_TIMEOUT: int = 30
    PVGIS_TIMEOUT: int = 90

    RETRY_MAX_ATTEMPTS: int = 3
    RETRY_WAIT_MULTIPLIER: float = 2.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_setup(self) -> "Settings":
        """Ensure APP_ENV is a recognised environment name."""
        valid_envs = ["development", "production", "testing"]
        if self.APP_ENV not in valid_envs:
            raise ValueError(f"APP_ENV must be one of following: {valid_envs}")
        return self


# Singleton instance
settings = Settings()