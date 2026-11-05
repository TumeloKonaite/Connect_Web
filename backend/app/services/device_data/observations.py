"""Application workflow for querying device observations."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.repository.database.tables import Observation
from app.repository.device_data.repository import DeviceDataRepository
from app.services.device_data.validation import (
    InvalidTimeRangeError,
    validate_time_range,
)


class DeviceNotFoundError(Exception):
    """Raised when an observation query refers to an unknown device."""


class ParameterNotFoundError(Exception):
    """Raised when a requested parameter is not configured on a device."""


class NumericParameterRequiredError(Exception):
    """Raised when numeric value filters are used with a text parameter."""


def list_device_observations(
    db: Session,
    *,
    device_uid: str,
    parameter: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    min_value: float | None = None,
    max_value: float | None = None,
    limit: int = 500,
    offset: int = 0,
) -> list[Observation]:
    """Validate and retrieve a device's observations via the repository."""
    validate_time_range(start, end)
    if min_value is not None and max_value is not None and min_value > max_value:
        raise ValueError("min_value must be less than or equal to max_value")

    repository = DeviceDataRepository(db)
    device_id = repository.get_device_id(device_uid)
    if device_id is None:
        raise DeviceNotFoundError

    parameter_id = None
    if parameter is not None:
        configured_parameter = repository.get_parameter(device_uid, parameter)
        if configured_parameter is None:
            raise ParameterNotFoundError
        if configured_parameter.data_type == "text" and (
            min_value is not None or max_value is not None
        ):
            raise NumericParameterRequiredError
        parameter_id = configured_parameter.id

    return repository.list_observations(
        device_id=device_id,
        parameter_id=parameter_id,
        start=start,
        end=end,
        min_value=min_value,
        max_value=max_value,
        limit=limit,
        offset=offset,
    )
