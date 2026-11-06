"""Authentication endpoint and token behavior tests."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import hash_password
from app.main import app
from app.repository.database.base import Base
from app.repository.database.session import get_db
from app.repository.database.tables import User


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    def override_get_db():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with Session(engine) as db:
        db.add(
            User(
                email="demo@example.com",
                hashed_password=hash_password("correct-password"),
            )
        )
        db.add(
            User(
                email="inactive@example.com",
                hashed_password=hash_password("correct-password"),
                is_active=False,
            )
        )
        db.commit()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_login_returns_bearer_token_and_me_excludes_hash(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "demo@example.com", "password": "correct-password"},
    )
    assert response.status_code == 200
    token_data = response.json()
    assert token_data["token_type"] == "bearer"
    payload = jwt.decode(
        token_data["access_token"],
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    assert payload["sub"] == "1"
    assert payload["exp"] > datetime.now(UTC).timestamp()

    me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json() == {"id": 1, "email": "demo@example.com", "is_active": True}
    assert "password" not in me.text
    assert "hashed_password" not in me.text


@pytest.mark.parametrize(
    ("username", "password"),
    [
        ("demo@example.com", "wrong"),
        ("unknown@example.com", "correct-password"),
        ("inactive@example.com", "correct-password"),
    ],
)
def test_login_rejects_invalid_accounts(client, username, password):
    response = client.post(
        "/api/auth/login", data={"username": username, "password": password}
    )
    assert response.status_code == 401


def test_login_rejects_missing_or_malformed_form_data(client):
    missing_password = client.post(
        "/api/auth/login", data={"username": "demo@example.com"}
    )
    missing_username = client.post(
        "/api/auth/login", data={"password": "correct-password"}
    )
    malformed = client.post(
        "/api/auth/login", content="{", headers={"content-type": "application/json"}
    )

    assert missing_password.status_code == 422
    assert missing_username.status_code == 422
    assert malformed.status_code == 422
    assert missing_password.json().get("detail")


@pytest.mark.parametrize("token", ["not-a-jwt", ""])
def test_me_rejects_invalid_or_missing_token(client, token):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    assert client.get("/api/auth/me", headers=headers).status_code == 401


@pytest.mark.parametrize(
    "authorization", ["Basic abc", "Bearer", "Bearer invalid.token"]
)
def test_me_rejects_invalid_authorization_header(client, authorization):
    response = client.get("/api/auth/me", headers={"Authorization": authorization})

    assert response.status_code == 401
    assert response.json() == {"detail": "Could not validate credentials"}


def test_me_rejects_expired_or_modified_tokens(client):
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    assert client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {expired}"}
    ).status_code == 401

    valid = jwt.encode(
        {"sub": "1", "exp": datetime.now(UTC) + timedelta(minutes=5)},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    modified = valid[:-1] + ("a" if valid[-1] != "a" else "b")
    assert client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {modified}"}
    ).status_code == 401
