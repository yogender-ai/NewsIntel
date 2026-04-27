"""Add controlled MVP pipeline tables.

Revision ID: 20260427_0010
Revises: 20260427_0009
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260427_0010"
down_revision = "20260427_0009"
branch_labels = None
depends_on = None


def _tables():
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table_name: str):
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_article_columns() -> None:
    columns = _columns("articles")
    if "url" not in columns:
        op.add_column("articles", sa.Column("url", sa.Text(), nullable=True))
    if "description" not in columns:
        op.add_column("articles", sa.Column("description", sa.Text(), nullable=True))
    if "category" not in columns:
        op.add_column("articles", sa.Column("category", sa.String(length=80), nullable=True))
        op.create_index("ix_articles_category", "articles", ["category"])
    if "rss_query" not in columns:
        op.add_column("articles", sa.Column("rss_query", sa.Text(), nullable=True))


def upgrade() -> None:
    _add_article_columns()
    tables = _tables()

    if "news_cycles" not in tables:
        op.create_table(
            "news_cycles",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=40), nullable=False),
            sa.Column("fetched_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("deduped_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("ranked_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("enriched_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_news_cycles_status", "news_cycles", ["status"])

    if "ranked_stories" not in tables:
        op.create_table(
            "ranked_stories",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("article_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("rank_position", sa.Integer(), nullable=False),
            sa.Column("ai_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("ai_reason", sa.Text(), nullable=True),
            sa.Column("importance_level", sa.String(length=20), nullable=True),
            sa.Column("selected_for_enrichment", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["article_id"], ["articles.id"]),
            sa.ForeignKeyConstraint(["cycle_id"], ["news_cycles.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("cycle_id", "article_id", name="uq_ranked_stories_cycle_article"),
        )
        op.create_index("ix_ranked_stories_article_id", "ranked_stories", ["article_id"])
        op.create_index("ix_ranked_stories_cycle_id", "ranked_stories", ["cycle_id"])
        op.create_index("ix_ranked_stories_cycle_rank", "ranked_stories", ["cycle_id", "rank_position"])

    if "enrichment_queue" not in tables:
        op.create_table(
            "enrichment_queue",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("article_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["article_id"], ["articles.id"]),
            sa.ForeignKeyConstraint(["cycle_id"], ["news_cycles.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("article_id", "cycle_id", name="uq_enrichment_queue_article_cycle"),
        )
        op.create_index("ix_enrichment_queue_article_id", "enrichment_queue", ["article_id"])
        op.create_index("ix_enrichment_queue_cycle_id", "enrichment_queue", ["cycle_id"])
        op.create_index("ix_enrichment_queue_status", "enrichment_queue", ["status"])
        op.create_index("ix_enrichment_queue_next_attempt_at", "enrichment_queue", ["next_attempt_at"])
        op.create_index("ix_enrichment_queue_status_next", "enrichment_queue", ["status", "next_attempt_at"])

    if "stories" not in tables:
        op.create_table(
            "stories",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("article_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("category", sa.String(length=80), nullable=False),
            sa.Column("display_title", sa.Text(), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("why_it_matters", sa.Text(), nullable=False),
            sa.Column("entities_json", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("sentiment", sa.String(length=20), nullable=False, server_default="neutral"),
            sa.Column("pulse_score", sa.Float(), nullable=False, server_default="50"),
            sa.Column("exposure_score", sa.Float(), nullable=False, server_default="50"),
            sa.Column("importance_level", sa.String(length=20), nullable=False, server_default="MEDIUM"),
            sa.Column("risk_level", sa.String(length=20), nullable=False, server_default="LOW"),
            sa.Column("source_url", sa.Text(), nullable=False),
            sa.Column("source_name", sa.String(length=160), nullable=False),
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("enriched_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["article_id"], ["articles.id"]),
            sa.ForeignKeyConstraint(["cycle_id"], ["news_cycles.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("article_id"),
        )
        op.create_index("ix_stories_article_id", "stories", ["article_id"])
        op.create_index("ix_stories_cycle_id", "stories", ["cycle_id"])
        op.create_index("ix_stories_category", "stories", ["category"])
        op.create_index("ix_stories_published_at", "stories", ["published_at"])
        op.create_index("ix_stories_created_category", "stories", ["created_at", "category"])
        op.create_index("ix_stories_pulse_created", "stories", ["pulse_score", "created_at"])

    if "event_metrics" not in tables:
        op.create_table(
            "event_metrics",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("story_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("pulse_score", sa.Float(), nullable=False, server_default="50"),
            sa.Column("exposure_score", sa.Float(), nullable=False, server_default="50"),
            sa.Column("category", sa.String(length=80), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["cycle_id"], ["news_cycles.id"]),
            sa.ForeignKeyConstraint(["story_id"], ["stories.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_event_metrics_story_id", "event_metrics", ["story_id"])
        op.create_index("ix_event_metrics_cycle_id", "event_metrics", ["cycle_id"])
        op.create_index("ix_event_metrics_category", "event_metrics", ["category"])
        op.create_index("ix_event_metrics_category_created", "event_metrics", ["category", "created_at"])

    if "home_snapshots" not in tables:
        op.create_table(
            "home_snapshots",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("payload_json", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["cycle_id"], ["news_cycles.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_home_snapshots_cycle_id", "home_snapshots", ["cycle_id"])
        op.create_index("ix_home_snapshots_active", "home_snapshots", ["active"])
        op.create_index("ix_home_snapshots_expires_at", "home_snapshots", ["expires_at"])

    if "ingestion_locks" not in tables:
        op.create_table(
            "ingestion_locks",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("lock_name", sa.String(length=80), nullable=False),
            sa.Column("locked_until", sa.DateTime(timezone=True), nullable=False),
            sa.Column("locked_by", sa.String(length=160), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("lock_name"),
        )
        op.create_index("ix_ingestion_locks_lock_name", "ingestion_locks", ["lock_name"])


def downgrade() -> None:
    for table in [
        "ingestion_locks",
        "home_snapshots",
        "event_metrics",
        "stories",
        "enrichment_queue",
        "ranked_stories",
        "news_cycles",
    ]:
        if table in _tables():
            op.drop_table(table)
