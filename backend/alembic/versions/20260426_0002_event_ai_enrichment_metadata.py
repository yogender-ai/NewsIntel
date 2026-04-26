"""Add event AI enrichment metadata indexes.

Revision ID: 20260426_0002
Revises: 20260425_0001
Create Date: 2026-04-26
"""

from alembic import op


revision = "20260426_0002"
down_revision = "20260425_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # AI enrichment is stored in events.metadata_json["ai"] to avoid a risky
    # production table rewrite while keeping the event row as source of truth.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_events_ai_status "
        "ON events ((metadata_json->'ai'->>'status'))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_events_ai_evidence_hash "
        "ON events ((metadata_json->'ai'->>'evidence_hash'))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_events_ai_evidence_hash")
    op.execute("DROP INDEX IF EXISTS ix_events_ai_status")
