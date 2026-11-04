"""Tests for deterministic simulated device dataset generation and import."""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.repository.database.base import Base
from app.repository.database.tables import Device, MachineRecord, Observation, Parameter
from app.services.device_data.dataset import import_dataset, transform_csv, validate_dataset

DATA = Path(__file__).resolve().parents[1] / "data" / "machine_records.csv"


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        yield db
    engine.dispose()


def test_transform_is_deterministic_typed_and_traceable():
    first = transform_csv(DATA)
    assert first == transform_csv(DATA)
    assert len(first["devices"]) == 4
    assert first["metadata"]["simulated"] is True
    first_device = first["devices"][0]
    numeric = first_device["parameters"][0]
    assert numeric["data_type"] == "numeric"
    assert numeric["unit"] == "K"
    assert numeric["observations"][0]["source_udi"] == 1
    assert numeric["observations"][0]["observed_at"] == datetime(2025, 1, 1, tzinfo=UTC).isoformat()
    categorical = first_device["parameters"][5]
    assert categorical["data_type"] == "text"
    assert categorical["observations"][0]["text_value"] == "M"
    assert categorical["observations"][0]["numeric_value"] is None
    validate_dataset(first)


def test_invalid_type_or_unsorted_time_is_rejected():
    payload = transform_csv(DATA)
    parameter = payload["devices"][0]["parameters"][0]
    parameter["observations"][1]["observed_at"] = "2024-01-01T00:00:00+00:00"
    with pytest.raises(ValueError, match="chronological"):
        validate_dataset(payload)


def test_import_relationships_and_repeat_import_are_idempotent(session):
    payload = transform_csv(DATA)
    source_records = {}
    for device in payload["devices"]:
        for parameter in device["parameters"]:
            for observation in parameter["observations"]:
                udi = observation["source_udi"]
                source_records[udi] = {
                    "udi": udi,
                    "product_id": f"M{udi}",
                    "type": "M",
                    "air_temperature": 298.1,
                    "process_temperature": 308.6,
                    "rotational_speed": 1500,
                    "torque": 40.0,
                    "tool_wear": 1,
                    "machine_failure": False,
                    "twf": False,
                    "hdf": False,
                    "pwf": False,
                    "osf": False,
                    "rnf": False,
                }
    session.add_all([MachineRecord(**record) for record in source_records.values()])
    session.commit()
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
    }
    assert again == {"devices_created": 0, "parameters_created": 0, "observations_created": 0}
    assert session.scalar(select(func.count()).select_from(Device)) == 4
    assert session.scalar(select(func.count()).select_from(Parameter)) == 28
    assert session.scalar(select(func.count()).select_from(Observation)) == observation_count
    observation = session.scalar(select(Observation).order_by(Observation.observed_at))
    assert observation.source_udi is not None
    assert observation.parameter.device.device_uid.startswith("demo-device-")


def test_json_value_type_is_validated():
    payload = transform_csv(DATA)
    payload["devices"][0]["parameters"][0]["observations"][0]["numeric_value"] = None
    with pytest.raises(ValueError, match="numeric parameter"):
        validate_dataset(payload)
