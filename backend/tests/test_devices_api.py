"""Tests for the read-only device and observation API."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.tokens import create_access_token
from app.main import app
from app.repository.database.base import Base
from app.repository.database.session import get_db
from app.repository.database.tables import Device, Observation, Parameter, User

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture
def client() -> TestClient:
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestingSessionLocal() as db:
        user = User(email="device-tests@example.com", hashed_password="test-hash")
        db.add(user)
        db.commit()
        db.refresh(user)
    test_client = TestClient(app)
    test_client.headers["Authorization"] = f"Bearer {create_access_token(user.id)}"
    yield test_client
    test_client.close()
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def add_device_data() -> None:
    with TestingSessionLocal() as db:
        first = Device(device_uid="demo-device-1", name="Monitor 1", description="Demo")
        second = Device(device_uid="demo-device-2", name="Monitor 2", description="Demo")
        temperature = Parameter(
            name="air_temperature", data_type="numeric", unit="K", device=first
        )
        status = Parameter(name="status", data_type="text", unit=None, device=first)
        other = Parameter(name="air_temperature", data_type="numeric", unit="K", device=second)
        base = datetime(2025, 1, 1, tzinfo=UTC)
        temperature.observations.extend(
            [
                Observation(observed_at=base + timedelta(minutes=5), numeric_value=299.0),
                Observation(observed_at=base, numeric_value=298.0),
            ]
        )
        status.observations.append(Observation(observed_at=base, text_value="normal"))
        other.observations.append(Observation(observed_at=base, numeric_value=300.0))
        db.add_all([first, second])
        db.commit()


def test_device_routes_require_authentication(client: TestClient) -> None:
    authorization = client.headers.pop("Authorization")
    try:
        for path in ("/api/devices", "/api/devices/demo-device/observations"):
            response = client.get(path)
            assert response.status_code == 401
            assert response.json() == {"detail": "Could not validate credentials"}
    finally:
        client.headers["Authorization"] = authorization


def test_list_devices_is_ordered(client: TestClient) -> None:
    add_device_data()
    response = client.get("/api/devices")
    assert response.status_code == 200
    assert [row["device_uid"] for row in response.json()] == [
        "demo-device-1",
        "demo-device-2",
    ]


def test_device_detail_includes_parameters_and_missing_device_is_404(
    client: TestClient,
) -> None:
    add_device_data()
    response = client.get("/api/devices/demo-device-1")
    assert response.status_code == 200
    assert {parameter["name"] for parameter in response.json()["parameters"]} == {
        "air_temperature",
        "status",
    }
    assert client.get("/api/devices/missing").status_code == 404


def test_device_detail_returns_empty_parameter_list_for_unconfigured_device(
    client: TestClient,
) -> None:
    with TestingSessionLocal() as db:
        db.add(Device(device_uid="empty-device", name="Empty", description="No sensors yet"))
        db.commit()

    response = client.get("/api/devices/empty-device")

    assert response.status_code == 200
    assert response.json()["parameters"] == []


def test_device_detail_exposes_parameter_type_and_unit(client: TestClient) -> None:
    add_device_data()

    response = client.get("/api/devices/demo-device-1")

    assert response.status_code == 200
    parameters = {item["name"]: item for item in response.json()["parameters"]}
    assert parameters["air_temperature"]["data_type"] == "numeric"
    assert parameters["air_temperature"]["unit"] == "K"
    assert parameters["status"]["data_type"] == "text"
    assert parameters["status"]["unit"] is None


def test_observations_filter_parameter_and_time_and_sort_chronologically(
    client: TestClient,
) -> None:
    add_device_data()
    response = client.get(
        "/api/devices/demo-device-1/observations",
        params={
            "parameter": "air_temperature",
            "start": "2025-01-01T00:02:00Z",
            "limit": 1,
        },
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["numeric_value"] == 299.0
    observed_at = datetime.fromisoformat(response.json()[0]["observed_at"])
    assert observed_at.replace(tzinfo=UTC) == datetime(2025, 1, 1, 0, 5, tzinfo=UTC)
    assert client.get(
        "/api/devices/demo-device-1/observations", params={"parameter": "unknown"}
    ).status_code == 404


def test_observation_time_boundaries_are_inclusive_and_empty_ranges_return_empty(
    client: TestClient,
) -> None:
    add_device_data()
    response = client.get(
        "/api/devices/demo-device-1/observations",
        params={
            "parameter": "air_temperature",
            "start": "2025-01-01T00:00:00Z",
            "end": "2025-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 200
    assert [item["numeric_value"] for item in response.json()] == [298.0]
    empty = client.get(
        "/api/devices/demo-device-1/observations",
        params={
            "parameter": "air_temperature",
            "start": "2025-01-02T00:00:00Z",
            "end": "2025-01-03T00:00:00Z",
        },
    )
    assert empty.status_code == 200
    assert empty.json() == []


@pytest.mark.parametrize(
    ("filters", "expected"),
    [
        ({"min_value": 299}, [299.0]),
        ({"max_value": 298}, [298.0]),
        ({"min_value": 298, "max_value": 299}, [298.0, 299.0]),
        ({"min_value": 300}, []),
        ({"min_value": 299, "max_value": 299}, [299.0]),
    ],
)
def test_numeric_value_filters_are_inclusive_and_paginated_after_filtering(
    client: TestClient, filters: dict[str, int], expected: list[float]
) -> None:
    add_device_data()
    response = client.get(
        "/api/devices/demo-device-1/observations",
        params={"parameter": "air_temperature", **filters},
    )
    assert response.status_code == 200
    assert [row["numeric_value"] for row in response.json()] == expected


def test_value_filters_validate_ranges_and_reject_text_parameters(client: TestClient) -> None:
    add_device_data()
    base = "/api/devices/demo-device-1/observations"
    assert client.get(base, params={"min_value": 2, "max_value": 1}).status_code == 422
    text_filter = client.get(base, params={"parameter": "status", "min_value": 1})
    assert text_filter.status_code == 422
    assert "numeric parameters" in text_filter.json()["detail"]
    text_observations = client.get(base, params={"parameter": "status"})
    assert text_observations.status_code == 200
    assert text_observations.json()[0]["text_value"] == "normal"


def test_numeric_and_time_filters_compose(client: TestClient) -> None:
    add_device_data()
    response = client.get(
        "/api/devices/demo-device-1/observations",
        params={
            "parameter": "air_temperature",
            "start": "2025-01-01T00:02:00Z",
            "min_value": 298,
            "max_value": 299,
        },
    )
    assert response.status_code == 200
    assert [row["numeric_value"] for row in response.json()] == [299.0]
    assert client.get(
        "/api/devices/missing/observations"
    ).status_code == 404


@pytest.mark.parametrize(
    "params",
    [
        {"start": "2025-01-01T00:00:00"},
        {"end": "2025-01-01T00:00:00"},
        {"start": "2025-01-02T00:00:00Z", "end": "2025-01-01T00:00:00Z"},
        {"limit": 0},
        {"offset": -1},
    ],
)
def test_invalid_observation_filters_return_422(
    client: TestClient, params: dict[str, str | int]
) -> None:
    add_device_data()
    assert (
        client.get("/api/devices/demo-device-1/observations", params=params).status_code
        == 422
    )
