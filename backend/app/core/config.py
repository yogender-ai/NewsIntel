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
    newsintel_categories: str = Field(default="tech,education,entertainment,politics", alias="NEWSINTEL_CATEGORIES")
    newsintel_articles_per_category: int = Field(default=5, alias="NEWSINTEL_ARTICLES_PER_CATEGORY")
    newsintel_ingest_interval_minutes: int = Field(default=10, alias="NEWSINTEL_INGEST_INTERVAL_MINUTES")
    newsintel_rank_top_n: int = Field(default=15, alias="NEWSINTEL_RANK_TOP_N")
    newsintel_enrich_batch_size: int = Field(default=3, alias="NEWSINTEL_ENRICH_BATCH_SIZE")
    newsintel_retention_days: int = Field(default=7, alias="NEWSINTEL_RETENTION_DAYS")
    newsintel_ai_rank_max_tokens: int = Field(default=520, alias="NEWSINTEL_AI_RANK_MAX_TOKENS")
    newsintel_ai_enrich_max_tokens: int = Field(default=500, alias="NEWSINTEL_AI_ENRICH_MAX_TOKENS")
    newsintel_openrouter_model: str = Field(default="openrouter/free", alias="NEWSINTEL_OPENROUTER_MODEL")
    newsintel_openrouter_models: str = Field(
        default=(
            "openrouter/free,"
            "inclusionai/ling-2.6-1t:free,"
            "meta-llama/llama-3.3-70b-instruct:free,"
            "nvidia/nemotron-3-super-120b-a12b:free,"
            "google/gemma-4-31b-it:free,"
            "minimax/minimax-m2.5:free"
        ),
        alias="NEWSINTEL_OPENROUTER_MODELS",
    )
    ai_circuit_breaker_cooldown_minutes: int = Field(default=360, alias="AI_CIRCUIT_BREAKER_COOLDOWN_MINUTES")
    enable_heavy_ingestion: bool = Field(default=False, alias="ENABLE_HEAVY_INGESTION")
    enable_personalization: bool = Field(default=False, alias="ENABLE_PERSONALIZATION")
    enable_watchlist: bool = Field(default=False, alias="ENABLE_WATCHLIST")
    enable_alerts: bool = Field(default=False, alias="ENABLE_ALERTS")
    enable_digests: bool = Field(default=False, alias="ENABLE_DIGESTS")
    enable_country_filters: bool = Field(default=False, alias="ENABLE_COUNTRY_FILTERS")

    @property
    def mvp_categories(self) -> list[str]:
        allowed = {"tech", "education", "entertainment", "politics"}
        categories = [
            item.strip().lower()
            for item in self.newsintel_categories.split(",")
            if item.strip()
        ]
        filtered = [item for item in categories if item in allowed]
        return filtered or ["tech", "education", "entertainment", "politics"]

    @property
    def openrouter_model_chain(self) -> list[str]:
        models = [
            item.strip()
            for item in self.newsintel_openrouter_models.split(",")
            if item.strip()
        ]
        if self.newsintel_openrouter_model and self.newsintel_openrouter_model not in models:
            models.insert(0, self.newsintel_openrouter_model)
        return models or ["openrouter/free"]

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
