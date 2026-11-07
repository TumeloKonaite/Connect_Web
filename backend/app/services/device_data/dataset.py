"""Load, validate, and idempotently import timestamped device observations."""

import json
import math
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.repository.database.tables import Device, Observation, Parameter


def _utc_timestamp(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _parse_observed_at(value: Any) -> datetime:
    if not isinstance(value, str):
        raise ValueError("observed_at must be an ISO timestamp string")
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("observed_at must be an ISO timestamp") from exc
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise ValueError("observation timestamp must include a timezone")
    return timestamp


def _validate_observation(observation: Any, data_type: str) -> datetime:
    if not isinstance(observation, dict):
        raise ValueError("observation must be an object")
    timestamp = _parse_observed_at(observation.get("observed_at"))
    numeric = observation.get("numeric_value")
    text = observation.get("text_value")
    if data_type == "numeric":
        if (not isinstance(numeric, int | float) or isinstance(numeric, bool)
                or not math.isfinite(float(numeric)) or text is not None):
            raise ValueError("numeric parameter requires a finite numeric_value only")
    elif not isinstance(text, str) or numeric is not None:
        raise ValueError("text parameter requires text_value only")
    return timestamp


def load_dataset(source: Path | str) -> dict[str, Any]:
    try:
        payload = json.loads(Path(source).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"unable to read dataset JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError("dataset JSON must contain an object")
    validate_dataset(payload)
    return payload


def validate_dataset(payload: dict[str, Any]) -> None:
    """Validate dataset structure and every row, raising the first useful error."""
    if not isinstance(payload, dict) or not isinstance(payload.get("devices"), list):
        raise ValueError("dataset must contain a devices list")
    for device_index, device in enumerate(payload["devices"]):
        try:
            if not isinstance(device, dict):
                raise ValueError("device must be an object")
            if not isinstance(device.get("device_uid"), str) or not device["device_uid"].strip():
                raise ValueError("device_uid is required")
            if not isinstance(device.get("name"), str) or not device["name"].strip():
                raise ValueError("name is required")
            if device.get("description") is not None and not isinstance(device["description"], str):
                raise ValueError("description must be text or null")
            if not isinstance(device.get("parameters"), list):
                raise ValueError("parameters must be a list")
            for parameter_index, parameter in enumerate(device["parameters"]):
                if not isinstance(parameter, dict) or not isinstance(parameter.get("name"), str) or not parameter["name"].strip():
                    raise ValueError(f"parameter {parameter_index}: name is required")
                if parameter.get("data_type") not in {"numeric", "text"}:
                    raise ValueError(f"parameter {parameter_index}: data_type must be numeric or text")
                if parameter.get("unit") is not None and not isinstance(parameter["unit"], str):
                    raise ValueError(f"parameter {parameter_index}: unit must be text or null")
                if not isinstance(parameter.get("observations"), list):
                    raise ValueError(f"parameter {parameter_index}: observations must be a list")
                previous = None
                for observation_index, observation in enumerate(parameter["observations"]):
                    timestamp = _validate_observation(observation, parameter["data_type"])
                    if previous is not None and timestamp <= previous:
                        raise ValueError(f"parameter {parameter_index}, observation {observation_index}: observations must be chronological")
                    previous = timestamp
        except ValueError as exc:
            raise ValueError(f"device {device_index}: {exc}") from exc


def import_dataset(payload: dict[str, Any], session: Session) -> dict[str, Any]:
    """Import valid rows, skip duplicates, and report row-level validation failures."""
    if not isinstance(payload, dict) or not isinstance(payload.get("devices"), list):
        raise ValueError("dataset must contain a devices list")
    counts = {"devices_created": 0, "parameters_created": 0, "observations_created": 0,
              "rows_imported": 0, "rows_skipped": 0, "rows_rejected": 0, "errors": []}
    seen_devices: set[str] = set()
    try:
        for device_index, data in enumerate(payload["devices"]):
            row = f"devices[{device_index}]"
            try:
                if not isinstance(data, dict):
                    raise ValueError("device must be an object")
                uid, name = data.get("device_uid"), data.get("name")
                if not isinstance(uid, str) or not uid.strip():
                    raise ValueError("device_uid is required")
                if not isinstance(name, str) or not name.strip():
                    raise ValueError("name is required")
                if data.get("description") is not None and not isinstance(data["description"], str):
                    raise ValueError("description must be text or null")
                parameters_data = data.get("parameters")
                if not isinstance(parameters_data, list):
                    raise ValueError("parameters must be a list")
                if uid in seen_devices:
                    counts["rows_skipped"] += 1
                    continue
                seen_devices.add(uid)
                device = session.scalar(select(Device).where(Device.device_uid == uid))
                if device is None:
                    device = Device(device_uid=uid, name=name.strip(), description=data.get("description") or "")
                    session.add(device)
                    session.flush()
                    counts["devices_created"] += 1
                valid_device_rows = 0
                for parameter_index, p_data in enumerate(parameters_data):
                    prow = f"{row}.parameters[{parameter_index}]"
                    try:
                        if not isinstance(p_data, dict):
                            raise ValueError("parameter must be an object")
                        pname = p_data.get("name")
                        if not isinstance(pname, str) or not pname.strip():
                            raise ValueError("name is required")
                        dtype = p_data.get("data_type")
                        if dtype not in {"numeric", "text"}:
                            raise ValueError("data_type must be numeric or text")
                        if p_data.get("unit") is not None and not isinstance(p_data["unit"], str):
                            raise ValueError("unit must be text or null")
                        observations = p_data.get("observations")
                        if not isinstance(observations, list):
                            raise ValueError("observations must be a list")
                        parameter = session.scalar(select(Parameter).where(Parameter.device_id == device.id, Parameter.name == pname.strip()))
                        if parameter is None:
                            parameter = Parameter(device_id=device.id, name=pname.strip(), data_type=dtype, unit=p_data.get("unit"))
                            session.add(parameter)
                            session.flush()
                            counts["parameters_created"] += 1
                        elif parameter.data_type != dtype:
                            raise ValueError(f"parameter type conflict for {pname}")
                        existing = list(session.scalars(select(Observation).where(Observation.parameter_id == parameter.id)))
                        by_time = {_utc_timestamp(o.observed_at): o for o in existing}
                        previous = None
                        for observation_index, o_data in enumerate(observations):
                            orow = f"{prow}.observations[{observation_index}]"
                            try:
                                observed_at = _validate_observation(o_data, dtype)
                                if previous is not None and observed_at < previous:
                                    raise ValueError("observations must be chronological")
                                previous = observed_at
                                timestamp_key = _utc_timestamp(observed_at)
                                if timestamp_key in by_time:
                                    counts["rows_skipped"] += 1
                                    continue
                                observation = Observation(parameter_id=parameter.id, observed_at=observed_at,
                                    numeric_value=o_data.get("numeric_value"), text_value=o_data.get("text_value"))
                                session.add(observation)
                                session.flush()
                                counts["observations_created"] += 1
                                valid_device_rows += 1
                                by_time[timestamp_key] = observation
                            except ValueError as exc:
                                counts["rows_rejected"] += 1
                                counts["errors"].append({"row": orow, "reason": str(exc)})
                        if not observations:
                            valid_device_rows += 1
                    except ValueError as exc:
                        counts["rows_rejected"] += 1
                        counts["errors"].append({"row": prow, "reason": str(exc)})
                counts["rows_imported"] += valid_device_rows
            except ValueError as exc:
                counts["rows_rejected"] += 1
                counts["errors"].append({"row": row, "reason": str(exc)})
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise
    return counts
