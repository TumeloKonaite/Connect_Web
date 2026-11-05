"""JWT access token creation and validation."""

from datetime import datetime, timedelta, timezone

import jwt
from jwt import InvalidTokenError

from app.core.config import settings


def create_access_token(user_id: int) -> str:
    """Create a signed access token containing only the user ID and expiry."""
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": str(user_id), "exp": expires_at},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> int:
    """Validate token signature and required claims, returning its user ID."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp"]},
        )
        user_id = int(payload["sub"])
        if user_id <= 0:
            raise ValueError("Invalid user ID")
        return user_id
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid access token") from exc
