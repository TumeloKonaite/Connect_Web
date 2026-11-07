"""Tests for loading and importing the supplied timestamped demo dataset."""

from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.repository.database.base import Base
from app.repository.database.tables import Device, Observation, Parameter
from app.services.device_data.dataset import (
    import_dataset,
    load_dataset,
    validate_dataset,
)

DATA = Path(__file__).resolve().parents[1] / "data" / "factory_sensor_demo_7days.json"


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        yield db
    engine.dispose()


def test_load_dataset_preserves_timestamps_and_typed_values():
    first = load_dataset(DATA)
    assert len(first["devices"]) == 4
    assert (
        sum(
            len(parameter["observations"])
            for device in first["devices"]
            for parameter in device["parameters"]
        )
        == 56_448
    )
    first_device = first["devices"][0]
    numeric = first_device["parameters"][0]
    assert numeric["data_type"] == "numeric"
    assert numeric["unit"] == "K"
    assert numeric["observations"][0]["observed_at"] == "2026-01-10T08:00:00Z"
    categorical = first_device["parameters"][5]
    assert categorical["data_type"] == "text"
    assert categorical["observations"][0]["text_value"] is not None
    assert categorical["observations"][0]["numeric_value"] is None


def test_invalid_type_or_unsorted_time_is_rejected():
    payload = load_dataset(DATA)
    parameter = payload["devices"][0]["parameters"][0]
    parameter["observations"][1]["observed_at"] = "2024-01-01T00:00:00+00:00"
    with pytest.raises(ValueError, match="chronological"):
        validate_dataset(payload)


def test_import_relationships_and_repeat_import_are_idempotent(session):
    payload = load_dataset(DATA)
    assert "machine_records" not in Base.metadata.tables
    first = import_dataset(payload, session)
    again = import_dataset(payload, session)
    observation_count = sum(
        len(parameter["observations"])
        for device in payload["devices"]
        for parameter in device["parameters"]
    )
    assert first == {
        "devices_created": 4,
        "parameters_created": 28,
        "observations_created": observation_count,
        "rows_imported": observation_count,
        "rows_skipped": 0,
        "rows_rejected": 0,
        "errors": [],
    }
    assert again == {
        "devices_created": 0,
        "parameters_created": 0,
        "observations_created": 0,
        "rows_imported": 0,
        "rows_skipped": observation_count,
        "rows_rejected": 0,
        "errors": [],
    }
    assert session.scalar(select(func.count()).select_from(Device)) == 4
    assert session.scalar(select(func.count()).select_from(Parameter)) == 28
    assert (
        session.scalar(select(func.count()).select_from(Observation))
        == observation_count
    )
    observation = session.scalar(select(Observation).order_by(Observation.observed_at))
    assert observation.parameter.device.device_uid.startswith("demo-device-")


def test_json_value_type_is_validated():
    payload = load_dataset(DATA)
    payload["devices"][0]["parameters"][0]["observations"][0]["numeric_value"] = None
    with pytest.raises(ValueError, match="numeric parameter"):
        validate_dataset(payload)


def test_import_skips_bad_rows_and_duplicate_observations(session):
    payload = {"devices": [{"device_uid": "mixed", "name": "Mixed", "parameters": [
        {"name": "temperature", "data_type": "numeric", "unit": None, "observations": [
            {"observed_at": "2025-01-01T00:00:00Z", "numeric_value": 12.5, "text_value": None},
            {"observed_at": "bad-time", "numeric_value": 13, "text_value": None},
            {"observed_at": "2025-01-01T00:00:00Z", "numeric_value": 12.5, "text_value": None},
            {"observed_at": "2025-01-01T00:01:00Z", "numeric_value": "bad", "text_value": None},
        ]}
    ]}]}
    result = import_dataset(payload, session)
    assert result["observations_created"] == 1
    assert result["rows_skipped"] == 1
    assert result["rows_rejected"] == 2
    assert len(result["errors"]) == 2
    assert session.scalar(select(func.count()).select_from(Observation)) == 1


def test_invalid_required_fields_reject_device_without_crashing(session):
    result = import_dataset({"devices": [
        {"device_uid": "", "name": "Missing UID", "parameters": []},
        {"device_uid": "valid", "name": "Valid", "parameters": []},
    ]}, session)
    assert result["rows_rejected"] == 1
    assert session.scalar(select(func.count()).select_from(Device)) == 1
