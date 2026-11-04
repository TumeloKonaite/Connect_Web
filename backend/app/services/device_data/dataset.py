"""Build and idempotently import simulated time-series observations."""

import csv
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.repository.database.tables import Device, MachineRecord, Observation, Parameter
from app.services.machine_records.csv_import import FIELDS, parse_record

START_TIME = datetime(2025, 1, 1, tzinfo=timezone.utc)
INTERVAL = timedelta(minutes=5)
DEVICE_COUNT = 4
DEVICE_ASSIGNMENT = "device index = (UDI - 1) modulo 4; assignments are simulated"
PARAMETER_SPECS = (
    ("air_temperature", "numeric", "K", "air_temperature"),
    ("process_temperature", "numeric", "K", "process_temperature"),
    ("rotational_speed", "numeric", "rpm", "rotational_speed"),
    ("torque", "numeric", "Nm", "torque"),
    ("tool_wear", "numeric", "min", "tool_wear"),
    ("product_type", "text", None, "type"),
    ("machine_failure", "text", None, "machine_failure"),
)


def transform_csv(source: Path | str) -> dict[str, Any]:
    """Return reproducible devices, typed parameters and source-linked observations."""
    with Path(source).open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames is None:
            raise ValueError("CSV has no header")
        rows = [parse_record(row) for row in reader]

    devices = [
        {
            "device_uid": f"demo-device-{index + 1}",
            "name": f"Demonstration Machine Monitor {index + 1}",
            "description": f"Simulated device for UDI modulo {DEVICE_COUNT} assignment.",
            "parameters": [
                {"name": name, "data_type": kind, "unit": unit, "observations": []}
                for name, kind, unit, _ in PARAMETER_SPECS
            ],
        }
        for index in range(DEVICE_COUNT)
    ]
    for row in rows:
        device_index = (int(row["udi"]) - 1) % DEVICE_COUNT
        timestamp = START_TIME + INTERVAL * (int(row["udi"]) - 1)
        for parameter_index, (_, kind, _, field) in enumerate(PARAMETER_SPECS):
            value = row[field]
            if field == "machine_failure":
                value = "failure" if value else "normal"
            devices[device_index]["parameters"][parameter_index]["observations"].append(
                {
                    "observed_at": timestamp.isoformat(),
                    "source_udi": row["udi"],
                    "numeric_value": float(value) if kind == "numeric" else None,
                    "text_value": str(value) if kind == "text" else None,
                }
            )
    return {
        "metadata": {
            "simulated": True,
            "source_dataset": "AI4I2020 machine_records.csv",
            "device_assignment": DEVICE_ASSIGNMENT,
            "timestamp_start_utc": START_TIME.isoformat(),
            "timestamp_interval_minutes_per_UDI": int(INTERVAL.total_seconds() // 60),
            "timestamp_note": "Generated schedule; not original collection times.",
        },
        "devices": devices,
    }


def validate_dataset(payload: dict[str, Any]) -> None:
    """Validate shape, parameter typing, finite numbers and timestamp ordering."""
    if not isinstance(payload, dict) or not isinstance(payload.get("devices"), list):
        raise ValueError("dataset must contain a devices list")
    device_uids: set[str] = set()
    for device in payload["devices"]:
        if not isinstance(device, dict) or not device.get("device_uid") or not device.get("name"):
            raise ValueError("each device requires device_uid and name")
        if device["device_uid"] in device_uids:
            raise ValueError("device_uid values must be unique")
        device_uids.add(device["device_uid"])
        names: set[str] = set()
        for parameter in device.get("parameters", []):
            if parameter.get("data_type") not in {"numeric", "text"}:
                raise ValueError("parameter data_type must be numeric or text")
            if parameter.get("name") in names:
                raise ValueError("parameter names must be unique per device")
            names.add(parameter["name"])
            previous: datetime | None = None
            for observation in parameter.get("observations", []):
                timestamp = datetime.fromisoformat(observation["observed_at"])
                if timestamp.tzinfo is None:
                    raise ValueError("observation timestamps must include a timezone")
                if previous is not None and timestamp <= previous:
                    raise ValueError("observations must be chronological")
                previous = timestamp
                numeric = observation.get("numeric_value")
                text = observation.get("text_value")
                if parameter["data_type"] == "numeric":
                    if numeric is None or text is not None or not math.isfinite(float(numeric)):
                        raise ValueError("numeric parameter requires a finite numeric_value only")
                elif text is None or numeric is not None:
                    raise ValueError("text parameter requires text_value only")


def write_json(payload: dict[str, Any], destination: Path | str) -> None:
    validate_dataset(payload)
    Path(destination).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def import_dataset(payload: dict[str, Any], session: Session) -> dict[str, int]:
    """Import atomically; existing device keys and source observations are kept."""
    validate_dataset(payload)
    created_devices = created_parameters = created_observations = 0
    try:
        source_udis = {
            observation.get("source_udi")
            for device_data in payload["devices"]
            for parameter_data in device_data["parameters"]
            for observation in parameter_data["observations"]
            if observation.get("source_udi") is not None
        }
        known_udis = (
            set(session.scalars(select(MachineRecord.udi).where(MachineRecord.udi.in_(source_udis))))
            if source_udis
            else set()
        )
        if source_udis != known_udis:
            raise ValueError(f"source UDI does not exist in machine_records: {sorted(source_udis - known_udis)[:10]}")
        for device_data in payload["devices"]:
            device = session.scalar(select(Device).where(Device.device_uid == device_data["device_uid"]))
            if device is None:
                device = Device(
                    device_uid=device_data["device_uid"],
                    name=device_data["name"],
                    description=device_data.get("description", ""),
                )
                session.add(device)
                session.flush()
                created_devices += 1
            for parameter_data in device_data["parameters"]:
                parameter = session.scalar(
                    select(Parameter).where(
                        Parameter.device_id == device.id,
                        Parameter.name == parameter_data["name"],
                    )
                )
                if parameter is None:
                    parameter = Parameter(
                        device_id=device.id,
                        name=parameter_data["name"],
                        data_type=parameter_data["data_type"],
                        unit=parameter_data.get("unit"),
                    )
                    session.add(parameter)
                    session.flush()
                    created_parameters += 1
                elif parameter.data_type != parameter_data["data_type"]:
                    raise ValueError(f"parameter type conflict for {parameter.name}")
                existing = set(session.scalars(select(Observation.source_udi).where(
                    Observation.parameter_id == parameter.id,
                    Observation.source_udi.is_not(None),
                )))
                latest = session.scalar(
                    select(Observation.observed_at)
                    .where(Observation.parameter_id == parameter.id)
                    .order_by(Observation.observed_at.desc())
                    .limit(1)
                )
                for observation_data in parameter_data["observations"]:
                    if observation_data["source_udi"] in existing:
                        continue
                    observation = Observation(
                        parameter_id=parameter.id,
                        observed_at=datetime.fromisoformat(observation_data["observed_at"]),
                        numeric_value=observation_data.get("numeric_value"),
                        text_value=observation_data.get("text_value"),
                        source_udi=observation_data.get("source_udi"),
                    )
                    observation.parameter = parameter
                    observation.validate_value_type()
                    if latest is not None and observation.observed_at <= latest:
                        raise ValueError(f"observation timestamps are not increasing for {parameter.name}")
                    session.add(observation)
                    existing.add(observation_data["source_udi"])
                    latest = observation.observed_at
                    created_observations += 1
        session.commit()
    except (SQLAlchemyError, ValueError):
        session.rollback()
        raise
    return {"devices_created": created_devices, "parameters_created": created_parameters,
            "observations_created": created_observations}
