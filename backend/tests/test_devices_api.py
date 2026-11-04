"""Tests for the read-only device and observation API."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.repository.database.base import Base
from app.repository.database.session import get_db
from app.repository.database.tables import Device, Observation, Parameter

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
    with TestClient(app) as test_client:
        yield test_client
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
