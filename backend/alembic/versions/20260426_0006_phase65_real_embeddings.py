"""Add first-class event embeddings and embedding timestamps.

Revision ID: 20260426_0006
Revises: 20260426_0005
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260426_0006"
down_revision = "20260426_0005"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    article_columns = _columns("articles")
    if "embedding_created_at" not in article_columns:
        op.add_column("articles", sa.Column("embedding_created_at", sa.DateTime(timezone=True), nullable=True))

    event_columns = _columns("events")
    if "embedding_json" not in event_columns:
        op.add_column("events", sa.Column("embedding_json", postgresql.JSONB(), nullable=False, server_default="[]"))
    if "embedding_model" not in event_columns:
        op.add_column("events", sa.Column("embedding_model", sa.String(length=80), nullable=True))
    if "embedding_text_hash" not in event_columns:
        op.add_column("events", sa.Column("embedding_text_hash", sa.String(length=64), nullable=True))
    if "embedding_created_at" not in event_columns:
        op.add_column("events", sa.Column("embedding_created_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("CREATE INDEX IF NOT EXISTS ix_events_embedding_text_hash ON events (embedding_text_hash)")


def downgrade() -> None:
    op.drop_index("ix_events_embedding_text_hash", table_name="events")
    event_columns = _columns("events")
    if "embedding_created_at" in event_columns:
        op.drop_column("events", "embedding_created_at")
    if "embedding_text_hash" in event_columns:
        op.drop_column("events", "embedding_text_hash")
    if "embedding_model" in event_columns:
        op.drop_column("events", "embedding_model")
    if "embedding_json" in event_columns:
        op.drop_column("events", "embedding_json")

    article_columns = _columns("articles")
    if "embedding_created_at" in article_columns:
        op.drop_column("articles", "embedding_created_at")
