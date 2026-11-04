"""SQLAlchemy table mappings."""

from app.repository.database.tables.machine_record import MachineRecord
from app.repository.database.tables.device import Device, Observation, Parameter

__all__ = ["Device", "MachineRecord", "Observation", "Parameter"]
