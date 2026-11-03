"""Machine record HTTP endpoints."""

from fastapi import APIRouter

from app.api.routes.machines.machine_records import router

__all__ = ["router"]
