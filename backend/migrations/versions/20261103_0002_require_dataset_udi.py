"""Require dataset-provided UDI values."""

from alembic import op

revision = "20261103_0002"
down_revision = "20261103_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE machine_records ALTER COLUMN udi DROP DEFAULT")
    op.execute("DROP SEQUENCE IF EXISTS machine_records_udi_seq")


def downgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS machine_records_udi_seq")
    op.execute(
        "ALTER TABLE machine_records ALTER COLUMN udi "
        "SET DEFAULT nextval('machine_records_udi_seq'::regclass)"
    )
