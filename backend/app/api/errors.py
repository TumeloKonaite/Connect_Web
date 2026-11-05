"""HTTP error translation helpers for API routes."""

from typing import NoReturn

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


def raise_database_error(
    db: Session, message: str, exc: SQLAlchemyError
) -> NoReturn:
    """Roll back a failed database operation and raise HTTP 500."""
    db.rollback()
    raise HTTPException(status_code=500, detail=message) from exc
