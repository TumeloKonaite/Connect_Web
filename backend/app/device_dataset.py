"""CLI to generate JSON and import the simulated device dataset."""

import argparse
import json
from pathlib import Path

from app.repository.database.session import SessionLocal
from app.services.device_data.dataset import import_dataset, transform_csv, write_json

DEFAULT_CSV = Path(__file__).resolve().parents[1] / "data" / "machine_records.csv"
DEFAULT_JSON = Path(__file__).resolve().parents[1] / "data" / "device_observations.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--generate-only", action="store_true")
    args = parser.parse_args()
    payload = transform_csv(args.csv)
    write_json(payload, args.json)
    print(f"Generated validated dataset: {args.json}")
    if not args.generate_only:
        with SessionLocal() as session:
            print("Import summary: " + json.dumps(import_dataset(payload, session), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
