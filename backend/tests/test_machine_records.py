"""Tests for machine record CRUD endpoints using an isolated SQLite database."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.repository.database.base import Base
from app.repository.database.session import get_db
from app.repository.database.tables.machine_record import MachineRecord  # noqa: F401

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture
def client() -> TestClient:
    """Provide a fresh database and test client for each test."""
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def machine_payload() -> dict[str, object]:
    """Return one valid machine record creation payload."""
    return {
        "udi": 1,
        "product_id": "M14860",
        "type": "M",
        "air_temperature": 298.1,
        "process_temperature": 308.6,
        "rotational_speed": 1551,
        "torque": 42.8,
        "tool_wear": 0,
        "machine_failure": False,
        "twf": False,
        "hdf": False,
        "pwf": False,
        "osf": False,
        "rnf": False,
    }


def test_create_and_reject_duplicate_udi(client: TestClient, machine_payload: dict[str, object]) -> None:
    created = client.post("/api/machines", json=machine_payload)
    assert created.status_code == 201
    assert created.json()["udi"] == 1

    duplicate = client.post("/api/machines", json=machine_payload)
    assert duplicate.status_code == 409
    assert duplicate.json() == {"detail": "UDI already exists"}


@pytest.mark.parametrize(
    "changes",
    [
        {"type": "X"},
        {"rotational_speed": -1},
        {"torque": -0.1},
        {"tool_wear": -1},
        {"machine_failure": "not-a-bool"},
    ],
)
def test_invalid_create_payload_returns_422(
    client: TestClient, machine_payload: dict[str, object], changes: dict[str, object]
) -> None:
    machine_payload.update(changes)
    response = client.post("/api/machines", json=machine_payload)
    assert response.status_code == 422


def test_list_paginates_in_udi_order(client: TestClient, machine_payload: dict[str, object]) -> None:
    for udi in (3, 1, 2):
        client.post("/api/machines", json={**machine_payload, "udi": udi})

    first_page = client.get("/api/machines", params={"limit": 2, "offset": 0})
    second_page = client.get("/api/machines", params={"limit": 2, "offset": 2})
    assert first_page.status_code == 200
    assert [row["udi"] for row in first_page.json()] == [1, 2]
    assert [row["udi"] for row in second_page.json()] == [3]
    assert client.get("/api/machines", params={"limit": 0}).status_code == 422
    assert client.get("/api/machines", params={"limit": 501}).status_code == 422
    assert client.get("/api/machines", params={"offset": -1}).status_code == 422


def test_get_missing_or_invalid_udi(client: TestClient) -> None:
    assert client.get("/api/machines/9").status_code == 404
    assert client.get("/api/machines/0").status_code == 422
    assert client.get("/api/machines/not-an-integer").status_code == 422


def test_patch_only_changes_supplied_fields(
    client: TestClient, machine_payload: dict[str, object]
) -> None:
    client.post("/api/machines", json=machine_payload)
    response = client.patch("/api/machines/1", json={"tool_wear": 5})
    assert response.status_code == 200
    assert response.json()["tool_wear"] == 5
    assert response.json()["product_id"] == "M14860"
    assert response.json()["air_temperature"] == 298.1
    assert client.patch("/api/machines/1", json={"tool_wear": None}).status_code == 422
    assert client.patch("/api/machines/1", json={"type": "X"}).status_code == 422
    assert client.patch("/api/machines/1", json={"udi": 7}).status_code == 422
    assert client.get("/api/machines/1").status_code == 200
    assert client.patch("/api/machines/8", json={"tool_wear": 1}).status_code == 404


def test_delete_returns_no_body_and_removes_record(
    client: TestClient, machine_payload: dict[str, object]
) -> None:
    client.post("/api/machines", json=machine_payload)
    deleted = client.delete("/api/machines/1")
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get("/api/machines/1").status_code == 404
    assert client.delete("/api/machines/1").status_code == 404
