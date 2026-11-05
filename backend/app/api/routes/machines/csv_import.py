"""CSV import route for machine records."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.api.handlers.machine_csv_import import (
    import_machine_records_csv as handle_csv_import,
)
from app.api.routes.machines.schemas import CsvImportResponse
from app.repository.database.session import get_db

router = APIRouter(tags=["Machine CSV import"], dependencies=[Depends(get_current_user)])
DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "/import",
    response_model=CsvImportResponse,
    summary="Import machine records from a CSV file",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"text/csv": {"schema": {"type": "string", "format": "binary"}}},
        }
    },
    responses={413: {"description": "CSV file is too large"}},
)
async def import_machine_records_csv(
    db: DbSession,
    request: Request,
    filename: Annotated[str, Query(min_length=1)],
) -> CsvImportResponse:
    """Delegate the uploaded request to the CSV import operation."""
    return await handle_csv_import(request, filename, db)
