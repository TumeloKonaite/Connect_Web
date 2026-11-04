"""Validate and import machine records from CSV files."""

import csv
import math
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from typing import TextIO

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.repository.database.tables.machine_record import MachineRecord

FIELDS = (
    "udi",
    "product_id",
    "type",
    "air_temperature",
    "process_temperature",
    "rotational_speed",
    "torque",
    "tool_wear",
    "machine_failure",
    "twf",
    "hdf",
    "pwf",
    "osf",
    "rnf",
)
INTEGER_FIELDS = {"udi", "rotational_speed", "tool_wear"}
FLOAT_FIELDS = {"air_temperature", "process_temperature", "torque"}
BOOLEAN_FIELDS = {"machine_failure", "twf", "hdf", "pwf", "osf", "rnf"}
TRUE_VALUES = {"true", "1", "yes"}
FALSE_VALUES = {"false", "0", "no"}
MAX_CSV_ROWS = 10_000
MAX_REPORTED_ISSUES = 100


class InvalidRecord(ValueError):
    """A CSV row that cannot represent a valid machine record."""


class CsvImportTooLarge(ValueError):
    """The CSV contains more data rows than the importer accepts."""


@dataclass
class CsvImportIssue:
    """A row-level result that needs the user's attention."""

    line: int
    kind: str
    message: str


@dataclass
class CsvImportResult:
    """Counts and bounded details returned after importing a CSV file."""

    counts: Counter[str] = field(default_factory=Counter)
    issues: list[CsvImportIssue] = field(default_factory=list)
    issue_count: int = 0

    def add_issue(self, line: int, kind: str, message: str) -> None:
        self.issue_count += 1
        if len(self.issues) < MAX_REPORTED_ISSUES:
            self.issues.append(CsvImportIssue(line, kind, message))


def parse_record(row: dict[str, str | None]) -> dict[str, object]:
    """Validate and convert one DictReader row into model field values."""
    result: dict[str, object] = {}
    for field_name in FIELDS:
        raw = row.get(field_name)
        if raw is None or not raw.strip():
            raise InvalidRecord(f"missing value for {field_name}")
        value = raw.strip()
        try:
            if field_name in INTEGER_FIELDS:
                if any(char in value.lower() for char in (".", "e")):
                    raise ValueError
                parsed: object = int(value)
            elif field_name in FLOAT_FIELDS:
                parsed = float(value)
                if not math.isfinite(parsed):
                    raise ValueError
            elif field_name in BOOLEAN_FIELDS:
                normalized = value.lower()
                if normalized in TRUE_VALUES:
                    parsed = True
                elif normalized in FALSE_VALUES:
                    parsed = False
                else:
                    raise ValueError
            else:
                parsed = value
        except ValueError as exc:
            raise InvalidRecord(f"invalid {field_name}: {value!r}") from exc
        result[field_name] = parsed

    if result["udi"] <= 0:
        raise InvalidRecord("udi must be positive")
    if not result["product_id"]:
        raise InvalidRecord("product_id must not be empty")
    if result["type"] not in {"L", "M", "H"}:
        raise InvalidRecord("type must be L, M, or H")
    for field_name in ("rotational_speed", "torque", "tool_wear"):
        if result[field_name] < 0:
            raise InvalidRecord(f"{field_name} must be nonnegative")
    return result


def normalize_header(header: str) -> str:
    """Map human-readable AI4I headings to the API's snake_case fields."""
    without_units = re.sub(r"\s*\[[^]]*\]", "", header.strip().lower())
    return re.sub(r"[^a-z0-9]+", "_", without_units).strip("_")


def import_machine_csv(file: TextIO, session: Session) -> CsvImportResult:
    """Validate a complete CSV, then import valid rows without overwriting."""
    reader = csv.DictReader(file, strict=True)
    if reader.fieldnames is None:
        return CsvImportResult()

    normalized_headers = [normalize_header(header) for header in reader.fieldnames]
    duplicate_headers = {
        header for header in normalized_headers if normalized_headers.count(header) > 1
    }
    if duplicate_headers:
        raise ValueError(
            "CSV contains duplicate columns: " + ", ".join(sorted(duplicate_headers))
        )
    header_map = dict(zip(normalized_headers, reader.fieldnames, strict=True))
    missing_headers = set(FIELDS) - set(header_map)
    if missing_headers:
        raise ValueError(
            f"CSV is missing required columns: {', '.join(sorted(missing_headers))}"
        )

    # Parse the complete document before writing, so malformed CSV or an
    # oversized file cannot leave a partially imported batch.
    rows: list[dict[str, str | None]] = []
    for source_row in reader:
        row = {
            field_name: source_row.get(header_map[field_name]) for field_name in FIELDS
        }
        if None in source_row:
            row[None] = source_row[None]
        rows.append(row)
        if len(rows) > MAX_CSV_ROWS:
            raise CsvImportTooLarge(f"CSV exceeds the {MAX_CSV_ROWS} row limit")

    result = CsvImportResult()
    valid_rows: list[tuple[int, dict[str, object]]] = []
    seen_udis: set[int] = set()
    for line_number, row in enumerate(rows, start=2):
        result.counts["processed"] += 1
        if None in row:
            result.counts["invalid"] += 1
            result.add_issue(line_number, "invalid", "row has extra columns")
            continue
        try:
            values = parse_record(row)
        except InvalidRecord as exc:
            result.counts["invalid"] += 1
            result.add_issue(line_number, "invalid", str(exc))
            continue

        udi = values["udi"]
        if udi in seen_udis:
            result.counts["duplicate"] += 1
            result.add_issue(line_number, "duplicate", f"UDI {udi} is repeated in this CSV")
            continue
        seen_udis.add(udi)
        valid_rows.append((line_number, values))

    # Use one lookup and commit per chunk so a normal 10k-row import does not
    # issue thousands of sequential database round trips. Retry a failed
    # chunk row by row to isolate any unexpected database constraint error.
    chunk_size = 500
    for offset in range(0, len(valid_rows), chunk_size):
        chunk = valid_rows[offset : offset + chunk_size]
        try:
            udis = [values["udi"] for _, values in chunk]
            existing_udis = set(
                session.scalars(
                    select(MachineRecord.udi).where(MachineRecord.udi.in_(udis))
                )
            )
        except SQLAlchemyError:
            session.rollback()
            for line_number, _ in chunk:
                result.counts["failed"] += 1
                result.add_issue(line_number, "failed", "database error while checking UDI")
            continue

        to_insert: list[tuple[int, dict[str, object]]] = []
        for line_number, values in chunk:
            udi = values["udi"]
            if udi in existing_udis:
                result.counts["duplicate"] += 1
                result.add_issue(line_number, "duplicate", f"UDI {udi} already exists")
            else:
                to_insert.append((line_number, values))

        if not to_insert:
            continue
        session.add_all([MachineRecord(**values) for _, values in to_insert])
        try:
            session.commit()
        except SQLAlchemyError:
            session.rollback()
            for line_number, values in to_insert:
                try:
                    udi = values["udi"]
                    if session.get(MachineRecord, udi) is not None:
                        result.counts["duplicate"] += 1
                        result.add_issue(
                            line_number, "duplicate", f"UDI {udi} already exists"
                        )
                        continue
                    session.add(MachineRecord(**values))
                    session.commit()
                    result.counts["inserted"] += 1
                except SQLAlchemyError:
                    session.rollback()
                    result.counts["failed"] += 1
                    result.add_issue(
                        line_number, "failed", "database error while saving row"
                    )
        else:
            result.counts["inserted"] += len(to_insert)

    result.issues.sort(key=lambda issue: issue.line)
    return result


def import_csv(
    file: TextIO, session: Session, output: TextIO = sys.stdout
) -> Counter[str]:
    """CLI-compatible importer that prints a concise summary."""
    result = import_machine_csv(file, session)
    for issue in result.issues:
        print(f"Row {issue.line}: {issue.kind} ({issue.message})", file=output)
    print(
        "Import summary: "
        + " ".join(
            f"{key}={result.counts[key]}"
            for key in ("processed", "inserted", "duplicate", "invalid", "failed")
        ),
        file=output,
    )
    return result.counts
