"""Add cross-event relationship memory.

Revision ID: 20260426_0003
Revises: 20260426_0002
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260426_0003"
down_revision = "20260426_0002"
branch_labels = None
depends_on = None


RELATIONSHIP_TYPES = (
    "causes",
    "correlates",
    "amplifies",
    "reduces",
    "threatens",
    "benefits",
    "follows_up",
    "same_theme",
)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table("event_relationships"):
        op.create_table(
            "event_relationships",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("source_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id"), nullable=False),
            sa.Column("target_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id"), nullable=False),
            sa.Column("relationship_type", sa.String(length=40), nullable=False),
            sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
            sa.Column("evidence", sa.Text(), nullable=False),
            sa.Column("pair_hash", sa.String(length=80), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint(f"relationship_type IN {RELATIONSHIP_TYPES}", name="ck_event_relationships_type"),
            sa.CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_event_relationships_confidence"),
            sa.CheckConstraint("source_event_id <> target_event_id", name="ck_event_relationships_distinct_events"),
        )
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_event_relationships_pair_hash ON event_relationships (pair_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_event_relationships_source ON event_relationships (source_event_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_event_relationships_target ON event_relationships (target_event_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_event_relationships_type_confidence "
        "ON event_relationships (relationship_type, confidence)"
    )

    if not inspector.has_table("event_relationship_checks"):
        op.create_table(
            "event_relationship_checks",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("pair_hash", sa.String(length=80), nullable=False),
            sa.Column("source_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id"), nullable=False),
            sa.Column("target_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id"), nullable=False),
            sa.Column("candidate_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="checked"),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("source_event_id <> target_event_id", name="ck_event_relationship_checks_distinct_events"),
        )
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_event_relationship_checks_pair_hash ON event_relationship_checks (pair_hash)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_event_relationship_checks_source_target "
        "ON event_relationship_checks (source_event_id, target_event_id)"
    )


def downgrade() -> None:
    op.drop_index("ix_event_relationship_checks_source_target", table_name="event_relationship_checks")
    op.drop_index("ix_event_relationship_checks_pair_hash", table_name="event_relationship_checks")
    op.drop_table("event_relationship_checks")
    op.drop_index("ix_event_relationships_type_confidence", table_name="event_relationships")
    op.drop_index("ix_event_relationships_target", table_name="event_relationships")
    op.drop_index("ix_event_relationships_source", table_name="event_relationships")
    op.drop_index("ix_event_relationships_pair_hash", table_name="event_relationships")
    op.drop_table("event_relationships")
