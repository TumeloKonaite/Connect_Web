"""Device listing, detail, and time-filtered observation endpoints."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies.auth import get_current_user
from app.api.errors import raise_database_error
from app.api.routes.devices.schemas import (
    DeviceResponse,
    DeviceSummaryResponse,
    ObservationResponse,
)
from app.repository.database.session import get_db
from app.repository.database.tables import Device, Observation
from app.services.device_data.observations import (
    DeviceNotFoundError,
    InvalidTimeRangeError,
    NumericParameterRequiredError,
    ParameterNotFoundError,
    list_device_observations as query_device_observations,
)

router = APIRouter(
    prefix="/api/devices", tags=["Devices"], dependencies=[Depends(get_current_user)]
)
DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[DeviceSummaryResponse], summary="List devices")
def list_devices(db: DbSession) -> list[Device]:
    """Return all devices ordered by their stable device identifier."""
    try:
        return list(db.scalars(select(Device).order_by(Device.device_uid)))
    except SQLAlchemyError as exc:
        raise_database_error(db, "Unable to list devices", exc)


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
        raise_database_error(db, "Unable to retrieve device", exc)
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
    try:
        return query_device_observations(
            db,
            device_uid=device_uid,
            parameter=parameter,
            start=start,
            end=end,
            min_value=min_value,
            max_value=max_value,
            limit=limit,
            offset=offset,
        )
    except DeviceNotFoundError:
        raise HTTPException(status_code=404, detail="Device not found") from None
    except ParameterNotFoundError:
        raise HTTPException(status_code=404, detail="Parameter not found") from None
    except InvalidTimeRangeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    except NumericParameterRequiredError:
        raise HTTPException(
            status_code=422,
            detail="min_value and max_value can only be used with numeric parameters",
        ) from None
    except SQLAlchemyError as exc:
        raise_database_error(db, "Unable to retrieve observations", exc)
