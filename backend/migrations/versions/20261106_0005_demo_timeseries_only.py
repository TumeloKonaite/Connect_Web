"""Make time-series observations independent of machine record storage."""

from alembic import op

revision = "20261106_0005"
down_revision = "20261105_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("observations") as batch_op:
        batch_op.drop_constraint("observations_source_udi_fkey", type_="foreignkey")
    op.drop_table("machine_records")


def downgrade() -> None:
    raise RuntimeError("This migration removes source row data and cannot be reversed")
