"""Add scenario simulator runs.

Revision ID: 20260426_0004
Revises: 20260426_0003
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260426_0004"
down_revision = "20260426_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("scenario_runs"):
        op.create_table(
            "scenario_runs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(length=160), nullable=False),
            sa.Column("input_text", sa.Text(), nullable=False),
            sa.Column("base_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id"), nullable=True),
            sa.Column("assumptions_json", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("result_json", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("provider_used", sa.String(length=120), nullable=False),
            sa.Column("scenario_hash", sa.String(length=80), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_scenario_runs_user_id ON scenario_runs (user_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_scenario_runs_scenario_hash ON scenario_runs (scenario_hash)")


def downgrade() -> None:
    op.drop_index("ix_scenario_runs_scenario_hash", table_name="scenario_runs")
    op.drop_index("ix_scenario_runs_user_id", table_name="scenario_runs")
    op.drop_table("scenario_runs")
