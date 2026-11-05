"""Resolve authenticated users for API request dependencies."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.tokens import decode_access_token
from app.repository.database.tables import User


class InvalidCredentialsError(Exception):
    """Raised when a bearer token does not identify an active user."""


def get_current_user(token: str | None, db: Session) -> User:
    """Return the active user identified by a validated JWT."""
    if token is None:
        raise InvalidCredentialsError
    try:
        user_id = decode_access_token(token)
    except ValueError as exc:
        raise InvalidCredentialsError from exc

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise InvalidCredentialsError
    return user
