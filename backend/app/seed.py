"""Import the bundled manufacturing sample CSV into PostgreSQL."""

import argparse
import csv
import math
import sys
from collections import Counter
from pathlib import Path
from typing import TextIO

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.repository.database.session import SessionLocal
from app.repository.database.tables.machine_record import MachineRecord

DATASET_PATH = Path(__file__).resolve().parents[1] / "data" / "machine_records.csv"
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


class InvalidRecord(ValueError):
    """A CSV row that cannot represent a valid machine record."""


def parse_record(row: dict[str, str | None]) -> dict[str, object]:
    """Validate and convert one DictReader row into model field values."""
    result: dict[str, object] = {}
    for field in FIELDS:
        raw = row.get(field)
        if raw is None or not raw.strip():
            raise InvalidRecord(f"missing value for {field}")
        value = raw.strip()
        try:
            if field in INTEGER_FIELDS:
                # Reject decimal representations for integral model fields.
                if any(char in value.lower() for char in (".", "e")):
                    raise ValueError
                parsed: object = int(value)
            elif field in FLOAT_FIELDS:
                parsed = float(value)
                if not math.isfinite(parsed):
                    raise ValueError
            elif field in BOOLEAN_FIELDS:
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
            raise InvalidRecord(f"invalid {field}: {value!r}") from exc
        result[field] = parsed

    if result["udi"] <= 0:
        raise InvalidRecord("udi must be positive")
    if not result["product_id"]:
        raise InvalidRecord("product_id must not be empty")
    if result["type"] not in {"L", "M", "H"}:
        raise InvalidRecord("type must be L, M, or H")
    for field in ("rotational_speed", "torque", "tool_wear"):
        if result[field] < 0:
            raise InvalidRecord(f"{field} must be nonnegative")
    return result


def import_csv(
    file: TextIO, session: Session, output: TextIO = sys.stdout
) -> Counter[str]:
    """Import CSV rows independently, preserving existing records on conflicts."""
    counts: Counter[str] = Counter()
    reader = csv.DictReader(file)
    if reader.fieldnames is None:
        print(
            "Import summary: processed=0 inserted=0 duplicate=0 invalid=0 failed=0",
            file=output,
        )
        return counts

    missing_headers = set(FIELDS) - set(reader.fieldnames)
    if missing_headers:
        raise ValueError(
            f"CSV is missing required columns: {', '.join(sorted(missing_headers))}"
        )

    for line_number, row in enumerate(reader, start=2):
        counts["processed"] += 1
        if None in row:
            counts["invalid"] += 1
            print(f"Row {line_number}: skipped (extra CSV columns)", file=output)
            continue
        try:
            values = parse_record(row)
        except InvalidRecord as exc:
            counts["invalid"] += 1
            print(f"Row {line_number}: skipped (invalid: {exc})", file=output)
            continue

        try:
            # Check before insert so existing records are never modified.
            if session.get(MachineRecord, values["udi"]) is not None:
                counts["duplicate"] += 1
                print(
                    f"Row {line_number}: skipped (duplicate UDI {values['udi']})",
                    file=output,
                )
                continue
            session.add(MachineRecord(**values))
            session.commit()
            counts["inserted"] += 1
        except SQLAlchemyError as exc:
            session.rollback()
            counts["failed"] += 1
            print(f"Row {line_number}: failed ({type(exc).__name__})", file=output)

    if reader.line_num < 1:
        counts["failed"] += 1

    print(
        "Import summary: "
        + " ".join(
            f"{key}={counts[key]}"
            for key in ("processed", "inserted", "duplicate", "invalid", "failed")
        ),
        file=output,
    )
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--file", type=Path, default=DATASET_PATH, help="CSV file to import"
    )
    args = parser.parse_args()
    try:
        with (
            args.file.open(newline="", encoding="utf-8-sig") as source,
            SessionLocal() as session,
        ):
            import_csv(source, session)
    except (OSError, ValueError, csv.Error, SQLAlchemyError) as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
