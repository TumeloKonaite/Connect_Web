"""Tests for directly creating timestamped device observations."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.routes.devices.schemas import ObservationCreate
from app.repository.database.base import Base
from app.repository.database.tables import Device, Observation, Parameter
from app.services.device_data.observations import (
    DeviceNotFoundError,
    ParameterNotFoundError,
    create_device_observation,
)


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        device = Device(device_uid="demo-device", name="Demo", description="Test")
        device.parameters.extend(
            [
                Parameter(name="temperature", data_type="numeric", unit="K"),
                Parameter(name="status", data_type="text", unit=None),
            ]
        )
        db.add(device)
        db.commit()
        yield db
    engine.dispose()


def test_create_device_observation_persists_value_and_timestamp(session: Session):
    timestamp = datetime(2025, 1, 1, 12, 30, tzinfo=UTC)

    observation = create_device_observation(
        session,
        device_uid="demo-device",
        parameter_name="temperature",
        observed_at=timestamp,
        numeric_value=301.25,
        text_value=None,
    )

    stored = session.scalar(select(Observation).where(Observation.id == observation.id))
    assert stored is not None
    assert stored.numeric_value == 301.25
    assert stored.text_value is None
    assert stored.observed_at.replace(tzinfo=UTC) == timestamp


@pytest.mark.parametrize(
    ("device_uid", "parameter_name", "numeric_value", "text_value", "error"),
    [
        ("missing", "temperature", 1.0, None, DeviceNotFoundError),
        ("demo-device", "missing", 1.0, None, ParameterNotFoundError),
        ("demo-device", "temperature", None, "hot", ValueError),
        ("demo-device", "status", 1.0, None, ValueError),
    ],
)
def test_create_observation_rejects_missing_resources_and_type_mismatch(
    session: Session,
    device_uid: str,
    parameter_name: str,
    numeric_value: float | None,
    text_value: str | None,
    error: type[Exception],
):
    with pytest.raises(error):
        create_device_observation(
            session,
            device_uid=device_uid,
            parameter_name=parameter_name,
            observed_at=datetime(2025, 1, 1, tzinfo=UTC),
            numeric_value=numeric_value,
            text_value=text_value,
        )


@pytest.mark.parametrize(
    "payload",
    [
        {"parameter": "temperature", "observed_at": "2025-01-01T00:00:00Z"},
        {
            "parameter": "temperature",
            "observed_at": "2025-01-01T00:00:00Z",
            "numeric_value": 1,
            "text_value": "two",
        },
        {
            "parameter": "temperature",
            "observed_at": "2025-01-01T00:00:00",
            "numeric_value": 1,
        },
    ],
)
def test_observation_create_schema_requires_one_value_and_timezone(payload):
    with pytest.raises(ValueError):
        ObservationCreate.model_validate(payload)
