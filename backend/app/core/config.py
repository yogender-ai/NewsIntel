from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(
        default="postgresql+asyncpg://newsintel:newsintel@localhost:5432/newsintel",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    ingestion_batch_size: int = Field(default=80, alias="INGESTION_BATCH_SIZE")
    dashboard_cache_ttl_seconds: int = Field(default=300, alias="DASHBOARD_CACHE_TTL_SECONDS")
    article_duplicate_window_hours: int = Field(default=36, alias="ARTICLE_DUPLICATE_WINDOW_HOURS")
    title_similarity_threshold: float = Field(default=0.86, alias="TITLE_SIMILARITY_THRESHOLD")

    @property
    def async_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
