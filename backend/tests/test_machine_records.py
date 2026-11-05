"""Tests for machine record CRUD endpoints using an isolated SQLite database."""

import csv
from io import StringIO

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.tokens import create_access_token
from app.main import app
from app.repository.database.base import Base
from app.repository.database.session import get_db
from app.repository.database.tables import User
from app.repository.database.tables.machine_record import MachineRecord  # noqa: F401
from app.services.machine_records.csv_import import FIELDS

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
    with TestingSessionLocal() as db:
        user = User(email="machine-tests@example.com", hashed_password="test-hash")
        db.add(user)
        db.commit()
        db.refresh(user)
    test_client = TestClient(app)
    test_client.headers["Authorization"] = f"Bearer {create_access_token(user.id)}"
    yield test_client
    test_client.close()
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_machine_routes_require_authentication(client: TestClient) -> None:
    authorization = client.headers.pop("Authorization")
    try:
        routes = (
            ("get", "/api/machines"),
            ("post", "/api/machines"),
            ("post", "/api/machines/import?filename=x.csv"),
        )
        for method, path in routes:
            response = getattr(client, method)(path)
            assert response.status_code == 401
            assert response.json() == {"detail": "Could not validate credentials"}
    finally:
        client.headers["Authorization"] = authorization


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


def test_create_and_reject_duplicate_udi(
    client: TestClient, machine_payload: dict[str, object]
) -> None:
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


def test_missing_required_field_does_not_create_record(
    client: TestClient, machine_payload: dict[str, object]
) -> None:
    del machine_payload["product_id"]

    response = client.post("/api/machines", json=machine_payload)

    assert response.status_code == 422
    assert client.get("/api/machines").json() == []


def test_list_paginates_in_udi_order(
    client: TestClient, machine_payload: dict[str, object]
) -> None:
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


def test_get_returns_persisted_record(
    client: TestClient, machine_payload: dict[str, object]
) -> None:
    created = client.post("/api/machines", json=machine_payload)
    assert created.status_code == 201

    retrieved = client.get("/api/machines/1")

    assert retrieved.status_code == 200
    assert retrieved.json() == created.json()


def to_csv(*rows: dict[str, object]) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def test_csv_import_inserts_valid_rows_and_reports_duplicates_and_invalid_rows(
    client: TestClient, machine_payload: dict[str, object]
) -> None:
    client.post("/api/machines", json=machine_payload)
    new_record = {**machine_payload, "udi": 2, "product_id": "M20000"}
    invalid_record = {**machine_payload, "udi": 3, "type": "X"}

    response = client.post(
        "/api/machines/import",
        params={"filename": "machines.csv"},
        content=to_csv(machine_payload, new_record, invalid_record),
        headers={"content-type": "text/csv"},
    )

    assert response.status_code == 200
    assert response.json()["processed"] == 3
    assert response.json()["inserted"] == 1
    assert response.json()["duplicate"] == 1
    assert response.json()["invalid"] == 1
    assert response.json()["issues"][0]["kind"] == "duplicate"
    assert response.json()["issues"][1]["kind"] == "invalid"
    assert client.get("/api/machines/2").json()["product_id"] == "M20000"
    assert client.get("/api/machines/3").status_code == 404


def test_csv_import_accepts_original_ai4i_column_headings(
    client: TestClient, machine_payload: dict[str, object]
) -> None:
    headings = (
        "UDI",
        "Product ID",
        "Type",
        "Air temperature [K]",
        "Process temperature [K]",
        "Rotational speed [rpm]",
        "Torque [Nm]",
        "Tool wear [min]",
        "Machine failure",
        "TWF",
        "HDF",
        "PWF",
        "OSF",
        "RNF",
    )
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=headings)
    writer.writeheader()
    writer.writerow(
        {
            heading: machine_payload[field]
            for heading, field in zip(headings, FIELDS, strict=True)
        }
    )

    response = client.post(
        "/api/machines/import",
        params={"filename": "ai4i2020.csv"},
        content=output.getvalue(),
        headers={"content-type": "text/csv"},
    )

    assert response.status_code == 200
    assert response.json()["inserted"] == 1
    assert client.get("/api/machines/1").json()["product_id"] == "M14860"


@pytest.mark.parametrize(
    ("filename", "content_type", "body", "expected_status"),
    [
        ("machines.txt", "text/csv", "", 415),
        ("machines.csv", "application/json", "", 415),
        ("machines.csv", "text/csv", "", 422),
        ("machines.csv", "text/csv", "udi,product_id\n1,M1\n", 422),
        ("machines.csv", "text/csv", bytes([0xFF, 0xFE]), 422),
    ],
)
def test_csv_import_rejects_invalid_uploads_without_writes(
    client: TestClient,
    filename: str,
    content_type: str,
    body: str | bytes,
    expected_status: int,
) -> None:
    response = client.post(
        "/api/machines/import",
        params={"filename": filename},
        content=body,
        headers={"content-type": content_type},
    )

    assert response.status_code == expected_status
    assert client.get("/api/machines").json() == []


def test_delete_returns_no_body_and_removes_record(
    client: TestClient, machine_payload: dict[str, object]
) -> None:
    client.post("/api/machines", json=machine_payload)
    deleted = client.delete("/api/machines/1")
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get("/api/machines/1").status_code == 404
    assert client.delete("/api/machines/1").status_code == 404
