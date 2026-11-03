"""Request and response schemas for machine record endpoints."""

from app.api.routes.machines.schemas.machine_record import (
    MachineRecordCreate,
    MachineRecordResponse,
    MachineRecordUpdate,
)

__all__ = ["MachineRecordCreate", "MachineRecordResponse", "MachineRecordUpdate"]
