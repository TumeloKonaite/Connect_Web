"""Validation rules for device observation queries."""

from datetime import datetime


class InvalidTimeRangeError(ValueError):
    """Raised when observation time bounds are invalid."""


def validate_time_range(start: datetime | None, end: datetime | None) -> None:
    """Require explicit time zones and a non-reversed observation range."""
    if start is not None and start.tzinfo is None:
        raise InvalidTimeRangeError("start must include a timezone")
    if end is not None and end.tzinfo is None:
        raise InvalidTimeRangeError("end must include a timezone")
    if start is not None and end is not None and start > end:
        raise InvalidTimeRangeError("start must be before or equal to end")
