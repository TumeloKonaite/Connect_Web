"""Persistence operations for machine records."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.repository.database.tables.machine_record import MachineRecord


@dataclass
class CsvPersistenceResult:
    """Persistence outcomes keyed by source CSV line number."""

    inserted: int = 0
    duplicates: list[tuple[int, str]] = field(default_factory=list)
    failures: list[tuple[int, str]] = field(default_factory=list)


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

    def persist_csv_rows(
        self, rows: list[tuple[int, dict[str, object]]]
    ) -> CsvPersistenceResult:
        """Persist parsed CSV rows efficiently, isolating failures by row."""
        result = CsvPersistenceResult()
        chunk_size = 500
        for offset in range(0, len(rows), chunk_size):
            chunk = rows[offset : offset + chunk_size]
            try:
                udis = [values["udi"] for _, values in chunk]
                existing_udis = set(
                    self.db.scalars(
                        select(MachineRecord.udi).where(MachineRecord.udi.in_(udis))
                    )
                )
            except SQLAlchemyError:
                self.db.rollback()
                result.failures.extend(
                    (line_number, "database error while checking UDI")
                    for line_number, _ in chunk
                )
                continue

            to_insert: list[tuple[int, dict[str, object]]] = []
            for line_number, values in chunk:
                udi = values["udi"]
                if udi in existing_udis:
                    result.duplicates.append(
                        (line_number, f"UDI {udi} already exists")
                    )
                else:
                    to_insert.append((line_number, values))

            if not to_insert:
                continue
            self.db.add_all([MachineRecord(**values) for _, values in to_insert])
            try:
                self.db.commit()
            except SQLAlchemyError:
                self.db.rollback()
                for line_number, values in to_insert:
                    try:
                        udi = values["udi"]
                        if self.db.get(MachineRecord, udi) is not None:
                            result.duplicates.append(
                                (line_number, f"UDI {udi} already exists")
                            )
                            continue
                        self.db.add(MachineRecord(**values))
                        self.db.commit()
                        result.inserted += 1
                    except SQLAlchemyError:
                        self.db.rollback()
                        result.failures.append(
                            (line_number, "database error while saving row")
                        )
            else:
                result.inserted += len(to_insert)
        return result
