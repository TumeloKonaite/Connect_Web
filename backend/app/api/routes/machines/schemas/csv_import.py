"""Schemas for CSV import responses."""

from typing import Literal

from pydantic import BaseModel


class CsvImportIssueResponse(BaseModel):
    """A row-level issue encountered during an import."""

    line: int
    kind: Literal["duplicate", "invalid", "failed"]
    message: str


class CsvImportResponse(BaseModel):
    """Counts and bounded row details for an uploaded CSV."""

    filename: str
    processed: int
    inserted: int
    duplicate: int
    invalid: int
    failed: int
    issues: list[CsvImportIssueResponse]
    omitted_issues: int
