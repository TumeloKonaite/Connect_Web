"""Remove the legacy machine-record reference from observations."""

from alembic import op

revision = "20261106_0007"
down_revision = "20261106_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_observation_source_udi", table_name="observations")
    with op.batch_alter_table("observations") as batch_op:
        batch_op.drop_constraint("uq_observation_source", type_="unique")
        batch_op.drop_column("source_udi")


def downgrade() -> None:
    raise RuntimeError("The removed legacy source reference cannot be restored")
