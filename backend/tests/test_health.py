"""Tests for the health endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_openapi_docs_are_available() -> None:
    assert client.get("/docs").status_code == 200
    schema_response = client.get("/openapi.json")
    assert schema_response.status_code == 200
    paths = schema_response.json()["paths"]
    assert "/health" in paths
    assert "/api/machines" not in paths
    assert "/api/devices" in paths


def test_timestamped_observation_create_route_is_registered() -> None:
    operation = app.openapi()["paths"]["/api/devices/{device_uid}/observations"]

    assert "get" in operation
    assert "post" in operation
    assert "post" in app.openapi()["paths"]["/api/devices/import"]
