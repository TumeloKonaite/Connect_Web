"""SQLAlchemy queries for device observation data."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repository.database.tables import Device, Observation, Parameter


class DeviceDataRepository:
    """Execute database queries for device data."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_device_id(self, device_uid: str) -> int | None:
        """Return a device's database ID, if it exists."""
        return self.db.scalar(select(Device.id).where(Device.device_uid == device_uid))

    def get_parameter(self, device_uid: str, name: str) -> Parameter | None:
        """Return a named parameter belonging to the requested device."""
        return self.db.scalar(
            select(Parameter)
            .join(Device)
            .where(Device.device_uid == device_uid, Parameter.name == name)
        )

    def list_observations(
        self,
        *,
        device_id: int,
        parameter_id: int | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        min_value: float | None = None,
        max_value: float | None = None,
        limit: int = 500,
        offset: int = 0,
    ) -> list[Observation]:
        """Fetch observations using filters, chronological ordering, and pagination."""
        statement = select(Observation)
        if parameter_id is not None:
            statement = statement.where(Observation.parameter_id == parameter_id)
        else:
            statement = statement.join(Parameter).where(Parameter.device_id == device_id)
        if start is not None:
            statement = statement.where(Observation.observed_at >= start)
        if end is not None:
            statement = statement.where(Observation.observed_at <= end)
        if min_value is not None:
            statement = statement.where(Observation.numeric_value >= min_value)
        if max_value is not None:
            statement = statement.where(Observation.numeric_value <= max_value)
        statement = statement.order_by(Observation.observed_at, Observation.id)
        return list(self.db.scalars(statement.limit(limit).offset(offset)))
