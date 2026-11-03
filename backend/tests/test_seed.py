"""Focused tests for CSV parsing and database seeding behavior."""

import csv
from io import StringIO

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.repository.database.base import Base
from app.repository.database.tables.machine_record import MachineRecord
from app.seed import FIELDS, import_csv, parse_record

engine = create_engine("sqlite://")
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture
def session():
    Base.metadata.create_all(bind=engine)
    db = TestingSession()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


def row(udi: int = 1) -> dict[str, str]:
    return {
        "udi": str(udi),
        "product_id": f"M{14860 + udi}",
        "type": "M",
        "air_temperature": "298.1",
        "process_temperature": "308.6",
        "rotational_speed": "1551",
        "torque": "42.8",
        "tool_wear": "7",
        "machine_failure": "true",
        "twf": "1",
        "hdf": "false",
        "pwf": "0",
        "osf": "no",
        "rnf": "yes",
    }


def csv_text(*rows: dict[str, str]) -> StringIO:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return output


def test_parse_record_maps_and_converts_all_fields():
    result = parse_record(row())
    assert result == {
        "udi": 1,
        "product_id": "M14861",
        "type": "M",
        "air_temperature": 298.1,
        "process_temperature": 308.6,
        "rotational_speed": 1551,
        "torque": 42.8,
        "tool_wear": 7,
        "machine_failure": True,
        "twf": True,
        "hdf": False,
        "pwf": False,
        "osf": False,
        "rnf": True,
    }


@pytest.mark.parametrize(
    "field,value",
    [
        ("udi", ""),
        ("udi", "1.5"),
        ("air_temperature", "nan"),
        ("rotational_speed", "fast"),
        ("type", "X"),
        ("torque", "-1"),
        ("machine_failure", "sometimes"),
        ("product_id", ""),
    ],
)
def test_invalid_values_are_rejected(field: str, value: str):
    values = row()
    values[field] = value
    with pytest.raises(ValueError):
        parse_record(values)


def test_duplicate_invalid_and_valid_rows_are_counted_and_continue(session):
    session.add(MachineRecord(**parse_record(row(1))))
    session.commit()
    invalid = row(2)
    invalid["type"] = "X"
    output = StringIO()
    counts = import_csv(csv_text(row(1), invalid, row(3)), session, output)
    assert counts == {"processed": 3, "duplicate": 1, "invalid": 1, "inserted": 1}
    assert session.get(MachineRecord, 1).product_id == "M14861"
    assert session.get(MachineRecord, 3) is not None
    assert "processed=3 inserted=1 duplicate=1 invalid=1 failed=0" in output.getvalue()


def test_empty_and_header_only_csv(session):
    assert import_csv(StringIO(""), session, StringIO()) == {}
    assert import_csv(csv_text(), session, StringIO()) == {}
    assert session.query(MachineRecord).count() == 0


def test_missing_headers_raise_clear_error(session):
    with pytest.raises(ValueError, match="missing required columns"):
        import_csv(StringIO("udi,product_id\n1,M1\n"), session, StringIO())


def test_database_failure_does_not_block_following_record(session, monkeypatch):
    original_commit = session.commit
    attempts = 0

    # Make the simulated failure a SQLAlchemy database error caught by importer.
    from sqlalchemy.exc import SQLAlchemyError

    def database_commit_failure():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise SQLAlchemyError("simulated failure")
        original_commit()

    monkeypatch.setattr(session, "commit", database_commit_failure)
    counts = import_csv(csv_text(row(1), row(2)), session, StringIO())
    assert counts == {"processed": 2, "failed": 1, "inserted": 1}
    assert session.get(MachineRecord, 1) is None
    assert session.get(MachineRecord, 2) is not None
