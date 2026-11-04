"""Device listing, detail, and time-filtered observation endpoints."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.routes.devices.schemas import (
    DeviceResponse,
    DeviceSummaryResponse,
    ObservationResponse,
)
from app.repository.database.session import get_db
from app.repository.database.tables import Device, Observation, Parameter

router = APIRouter(prefix="/api/devices", tags=["Devices"])
DbSession = Annotated[Session, Depends(get_db)]


def _validate_time_range(start: datetime | None, end: datetime | None) -> None:
    """Require explicit time zones and a non-reversed range."""
    if start is not None and start.tzinfo is None:
        raise HTTPException(status_code=422, detail="start must include a timezone")
    if end is not None and end.tzinfo is None:
        raise HTTPException(status_code=422, detail="end must include a timezone")
    if start is not None and end is not None and start > end:
        raise HTTPException(status_code=422, detail="start must be before or equal to end")


def _raise_database_error(db: Session, message: str, exc: SQLAlchemyError) -> None:
    db.rollback()
    raise HTTPException(status_code=500, detail=message) from exc


@router.get("", response_model=list[DeviceSummaryResponse], summary="List devices")
def list_devices(db: DbSession) -> list[Device]:
    """Return all devices ordered by their stable device identifier."""
    try:
        return list(db.scalars(select(Device).order_by(Device.device_uid)))
    except SQLAlchemyError as exc:
        _raise_database_error(db, "Unable to list devices", exc)


@router.get(
    "/{device_uid}",
    response_model=DeviceResponse,
    summary="Get a device and its parameters",
    responses={404: {"description": "Device not found"}},
)
def get_device(device_uid: str, db: DbSession) -> Device:
    """Return one device and its parameters, or 404 when it does not exist."""
    try:
        device = db.scalar(
            select(Device)
            .where(Device.device_uid == device_uid)
            .options(selectinload(Device.parameters))
        )
    except SQLAlchemyError as exc:
        _raise_database_error(db, "Unable to retrieve device", exc)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.get(
    "/{device_uid}/observations",
    response_model=list[ObservationResponse],
    summary="List device observations",
    responses={404: {"description": "Device or parameter not found"}},
)
def list_device_observations(
    device_uid: str,
    db: DbSession,
    parameter: Annotated[str | None, Query(min_length=1)] = None,
    start: datetime | None = None,
    end: datetime | None = None,
    min_value: float | None = None,
    max_value: float | None = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 500,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Observation]:
    """Return chronologically ordered observations with optional filters."""
    _validate_time_range(start, end)
    if min_value is not None and max_value is not None and min_value > max_value:
        raise HTTPException(
            status_code=422,
            detail="min_value must be less than or equal to max_value",
        )
    try:
        parameter_statement = select(Parameter.id).join(Device).where(
            Device.device_uid == device_uid
        )
        if parameter is not None:
            parameter_id = db.scalar(
                parameter_statement.where(Parameter.name == parameter)
            )
            if parameter_id is None:
                device_exists = db.scalar(
                    select(Device.id).where(Device.device_uid == device_uid)
                )
                detail = "Device not found" if device_exists is None else "Parameter not found"
                raise HTTPException(status_code=404, detail=detail)
            parameter_type = db.scalar(
                parameter_statement.where(Parameter.name == parameter).with_only_columns(Parameter.data_type)
            )
            if parameter_type == "text" and (min_value is not None or max_value is not None):
                raise HTTPException(
                    status_code=422,
                    detail="min_value and max_value can only be used with numeric parameters",
                )
            statement = select(Observation).where(Observation.parameter_id == parameter_id)
        else:
            device_id = db.scalar(select(Device.id).where(Device.device_uid == device_uid))
            if device_id is None:
                raise HTTPException(status_code=404, detail="Device not found")
            statement = (
                select(Observation)
                .join(Parameter)
                .where(Parameter.device_id == device_id)
            )
        if start is not None:
            statement = statement.where(Observation.observed_at >= start)
        if end is not None:
            statement = statement.where(Observation.observed_at <= end)
        if min_value is not None:
            statement = statement.where(Observation.numeric_value >= min_value)
        if max_value is not None:
            statement = statement.where(Observation.numeric_value <= max_value)
        statement = statement.order_by(Observation.observed_at, Observation.id)
        return list(db.scalars(statement.limit(limit).offset(offset)))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        _raise_database_error(db, "Unable to retrieve observations", exc)
