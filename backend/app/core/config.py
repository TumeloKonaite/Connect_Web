"""Environment driven application settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings loaded from environment variables and an optional .env file."""

    app_name: str = "Connect Web API"
    app_environment: str = "development"
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    database_url: str = "postgresql+psycopg://connect_web:change-me@localhost:5432/connect_web"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
