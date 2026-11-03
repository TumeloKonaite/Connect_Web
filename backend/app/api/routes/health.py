"""Health router for checking whether the API process is running."""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])
"""Provides the lightweight API health check endpoint."""


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Report that the API process is running."""
    return {"status": "healthy"}
