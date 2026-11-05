"""User model and password helper behavior."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.repository.database.base import Base
from app.repository.database.tables import User


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_user_defaults_and_password_hash(session):
    password = "correct horse battery staple"
    hashed = hash_password(password)
    user = User(email="person@example.com", hashed_password=hashed)
    session.add(user)
    session.commit()
    session.refresh(user)

    assert user.id is not None
    assert user.is_active is True
    assert user.created_at is not None
    assert User.__table__.c.created_at.type.timezone is True
    assert user.hashed_password != password
    assert verify_password(password, user.hashed_password)
    assert not verify_password("wrong password", user.hashed_password)


def test_user_email_is_unique(session):
    session.add_all(
        [
            User(email="person@example.com", hashed_password=hash_password("first")),
            User(email="person@example.com", hashed_password=hash_password("second")),
        ]
    )
    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize(
    "values",
    [
        {"email": "person@example.com"},
        {"hashed_password": hash_password("secret")},
    ],
)
def test_required_fields_cannot_be_omitted(session, values):
    session.add(User(**values))
    with pytest.raises(IntegrityError):
        session.commit()


def test_user_table_metadata_has_timezone_aware_timestamp():
    columns = User.__table__.columns
    assert columns.email.nullable is False
    assert columns.hashed_password.nullable is False
    assert columns.created_at.type.timezone is True
