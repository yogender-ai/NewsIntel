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
    env: str = Field(default="dev", alias="ENV")
    newsintel_require_redis_auth: bool = Field(default=False, alias="NEWSINTEL_REQUIRE_REDIS_AUTH")
    gateway_secret: str = Field(default="", alias="GATEWAY_SECRET")
    gateway_base_url: str = Field(
        default="https://cloud-command.onrender.com/api/gateway",
        alias="GATEWAY_BASE_URL",
    )
    ingest_secret: str = Field(default="", alias="INGEST_SECRET")
    admin_secret: str = Field(default="", alias="ADMIN_SECRET")
    hf_space_id: str = Field(default="YAsh213kadian/News-Intel", alias="HF_SPACE_URL")
    ingestion_batch_size: int = Field(default=80, alias="INGESTION_BATCH_SIZE")
    dashboard_cache_ttl_seconds: int = Field(default=5400, alias="DASHBOARD_CACHE_TTL_SECONDS")
    article_duplicate_window_hours: int = Field(default=36, alias="ARTICLE_DUPLICATE_WINDOW_HOURS")
    title_similarity_threshold: float = Field(default=0.86, alias="TITLE_SIMILARITY_THRESHOLD")
    ai_enrichment_max_events_per_run: int = Field(default=10, alias="AI_ENRICHMENT_MAX_EVENTS_PER_RUN")
    ai_enrichment_stale_hours: int = Field(default=6, alias="AI_ENRICHMENT_STALE_HOURS")
    # Empty means "every category that has a feed" — see Settings.mvp_categories.
    newsintel_categories: str = Field(default="", alias="NEWSINTEL_CATEGORIES")
    newsintel_articles_per_category: int = Field(default=8, alias="NEWSINTEL_ARTICLES_PER_CATEGORY")
    newsintel_ingest_interval_minutes: int = Field(default=60, alias="NEWSINTEL_INGEST_INTERVAL_MINUTES")
    newsintel_rank_top_n: int = Field(default=15, alias="NEWSINTEL_RANK_TOP_N")
    newsintel_enrich_batch_size: int = Field(default=3, alias="NEWSINTEL_ENRICH_BATCH_SIZE")
    newsintel_items_per_feed: int = Field(default=12, alias="NEWSINTEL_ITEMS_PER_FEED")
    newsintel_og_image_cap: int = Field(default=20, alias="NEWSINTEL_OG_IMAGE_CAP")
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
    ai_circuit_breaker_cooldown_minutes: int = Field(default=10, alias="AI_CIRCUIT_BREAKER_COOLDOWN_MINUTES")

    # ── Cloudflare Workers AI ──
    # Primary inference provider: chat (gpt-oss-120b), embeddings (bge-m3),
    # and cross-encoder reranking (bge-reranker-base).
    cloudflare_account_id: str = Field(default="", alias="CLOUDFLARE_ACCOUNT_ID")
    cloudflare_api_token: str = Field(default="", alias="CLOUDFLARE_API_TOKEN")
    cloudflare_api_base: str = Field(default="https://api.cloudflare.com/client/v4", alias="CLOUDFLARE_API_BASE")
    cloudflare_chat_model: str = Field(default="@cf/openai/gpt-oss-120b", alias="CLOUDFLARE_CHAT_MODEL")
    cloudflare_fast_chat_model: str = Field(default="@cf/openai/gpt-oss-20b", alias="CLOUDFLARE_FAST_CHAT_MODEL")
    cloudflare_embed_model: str = Field(default="@cf/baai/bge-m3", alias="CLOUDFLARE_EMBED_MODEL")
    cloudflare_embed_dimensions: int = Field(default=1024, alias="CLOUDFLARE_EMBED_DIMENSIONS")
    cloudflare_rerank_model: str = Field(default="@cf/baai/bge-reranker-base", alias="CLOUDFLARE_RERANK_MODEL")
    cloudflare_chat_timeout_seconds: float = Field(default=90.0, alias="CLOUDFLARE_CHAT_TIMEOUT_SECONDS")
    cloudflare_embed_timeout_seconds: float = Field(default=45.0, alias="CLOUDFLARE_EMBED_TIMEOUT_SECONDS")
    cloudflare_rerank_timeout_seconds: float = Field(default=30.0, alias="CLOUDFLARE_RERANK_TIMEOUT_SECONDS")
    cloudflare_embed_char_limit: int = Field(default=4000, alias="CLOUDFLARE_EMBED_CHAR_LIMIT")
    cloudflare_rerank_char_limit: int = Field(default=1800, alias="CLOUDFLARE_RERANK_CHAR_LIMIT")
    ai_provider: str = Field(default="cloudflare", alias="AI_PROVIDER")

    # ── Auth (own JWT, replaces Firebase) ──
    jwt_secret: str = Field(default="", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_ttl_minutes: int = Field(default=30, alias="ACCESS_TOKEN_TTL_MINUTES")
    refresh_token_ttl_days: int = Field(default=30, alias="REFRESH_TOKEN_TTL_DAYS")
    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")

    # ── RAG ──
    rag_chunk_chars: int = Field(default=900, alias="RAG_CHUNK_CHARS")
    rag_chunk_overlap: int = Field(default=150, alias="RAG_CHUNK_OVERLAP")
    rag_vector_candidates: int = Field(default=40, alias="RAG_VECTOR_CANDIDATES")
    rag_keyword_candidates: int = Field(default=20, alias="RAG_KEYWORD_CANDIDATES")
    rag_rerank_keep: int = Field(default=8, alias="RAG_RERANK_KEEP")
    rag_min_rerank_score: float = Field(default=0.001, alias="RAG_MIN_RERANK_SCORE")
    # Keep passages scoring within this fraction of the best hit.
    rag_relative_cutoff: float = Field(default=0.15, alias="RAG_RELATIVE_CUTOFF")
    rag_min_sources: int = Field(default=3, alias="RAG_MIN_SOURCES")
    enable_heavy_ingestion: bool = Field(default=False, alias="ENABLE_HEAVY_INGESTION")
    enable_personalization: bool = Field(default=False, alias="ENABLE_PERSONALIZATION")
    enable_watchlist: bool = Field(default=False, alias="ENABLE_WATCHLIST")
    enable_alerts: bool = Field(default=False, alias="ENABLE_ALERTS")
    enable_digests: bool = Field(default=False, alias="ENABLE_DIGESTS")
    enable_country_filters: bool = Field(default=False, alias="ENABLE_COUNTRY_FILTERS")

    @property
    def mvp_categories(self) -> list[str]:
        """Categories the pipeline ingests.

        Previously this hard-filtered to four categories, so twelve of the sixteen
        topics onboarding offers were silently discarded. Now any category backed by
        a real feed is accepted, and an unset/empty config means "ingest everything".
        """
        from app.pipeline.fetch.sources import ALL_CATEGORIES

        allowed = set(ALL_CATEGORIES)
        categories = [
            item.strip().lower()
            for item in self.newsintel_categories.split(",")
            if item.strip()
        ]
        filtered = [item for item in categories if item in allowed]
        return filtered or list(ALL_CATEGORIES)

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
    def gateway_root(self) -> str:
        base = (self.gateway_base_url or "").rstrip("/")
        if "/api/gateway" in base:
            return f"{base.split('/api/gateway')[0].rstrip('/')}/api/gateway"
        return base or "https://cloud-command.onrender.com/api/gateway"

    @property
    def effective_ingest_secret(self) -> str:
        return (self.ingest_secret or self.gateway_secret or self.admin_secret or "").strip()

    @property
    def redis_required_auth(self) -> bool:
        return self.env.strip().lower() in {"prod", "production"} or self.newsintel_require_redis_auth

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
