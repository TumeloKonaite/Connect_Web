"""Device-based time-series table mappings."""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.repository.database.base import Base


class Device(Base):
    """A simulated monitoring device assigned to manufacturing records."""

    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_uid: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    parameters: Mapped[list["Parameter"]] = relationship(
        back_populates="device", cascade="all, delete-orphan"
    )


class Parameter(Base):
    """A numeric or text measurement tracked by a device."""

    __tablename__ = "parameters"
    __table_args__ = (
        CheckConstraint("data_type IN ('numeric', 'text')", name="ck_parameter_data_type"),
        UniqueConstraint("device_id", "name", name="uq_parameter_device_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    data_type: Mapped[str] = mapped_column(String(10), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(40))
    device: Mapped[Device] = relationship(back_populates="parameters")
    observations: Mapped[list["Observation"]] = relationship(
        back_populates="parameter", cascade="all, delete-orphan"
    )


class Observation(Base):
    """One timestamped observation, optionally traced to a source UDI."""

    __tablename__ = "observations"
    __table_args__ = (
        CheckConstraint(
            "(numeric_value IS NOT NULL AND text_value IS NULL) OR "
            "(numeric_value IS NULL AND text_value IS NOT NULL)",
            name="ck_observation_single_value",
        ),
        UniqueConstraint("parameter_id", "source_udi", name="uq_observation_source"),
        Index("ix_observation_parameter_timestamp", "parameter_id", "observed_at"),
        Index("ix_observation_source_udi", "source_udi"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parameter_id: Mapped[int] = mapped_column(ForeignKey("parameters.id", ondelete="CASCADE"), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    numeric_value: Mapped[float | None] = mapped_column(Float)
    text_value: Mapped[str | None] = mapped_column(String)
    source_udi: Mapped[int | None] = mapped_column(ForeignKey("machine_records.udi", ondelete="SET NULL"))
    parameter: Mapped[Parameter] = relationship(back_populates="observations")

    @property
    def device(self) -> Device:
        """Resolve the monitoring device through this observation's parameter."""
        return self.parameter.device

    def validate_value_type(self) -> None:
        """Reject values that do not match their associated parameter type."""
        if self.parameter is None:
            raise ValueError("observation parameter is required")
        if self.parameter.data_type == "numeric" and (self.numeric_value is None or self.text_value is not None):
            raise ValueError("numeric parameter requires only numeric_value")
        if self.parameter.data_type == "text" and (self.text_value is None or self.numeric_value is not None):
            raise ValueError("text parameter requires only text_value")
