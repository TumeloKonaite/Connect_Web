"""Create or reset the configured local demo user, storing only its password hash."""

import os
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.repository.database.session import SessionLocal
from app.repository.database.tables import User


def main() -> int:
    email = os.getenv("DEMO_USER_EMAIL")
    password = os.getenv("DEMO_USER_PASSWORD")
    if not email or not password:
        print(
            "Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD to create the demo user.",
            file=sys.stderr,
        )
        return 2

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            existing.hashed_password = hash_password(password)
            status = "Reset password for demo user"
        else:
            db.add(User(email=email, hashed_password=hash_password(password)))
            status = "Created demo user"
        db.commit()
    print(f"{status}: {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
