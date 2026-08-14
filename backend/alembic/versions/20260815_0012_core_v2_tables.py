"""Core v2 tables and article intelligence columns.

Revision ID: 20260815_0012
Revises: 20260428_0011
Create Date: 2026-08-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "20260815_0012"
down_revision = "20260428_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "articles" in tables:
        op.execute("ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url TEXT")
        op.execute("ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_id VARCHAR(80)")
        op.execute("ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_name VARCHAR(160)")
        op.execute("ALTER TABLE articles ADD COLUMN IF NOT EXISTS hf_json JSONB DEFAULT '{}'::jsonb")
        op.execute("ALTER TABLE articles ADD COLUMN IF NOT EXISTS llm_json JSONB")
        op.execute("ALTER TABLE articles ADD COLUMN IF NOT EXISTS llm_status VARCHAR(32)")
    if "pipeline_runs" not in tables:
        op.create_table(
            "pipeline_runs",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True)),
            sa.Column("status", sa.String(40), nullable=False),
            sa.Column("trigger", sa.String(40), nullable=False),
            sa.Column("stats", JSONB, nullable=False, server_default="{}"),
            sa.Column("stages", JSONB, nullable=False, server_default="[]"),
            sa.Column("error", sa.Text()),
        )
    if "signals" not in tables:
        op.create_table(
            "signals",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("article_id", UUID(as_uuid=True), sa.ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("category", sa.String(80), nullable=False),
            sa.Column("title", sa.Text(), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("why_it_matters", sa.Text(), nullable=False, server_default=""),
            sa.Column("image_url", sa.Text(), nullable=False),
            sa.Column("source_name", sa.String(160), nullable=False),
            sa.Column("source_url", sa.Text(), nullable=False),
            sa.Column("entities", JSONB, nullable=False, server_default="[]"),
            sa.Column("sentiment", sa.String(20), nullable=False, server_default="neutral"),
            sa.Column("sentiment_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("pulse", sa.Float(), nullable=False, server_default="50"),
            sa.Column("exposure", sa.Float(), nullable=False, server_default="50"),
            sa.Column("importance", sa.String(20), nullable=False, server_default="WATCH"),
            sa.Column("pulse_breakdown", JSONB, nullable=False, server_default="{}"),
            sa.Column("published_at", sa.DateTime(timezone=True)),
            sa.Column("enriched_at", sa.DateTime(timezone=True), nullable=False),
        )
    if "signal_relationships" not in tables:
        op.create_table(
            "signal_relationships",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("source_id", UUID(as_uuid=True), sa.ForeignKey("signals.id", ondelete="CASCADE"), nullable=False),
            sa.Column("target_id", UUID(as_uuid=True), sa.ForeignKey("signals.id", ondelete="CASCADE"), nullable=False),
            sa.Column("rel_type", sa.String(40), nullable=False),
            sa.Column("confidence", sa.Float(), nullable=False, server_default="0.5"),
            sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        )
    if "snapshots" not in tables:
        op.create_table(
            "snapshots",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_runs.id", ondelete="SET NULL")),
            sa.Column("payload_json", JSONB, nullable=False, server_default="{}"),
            sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True)),
        )
    if "pulse_samples" not in tables:
        op.create_table(
            "pulse_samples",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("category", sa.String(80), nullable=False),
            sa.Column("pulse", sa.Float(), nullable=False, server_default="50"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("pulse_samples")
    op.drop_table("snapshots")
    op.drop_table("signal_relationships")
    op.drop_table("signals")
    op.drop_table("pipeline_runs")
