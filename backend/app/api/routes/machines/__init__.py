"""Machine record HTTP endpoints."""

from fastapi import APIRouter

from app.api.routes.machines.csv_import import router as csv_router
from app.api.routes.machines.records import router

router.include_router(csv_router)

__all__ = ["router"]
