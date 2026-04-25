from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from sqlalchemy.ext.asyncio import AsyncSession

import news_fetcher
from app.repositories.ingestion import IncomingArticle, IngestionRepository, IngestionResult
from app.services.redirect_resolver import RedirectResolver


def parse_rss_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


class IngestionPipeline:
    """Fetch external articles, persist raw snapshots, dedupe, and cluster."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = IngestionRepository(session)
        self.redirects = RedirectResolver()

    async def ingest_topics(
        self,
        topics: list[str],
        regions: list[str] | None = None,
        max_articles: int = 40,
    ) -> list[IngestionResult]:
        fetched = await news_fetcher.fetch_news(
            topics=topics,
            regions=regions or [],
            max_articles=max_articles,
        )
        results: list[IngestionResult] = []
        for item in fetched:
            source_url = item.get("url", "")
            canonical_url = await self.redirects.resolve(source_url) if source_url else ""
            incoming = IncomingArticle(
                source=item.get("source") or "Unknown",
                source_url=canonical_url or source_url,
                requested_url=source_url,
                title=item.get("title") or "",
                summary=item.get("text") or "",
                text=item.get("text") or "",
                published_at=parse_rss_datetime(item.get("published")),
                raw_payload=item,
                category=(topics or [None])[0],
                region=(regions or [None])[0],
            )
            if not incoming.title or not incoming.source_url:
                continue
            results.append(await self.repository.ingest(incoming))

        await self.session.commit()
        return results

