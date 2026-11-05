"""SQLAlchemy table mappings."""

from app.repository.database.tables.device import Device, Observation, Parameter
from app.repository.database.tables.machine_record import MachineRecord
from app.repository.database.tables.user import User

__all__ = ["Device", "MachineRecord", "Observation", "Parameter", "User"]
