"""Add devices, parameters and time-series observations."""

from alembic import op
import sqlalchemy as sa

revision = "20261104_0003"
down_revision = "20261103_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("device_uid", sa.String(80), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
    )
    op.create_table(
        "parameters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("device_id", sa.Integer(), sa.ForeignKey("devices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("data_type", sa.String(10), nullable=False),
        sa.Column("unit", sa.String(40)),
        sa.CheckConstraint("data_type IN ('numeric', 'text')", name="ck_parameter_data_type"),
        sa.UniqueConstraint("device_id", "name", name="uq_parameter_device_name"),
    )
    op.create_index("ix_parameters_device_id", "parameters", ["device_id"])
    op.create_table(
        "observations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("parameter_id", sa.Integer(), sa.ForeignKey("parameters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("numeric_value", sa.Float()),
        sa.Column("text_value", sa.String()),
        sa.Column("source_udi", sa.Integer(), sa.ForeignKey("machine_records.udi", ondelete="SET NULL")),
        sa.CheckConstraint(
            "(numeric_value IS NOT NULL AND text_value IS NULL) OR "
            "(numeric_value IS NULL AND text_value IS NOT NULL)",
            name="ck_observation_single_value",
        ),
        sa.UniqueConstraint("parameter_id", "source_udi", name="uq_observation_source"),
    )
    op.create_index("ix_observation_parameter_timestamp", "observations", ["parameter_id", "observed_at"])
    op.create_index("ix_observation_source_udi", "observations", ["source_udi"])


def downgrade() -> None:
    op.drop_index("ix_observation_source_udi", table_name="observations")
    op.drop_index("ix_observation_parameter_timestamp", table_name="observations")
    op.drop_table("observations")
    op.drop_index("ix_parameters_device_id", table_name="parameters")
    op.drop_table("parameters")
    op.drop_table("devices")
