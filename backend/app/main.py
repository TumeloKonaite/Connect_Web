"""FastAPI application entry point."""

from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    description="Factory Sensor Monitoring API",
    version="0.1.0",
    debug=settings.debug,
)

app.include_router(health_router)
