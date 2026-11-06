"""Device listing, detail, and time-filtered observation endpoints."""

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies.auth import get_current_user
from app.api.errors import raise_database_error
from app.api.routes.devices.schemas import (
    DeviceResponse,
    DeviceSummaryResponse,
    ObservationCreate,
    ObservationResponse,
)
from app.repository.database.session import get_db
from app.repository.database.tables import Device, Observation
from app.services.device_data.dataset import import_dataset
from app.services.device_data.observations import (
    DeviceNotFoundError,
    NumericParameterRequiredError,
    ParameterNotFoundError,
)
from app.services.device_data.observations import (
    create_device_observation as persist_device_observation,
)
from app.services.device_data.observations import (
    list_device_observations as query_device_observations,
)
from app.services.device_data.validation import InvalidTimeRangeError

router = APIRouter(
    prefix="/api/devices", tags=["Devices"], dependencies=[Depends(get_current_user)]
)
DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "/import",
    status_code=status.HTTP_200_OK,
    summary="Import a batch of devices, parameters, and observations",
)
def import_device_dataset(payload: dict[str, Any], db: DbSession) -> dict[str, Any]:
    """Validate and transactionally import a complete nested device dataset."""
    try:
        return import_dataset(payload, db)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    except SQLAlchemyError as exc:
        raise_database_error(db, "Unable to import device dataset", exc)


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Device not found"
        )
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


@router.post(
    "/{device_uid}/observations",
    response_model=ObservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a device observation",
    responses={404: {"description": "Device or parameter not found"}},
)
def create_device_observation(
    device_uid: str, payload: ObservationCreate, db: DbSession
) -> Observation:
    """Store a timestamped value for a parameter configured on the device."""
    try:
        return persist_device_observation(
            db,
            device_uid=device_uid,
            parameter_name=payload.parameter,
            observed_at=payload.observed_at,
            numeric_value=payload.numeric_value,
            text_value=payload.text_value,
        )
    except DeviceNotFoundError:
        raise HTTPException(status_code=404, detail="Device not found") from None
    except ParameterNotFoundError:
        raise HTTPException(status_code=404, detail="Parameter not found") from None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    except SQLAlchemyError as exc:
        raise_database_error(db, "Unable to create observation", exc)
