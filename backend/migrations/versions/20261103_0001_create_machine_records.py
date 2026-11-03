"""Create machine_records table.

Revision ID: 20261103_0001
Revises:
Create Date: 2026-11-03
"""

from alembic import op
import sqlalchemy as sa

revision = "20261103_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "machine_records",
        sa.Column("udi", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(length=1), nullable=False),
        sa.Column("air_temperature", sa.Float(), nullable=False),
        sa.Column("process_temperature", sa.Float(), nullable=False),
        sa.Column("rotational_speed", sa.Integer(), nullable=False),
        sa.Column("torque", sa.Float(), nullable=False),
        sa.Column("tool_wear", sa.Integer(), nullable=False),
        sa.Column("machine_failure", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("twf", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("hdf", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("pwf", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("osf", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("rnf", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint("type IN ('L', 'M', 'H')", name="ck_machine_records_type"),
        sa.CheckConstraint("rotational_speed >= 0", name="ck_machine_records_speed_nonnegative"),
        sa.CheckConstraint("torque >= 0", name="ck_machine_records_torque_nonnegative"),
        sa.CheckConstraint("tool_wear >= 0", name="ck_machine_records_tool_wear_nonnegative"),
        sa.PrimaryKeyConstraint("udi", name="pk_machine_records"),
    )


def downgrade() -> None:
    op.drop_table("machine_records")
