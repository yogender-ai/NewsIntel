"""Add Phase 6 intelligence metadata columns.

Revision ID: 20260426_0005
Revises: 20260426_0004
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260426_0005"
down_revision = "20260426_0004"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    article_columns = _columns("articles")
    if "embedding_json" not in article_columns:
        op.add_column("articles", sa.Column("embedding_json", postgresql.JSONB(), nullable=False, server_default="[]"))
    if "embedding_model" not in article_columns:
        op.add_column("articles", sa.Column("embedding_model", sa.String(length=80), nullable=True))
    if "embedding_text_hash" not in article_columns:
        op.add_column("articles", sa.Column("embedding_text_hash", sa.String(length=64), nullable=True))
    op.execute("CREATE INDEX IF NOT EXISTS ix_articles_embedding_text_hash ON articles (embedding_text_hash)")


def downgrade() -> None:
    op.drop_index("ix_articles_embedding_text_hash", table_name="articles")
    article_columns = _columns("articles")
    if "embedding_text_hash" in article_columns:
        op.drop_column("articles", "embedding_text_hash")
    if "embedding_model" in article_columns:
        op.drop_column("articles", "embedding_model")
    if "embedding_json" in article_columns:
        op.drop_column("articles", "embedding_json")
