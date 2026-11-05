"""CRUD endpoints for machine records."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.api.routes.machines.schemas import (
    MachineRecordCreate,
    MachineRecordResponse,
    MachineRecordUpdate,
)
from app.repository.database.session import get_db
from app.repository.machine_records.repository import MachineRecordRepository

router = APIRouter(tags=["Machines"], dependencies=[Depends(get_current_user)])
DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=MachineRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a machine record",
    responses={409: {"description": "A record with this UDI already exists"}},
)
def create_machine_record(payload: MachineRecordCreate, db: DbSession) -> MachineRecordResponse:
    """Create a record identified by its dataset UDI."""
    repository = MachineRecordRepository(db)
    try:
        if repository.get(payload.udi) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="UDI already exists")
        return MachineRecordResponse.model_validate(repository.create(payload.model_dump()))
    except HTTPException:
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="UDI already exists") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create machine record") from exc


@router.get(
    "",
    response_model=list[MachineRecordResponse],
    summary="List machine records",
)
def list_machine_records(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[MachineRecordResponse]:
    """Return machine records ordered by UDI with limit and offset pagination."""
    try:
        rows = MachineRecordRepository(db).list(limit, offset)
        return [MachineRecordResponse.model_validate(row) for row in rows]
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to list machine records") from exc


@router.get(
    "/{udi}",
    response_model=MachineRecordResponse,
    summary="Get a machine record",
    responses={404: {"description": "Machine record not found"}},
)
def get_machine_record(
    udi: Annotated[int, Path(gt=0)], db: DbSession
) -> MachineRecordResponse:
    """Return one machine record by its positive UDI."""
    try:
        row = MachineRecordRepository(db).get(udi)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to retrieve machine record") from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine record not found")
    return MachineRecordResponse.model_validate(row)


@router.patch(
    "/{udi}",
    response_model=MachineRecordResponse,
    summary="Partially update a machine record",
    responses={404: {"description": "Machine record not found"}},
)
def update_machine_record(
    udi: Annotated[int, Path(gt=0)],
    payload: MachineRecordUpdate,
    db: DbSession,
) -> MachineRecordResponse:
    """Update fields supplied in the request while preserving omitted values."""
    changes = payload.model_dump(exclude_unset=True)
    if any(value is None for value in changes.values()):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Updated fields cannot be null")
    repository = MachineRecordRepository(db)
    try:
        if repository.get(udi) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine record not found")
        return MachineRecordResponse.model_validate(repository.update(udi, changes))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to update machine record") from exc


@router.delete(
    "/{udi}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Delete a machine record",
    responses={404: {"description": "Machine record not found"}},
)
def delete_machine_record(
    udi: Annotated[int, Path(gt=0)], db: DbSession
) -> Response:
    """Delete a machine record by UDI."""
    repository = MachineRecordRepository(db)
    try:
        if not repository.delete(udi):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine record not found")
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to delete machine record") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
