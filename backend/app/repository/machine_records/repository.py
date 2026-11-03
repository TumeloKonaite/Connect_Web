"""Persistence operations for machine records."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repository.database.tables.machine_record import MachineRecord


class MachineRecordRepository:
    """Encapsulate database queries for machine records."""

    def __init__(self, db: Session) -> None:
        """Store the database session used by repository operations."""
        self.db = db

    def get(self, udi: int) -> MachineRecord | None:
        """Find and return one machine record by its UDI."""
        return self.db.get(MachineRecord, udi)

    def list(self, limit: int, offset: int) -> list[MachineRecord]:
        """Return a page of machine records ordered by UDI."""
        statement = select(MachineRecord).order_by(MachineRecord.udi).limit(limit).offset(offset)
        return list(self.db.scalars(statement))

    def create(self, values: dict[str, object]) -> MachineRecord:
        """Save a new machine record and return its persisted state."""
        record = MachineRecord(**values)
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def update(self, udi: int, changes: dict[str, object]) -> MachineRecord:
        """Apply supplied field changes and return the saved record."""
        record = self.db.get(MachineRecord, udi)
        if record is None:
            raise LookupError(f"Machine record {udi} does not exist")
        for field, value in changes.items():
            setattr(record, field, value)
        self.db.commit()
        self.db.refresh(record)
        return record

    def delete(self, udi: int) -> bool:
        """Mark a record for deletion; return whether it was found."""
        record = self.db.get(MachineRecord, udi)
        if record is None:
            return False
        self.db.delete(record)
        return True
