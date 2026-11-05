"""CSV import endpoint for machine records."""

import csv
from io import StringIO
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.routes.auth.auth import get_current_user
from app.api.routes.machines.schemas import CsvImportResponse
from app.repository.database.session import get_db
from app.services.machine_records.csv_import import (
    CsvImportTooLarge,
    import_machine_csv,
)

router = APIRouter(tags=["Machine CSV import"], dependencies=[Depends(get_current_user)])
DbSession = Annotated[Session, Depends(get_db)]
MAX_CSV_BYTES = 5 * 1024 * 1024


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
    """Import valid CSV rows, skipping duplicates and reporting invalid rows."""
    if Path(filename).suffix.lower() != ".csv":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a .csv file",
        )

    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type not in {"text/csv", "application/csv", "application/octet-stream"}:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Set the request content type to text/csv",
        )

    contents = bytearray()
    async for chunk in request.stream():
        contents.extend(chunk)
        if len(contents) > MAX_CSV_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="CSV file exceeds the 5 MiB upload limit",
            )
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV file is empty or missing its header row",
        )
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV must use UTF-8 encoding",
        ) from exc
    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV file is empty or missing its header row",
        )

    try:
        result = import_machine_csv(StringIO(text, newline=""), db)
    except CsvImportTooLarge as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        ) from exc
    except csv.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV format is invalid",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    counts = result.counts
    return CsvImportResponse(
        filename=Path(filename).name,
        processed=counts["processed"],
        inserted=counts["inserted"],
        duplicate=counts["duplicate"],
        invalid=counts["invalid"],
        failed=counts["failed"],
        issues=[
            {"line": issue.line, "kind": issue.kind, "message": issue.message}
            for issue in result.issues
        ],
        omitted_issues=result.issue_count - len(result.issues),
    )
