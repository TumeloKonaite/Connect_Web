"""Response models for device and time-series endpoints."""

from datetime import datetime
from typing import Literal

import math

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    """One timestamped parameter observation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    parameter_id: int
    observed_at: datetime
    numeric_value: float | None
    text_value: str | None


class ObservationCreate(BaseModel):
    """Create one timestamped observation for a device parameter."""

    model_config = ConfigDict(extra="forbid")

    parameter: str = Field(min_length=1)
    observed_at: datetime
    numeric_value: float | None = Field(default=None, allow_inf_nan=False)
    text_value: str | None = None

    @field_validator("parameter")
    @classmethod
    def strip_parameter(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("parameter must not be empty")
        return value

    @model_validator(mode="after")
    def validate_observation_value(self) -> "ObservationCreate":
        if (self.numeric_value is None) == (self.text_value is None):
            raise ValueError("provide exactly one of numeric_value or text_value")
        if self.observed_at.tzinfo is None or self.observed_at.utcoffset() is None:
            raise ValueError("observed_at must include a timezone")
        if self.numeric_value is not None and not math.isfinite(self.numeric_value):
            raise ValueError("numeric_value must be finite")
        return self
