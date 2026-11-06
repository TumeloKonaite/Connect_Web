"""Validate and import the timestamped demo device dataset."""

import argparse
import json
from pathlib import Path

from app.repository.database.session import SessionLocal
from app.services.device_data.dataset import import_dataset, load_dataset

DEFAULT_DATASET = (
    Path(__file__).resolve().parents[2] / "data" / "factory_sensor_demo_7days.json"
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset", type=Path, default=DEFAULT_DATASET, help="Timestamped dataset JSON"
    )
    parser.add_argument(
        "--validate-only", action="store_true", help="Validate without importing"
    )
    args = parser.parse_args()
    payload = load_dataset(args.dataset)
    print(f"Validated dataset: {args.dataset}")
    if args.validate_only:
        return 0
    with SessionLocal() as session:
        print(
            "Import summary: "
            + json.dumps(import_dataset(payload, session), sort_keys=True)
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
