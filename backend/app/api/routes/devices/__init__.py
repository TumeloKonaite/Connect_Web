"""Read-only device and observation API."""

from fastapi import APIRouter

from app.api.routes.devices.routes import router

__all__ = ["router"]
