"""Import the bundled manufacturing sample CSV into PostgreSQL."""

import argparse
import csv
import sys
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

from app.repository.database.session import SessionLocal
from app.services.machine_records.csv_import import import_csv

DATASET_PATH = Path(__file__).resolve().parents[1] / "data" / "machine_records.csv"


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
