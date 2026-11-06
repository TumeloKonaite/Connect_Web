"""Remove observations imported from the inaccurate legacy CSV schedule."""

from alembic import op

revision = "20261106_0006"
down_revision = "20261106_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM observations WHERE source_udi IS NOT NULL")


def downgrade() -> None:
    # Removed observations cannot be reconstructed from the remaining database.
    pass
