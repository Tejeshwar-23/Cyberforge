"""add connector run events

Revision ID: f17c9d4a6b82
Revises: ca91607988be
"""

from alembic import op
import sqlalchemy as sa


revision = "f17c9d4a6b82"
down_revision = "ca91607988be"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "connector_run_events",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column(
            "run_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "connector_name",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "stage",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "message",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "details_json",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text(
                "CURRENT_TIMESTAMP"
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["connector_runs.id"],
            ondelete="CASCADE",
        ),
    )

    op.create_index(
        "ix_connector_run_events_run_id",
        "connector_run_events",
        ["run_id"],
    )

    op.create_index(
        "ix_connector_run_events_connector_name",
        "connector_run_events",
        ["connector_name"],
    )

    op.create_index(
        "ix_connector_run_events_stage",
        "connector_run_events",
        ["stage"],
    )

    op.create_index(
        "ix_connector_run_events_status",
        "connector_run_events",
        ["status"],
    )

    op.create_index(
        "ix_connector_run_events_occurred_at",
        "connector_run_events",
        ["occurred_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_connector_run_events_occurred_at",
        table_name="connector_run_events",
    )

    op.drop_index(
        "ix_connector_run_events_status",
        table_name="connector_run_events",
    )

    op.drop_index(
        "ix_connector_run_events_stage",
        table_name="connector_run_events",
    )

    op.drop_index(
        "ix_connector_run_events_connector_name",
        table_name="connector_run_events",
    )

    op.drop_index(
        "ix_connector_run_events_run_id",
        table_name="connector_run_events",
    )

    op.drop_table(
        "connector_run_events"
    )
