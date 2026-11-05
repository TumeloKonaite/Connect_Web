"""Environment driven application settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_JWT_SECRET = "replace-with-a-random-secret-before-use"


class Settings(BaseSettings):
    """Settings loaded from environment variables and an optional .env file."""

    app_name: str = "Connect Web API"
    app_environment: str = "development"
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    database_url: str = "postgresql+psycopg://connect_web:change-me@localhost:5432/connect_web"
    jwt_secret_key: str = "replace-with-a-random-secret-before-use"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

if settings.app_environment.lower() not in {"development", "dev", "test"}:
    if settings.jwt_secret_key == INSECURE_JWT_SECRET:
        raise ValueError("JWT_SECRET_KEY must be set to a private value outside development")
