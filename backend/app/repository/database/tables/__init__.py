"""SQLAlchemy table mappings."""

from app.repository.database.tables.device import Device, Observation, Parameter
from app.repository.database.tables.user import User

__all__ = ["Device", "Observation", "Parameter", "User"]
