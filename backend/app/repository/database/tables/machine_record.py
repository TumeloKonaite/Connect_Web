"""Manufacturing machine record table mapping."""

from sqlalchemy import Boolean, CheckConstraint, Float, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.repository.database.base import Base


class MachineRecord(Base):
    """One row of machine operation and failure sensor data."""

    __tablename__ = "machine_records"
    __table_args__ = (
        CheckConstraint("type IN ('L', 'M', 'H')", name="ck_machine_records_type"),
        CheckConstraint("rotational_speed >= 0", name="ck_machine_records_speed_nonnegative"),
        CheckConstraint("torque >= 0", name="ck_machine_records_torque_nonnegative"),
        CheckConstraint("tool_wear >= 0", name="ck_machine_records_tool_wear_nonnegative"),
    )

    udi: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    product_id: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String(1), nullable=False)
    air_temperature: Mapped[float] = mapped_column(Float, nullable=False)
    process_temperature: Mapped[float] = mapped_column(Float, nullable=False)
    rotational_speed: Mapped[int] = mapped_column(Integer, nullable=False)
    torque: Mapped[float] = mapped_column(Float, nullable=False)
    tool_wear: Mapped[int] = mapped_column(Integer, nullable=False)
    machine_failure: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    twf: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    hdf: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    pwf: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    osf: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    rnf: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
