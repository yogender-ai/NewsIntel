from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(
        default="postgresql+asyncpg://newsintel:newsintel@localhost:5432/newsintel",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="", alias="REDIS_URL")
    ingestion_batch_size: int = Field(default=80, alias="INGESTION_BATCH_SIZE")
    dashboard_cache_ttl_seconds: int = Field(default=300, alias="DASHBOARD_CACHE_TTL_SECONDS")
    article_duplicate_window_hours: int = Field(default=36, alias="ARTICLE_DUPLICATE_WINDOW_HOURS")
    title_similarity_threshold: float = Field(default=0.86, alias="TITLE_SIMILARITY_THRESHOLD")
    ai_enrichment_max_events_per_run: int = Field(default=10, alias="AI_ENRICHMENT_MAX_EVENTS_PER_RUN")
    ai_enrichment_stale_hours: int = Field(default=6, alias="AI_ENRICHMENT_STALE_HOURS")

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)

        # Strip ALL SSL-related query params — asyncpg does NOT support them
        # in the DSN. SSL is configured via connect_args={'ssl': 'require'}
        # in the engine factory (app/core/database.py, alembic/env.py).
        parts = urlsplit(url)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query.pop("sslmode", None)
        query.pop("ssl", None)
        query.pop("channel_binding", None)

        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


@lru_cache
def get_settings() -> Settings:
    return Settings()
