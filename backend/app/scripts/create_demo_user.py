"""Create the configured demo user once, storing only its password hash."""

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
        existing = db.scalar(select(User.id).where(User.email == email))
        if existing is not None:
            print(f"Demo user already exists: {email}")
            return 0
        db.add(User(email=email, hashed_password=hash_password(password)))
        db.commit()
    print(f"Created demo user: {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
