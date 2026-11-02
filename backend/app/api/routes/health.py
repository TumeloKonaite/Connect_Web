"""Liveness endpoint."""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Report that the API process is running."""
    return {"status": "healthy"}
