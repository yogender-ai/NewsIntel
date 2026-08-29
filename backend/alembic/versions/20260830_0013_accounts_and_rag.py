"""JWT accounts, reader profiles, and the pgvector RAG corpus.

Adds:
  * pgvector extension
  * accounts / account_profiles / refresh_sessions  (replaces Firebase identity)
  * signal_feedback                                  (ranking feedback loop)
  * signal_chunks                                    (hybrid RAG corpus)

Revision ID: 20260830_0013
Revises: 20260815_0012
Create Date: 2026-08-30
"""

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR, UUID

revision = "20260830_0013"
down_revision = "20260815_0012"
branch_labels = None
depends_on = None

EMBED_DIMS = 1024  # @cf/baai/bge-m3


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("display_name", sa.String(160)),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("auth_provider", sa.String(30), nullable=False, server_default="password"),
        sa.Column("google_sub", sa.String(64), unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_accounts_email", "accounts", ["email"])
    op.create_index("ix_accounts_google_sub", "accounts", ["google_sub"])

    op.create_table(
        "account_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("topics", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("regions", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("keywords", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("muted_keywords", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("occupation", sa.String(120)),
        sa.Column("role_title", sa.String(160)),
        sa.Column("industry", sa.String(120)),
        sa.Column("seniority", sa.String(60)),
        sa.Column("employer", sa.String(160)),
        sa.Column("country", sa.String(80)),
        sa.Column("city", sa.String(120)),
        sa.Column("self_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("goals", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("profile_embedding", Vector(EMBED_DIMS)),
        sa.Column("profile_embedding_hash", sa.String(64)),
        sa.Column("profile_embedded_at", sa.DateTime(timezone=True)),
        sa.Column("digest_frequency", sa.String(20), nullable=False, server_default="daily"),
        sa.Column("reading_level", sa.String(20), nullable=False, server_default="balanced"),
        sa.Column("onboarded", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("onboarding_step", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("extra", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "refresh_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("user_agent", sa.String(300)),
        sa.Column("ip_address", sa.String(60)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_refresh_sessions_account_id", "refresh_sessions", ["account_id"])
    op.create_index("ix_refresh_sessions_token_hash", "refresh_sessions", ["token_hash"])
    op.create_index("ix_refresh_sessions_account_active", "refresh_sessions", ["account_id", "revoked_at"])

    op.create_table(
        "signal_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "signal_id",
            UUID(as_uuid=True),
            sa.ForeignKey("signals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("dwell_seconds", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_signal_feedback_account_id", "signal_feedback", ["account_id"])
    op.create_index("ix_signal_feedback_signal_id", "signal_feedback", ["signal_id"])
    op.create_index("ix_signal_feedback_account_action", "signal_feedback", ["account_id", "action"])

    op.create_table(
        "signal_chunks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "signal_id",
            UUID(as_uuid=True),
            sa.ForeignKey("signals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("article_id", UUID(as_uuid=True), sa.ForeignKey("articles.id", ondelete="CASCADE")),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(30), nullable=False, server_default="body"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_estimate", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("embedding", Vector(EMBED_DIMS)),
        sa.Column("embedding_model", sa.String(80)),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("category", sa.String(80)),
        sa.Column("source_name", sa.String(160)),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "search_vector",
            TSVECTOR(),
            sa.Computed("to_tsvector('english', content)", persisted=True),
        ),
        sa.UniqueConstraint("signal_id", "chunk_index", name="uq_signal_chunk_index"),
    )
    op.create_index("ix_signal_chunks_signal_id", "signal_chunks", ["signal_id"])
    op.create_index("ix_signal_chunks_article_id", "signal_chunks", ["article_id"])
    op.create_index("ix_signal_chunks_content_hash", "signal_chunks", ["content_hash"])
    op.create_index("ix_signal_chunks_category", "signal_chunks", ["category"])
    op.create_index("ix_signal_chunks_published", "signal_chunks", ["published_at"])
    op.create_index("ix_signal_chunks_search", "signal_chunks", ["search_vector"], postgresql_using="gin")
    # HNSW beats IVFFlat here: no training step, and it stays accurate as the corpus
    # grows without needing a rebuild when row count changes by orders of magnitude.
    op.execute(
        "CREATE INDEX ix_signal_chunks_embedding_hnsw ON signal_chunks "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.drop_table("signal_chunks")
    op.drop_table("signal_feedback")
    op.drop_table("refresh_sessions")
    op.drop_table("account_profiles")
    op.drop_table("accounts")
