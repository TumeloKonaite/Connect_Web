"""Response models for device and time-series endpoints."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ParameterResponse(BaseModel):
    """A parameter configured for a monitoring device."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    data_type: Literal["numeric", "text"]
    unit: str | None


class DeviceSummaryResponse(BaseModel):
    """Device fields used by the device selector."""

    model_config = ConfigDict(from_attributes=True)

    device_uid: str
    name: str
    description: str


class DeviceResponse(DeviceSummaryResponse):
    """Device with its associated parameters."""

    parameters: list[ParameterResponse]


class ObservationResponse(BaseModel):
    """One parameter observation and its source record reference."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    parameter_id: int
    observed_at: datetime
    numeric_value: float | None
    text_value: str | None
    source_udi: int | None
