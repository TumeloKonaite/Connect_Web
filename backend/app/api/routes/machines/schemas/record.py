"""Machine record request and response models."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MachineRecordBase(BaseModel):
    """Common machine attributes accepted and returned by the API."""

    product_id: str = Field(min_length=1, examples=["M14860"])
    type: Literal["L", "M", "H"] = Field(examples=["M"])
    air_temperature: float = Field(examples=[298.1])
    process_temperature: float = Field(examples=[308.6])
    rotational_speed: int = Field(ge=0, examples=[1551])
    torque: float = Field(ge=0, examples=[42.8])
    tool_wear: int = Field(ge=0, examples=[0])
    machine_failure: bool = False
    twf: bool = False
    hdf: bool = False
    pwf: bool = False
    osf: bool = False
    rnf: bool = False


class MachineRecordCreate(MachineRecordBase):
    """Payload for creating a machine record."""

    udi: int = Field(gt=0, examples=[1])


class MachineRecordUpdate(BaseModel):
    """Payload for partially updating a machine record."""

    model_config = ConfigDict(extra="forbid")

    product_id: str | None = Field(default=None, min_length=1)
    type: Literal["L", "M", "H"] | None = None
    air_temperature: float | None = None
    process_temperature: float | None = None
    rotational_speed: int | None = Field(default=None, ge=0)
    torque: float | None = Field(default=None, ge=0)
    tool_wear: int | None = Field(default=None, ge=0)
    machine_failure: bool | None = None
    twf: bool | None = None
    hdf: bool | None = None
    pwf: bool | None = None
    osf: bool | None = None
    rnf: bool | None = None


class MachineRecordResponse(MachineRecordBase):
    """Serialized machine record."""

    model_config = ConfigDict(from_attributes=True)

    udi: int
