import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.news import Article, Event, EventArticle, RawArticle
from app.services.event_clustering import should_cluster_titles
from app.services.text_fingerprint import content_hash, normalize_title, title_hash, title_similarity
from app.services.url_normalizer import normalize_url, sha256_text


def db_utcnow() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def db_datetime(value: datetime | None) -> datetime | None:
    """Normalize a datetime to UTC (timezone-aware).

    asyncpg requires timezone-aware values for ``TIMESTAMP WITH TIME ZONE``.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@dataclass(slots=True)
class IncomingArticle:
    source: str
    source_url: str
    title: str
    summary: str = ""
    published_at: datetime | None = None
    requested_url: str | None = None
    raw_payload: dict | None = None
    raw_html: str | None = None
    author: str | None = None
    text: str = ""
    category: str | None = None
    region: str | None = None


@dataclass(slots=True)
class IngestionResult:
    article: Article
    raw_article: RawArticle
    event: Event
    duplicate_reason: str
    created_article: bool
    created_event: bool


class IngestionRepository:
    """Transactional ingestion repository for raw snapshots, articles, and events."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()

    async def ingest(self, incoming: IncomingArticle) -> IngestionResult:
        canonical_url = normalize_url(incoming.source_url)
        normalized_title = normalize_title(incoming.title)
        url_digest = sha256_text(canonical_url)
        title_digest = title_hash(incoming.title)
        body_hash = content_hash(incoming.text or incoming.summary)

        article, duplicate_reason, created_article = await self._find_or_create_article(
            incoming=incoming,
            canonical_url=canonical_url,
            normalized_title=normalized_title,
            url_digest=url_digest,
            title_digest=title_digest,
            body_hash=body_hash,
        )

        raw = RawArticle(
            source=incoming.source,
            source_url=incoming.source_url,
            requested_url=incoming.requested_url,
            canonical_url=canonical_url,
            url_hash=url_digest,
            title=incoming.title,
            normalized_title=normalized_title,
            title_hash=title_digest,
            summary=incoming.summary,
            raw_payload=incoming.raw_payload or {},
            raw_html=incoming.raw_html,
            published_at=db_datetime(incoming.published_at),
            article=article,
        )
        self.session.add(raw)

        event, created_event = await self._find_or_create_event(article, incoming)
        await self._link_article_to_event(event, article, duplicate_reason)

        try:
            await self.session.flush()
        except Exception as exc:
            # Handle concurrent duplicate inserts (race between multiple ingestion jobs)
            exc_str = str(exc).lower()
            if "unique" in exc_str or "duplicate" in exc_str or "integrity" in exc_str:
                await self.session.rollback()
                # Re-lookup — the article was inserted by a concurrent worker
                existing = await self.session.scalar(select(Article).where(Article.url_hash == url_digest))
                if existing:
                    return IngestionResult(
                        article=existing,
                        raw_article=raw,
                        event=event,
                        duplicate_reason="concurrent_duplicate",
                        created_article=False,
                        created_event=False,
                    )
            raise

        return IngestionResult(
            article=article,
            raw_article=raw,
            event=event,
            duplicate_reason=duplicate_reason,
            created_article=created_article,
            created_event=created_event,
        )

    async def _find_or_create_article(
        self,
        incoming: IncomingArticle,
        canonical_url: str,
        normalized_title: str,
        url_digest: str,
        title_digest: str,
        body_hash: str | None,
    ) -> tuple[Article, str, bool]:
        existing = await self.session.scalar(select(Article).where(Article.url_hash == url_digest))
        now = db_utcnow()
        if existing:
            existing.last_seen_at = now
            return existing, "url_hash", False

        similar = await self._find_similar_article(incoming.title, incoming.published_at)
        if similar:
            similar.last_seen_at = now
            return similar, "title_similarity_publish_window", False

        article = Article(
            canonical_url=canonical_url,
            url_hash=url_digest,
            title=incoming.title,
            normalized_title=normalized_title,
            title_hash=title_digest,
            source=incoming.source,
            author=incoming.author,
            published_at=db_datetime(incoming.published_at),
            first_seen_at=now,
            last_seen_at=now,
            content_hash=body_hash,
            text_preview=(incoming.text or incoming.summary or "")[:600],
        )
        self.session.add(article)
        return article, "new_article", True

    async def _find_similar_article(self, title: str, published_at: datetime | None) -> Article | None:
        hours = self.settings.article_duplicate_window_hours
        center = db_datetime(published_at) or db_utcnow()
        start = center - timedelta(hours=hours)
        end = center + timedelta(hours=hours)

        stmt: Select[tuple[Article]] = (
            select(Article)
            .where(Article.published_at.is_not(None))
            .where(Article.published_at >= start)
            .where(Article.published_at <= end)
            .order_by(Article.published_at.desc())
            .limit(80)
        )
        candidates = (await self.session.scalars(stmt)).all()
        threshold = self.settings.title_similarity_threshold
        for candidate in candidates:
            if title_similarity(title, candidate.title) >= threshold:
                return candidate
        return None

    async def _find_or_create_event(self, article: Article, incoming: IncomingArticle) -> tuple[Event, bool]:
        linked_event = await self.session.scalar(
            select(Event)
            .join(EventArticle, EventArticle.event_id == Event.id)
            .where(EventArticle.article_id == article.id)
            .limit(1)
        )
        now = db_utcnow()
        if linked_event:
            linked_event.last_seen_at = now
            linked_event.source_count = await self._count_event_sources(linked_event.id)
            return linked_event, False

        similar_event = await self._find_similar_event(article.title, incoming.category, incoming.region)
        if similar_event:
            similar_event.last_seen_at = now
            similar_event.last_meaningful_update_at = now
            return similar_event, False

        slug = self._event_slug(article.title)
        event = Event(
            slug=slug,
            title=article.title,
            normalized_title=article.normalized_title,
            category=incoming.category,
            region=incoming.region,
            confidence_score=0.35,
            source_count=1,
            first_seen_at=now,
            last_seen_at=now,
            last_meaningful_update_at=now,
        )
        self.session.add(event)
        return event, True

    async def _link_article_to_event(self, event: Event, article: Article, reason: str) -> None:
        existing = await self.session.scalar(
            select(EventArticle).where(
                EventArticle.event_id == event.id,
                EventArticle.article_id == article.id,
            )
        )
        if existing:
            return
        self.session.add(
            EventArticle(
                event=event,
                article=article,
                role="primary" if reason == "new_article" else "supporting",
                confidence_score=0.9 if reason == "url_hash" else 0.7,
            )
        )
        event.source_count = max(event.source_count, await self._count_event_sources(event.id) + 1)
        event.confidence_score = min(0.95, 0.35 + event.source_count * 0.12)

    async def _count_event_sources(self, event_id: uuid.UUID) -> int:
        rows = await self.session.scalars(
            select(Article.source)
            .join(EventArticle, EventArticle.article_id == Article.id)
            .where(EventArticle.event_id == event_id)
            .distinct()
        )
        return len(list(rows))

    async def _find_similar_event(
        self,
        title: str,
        category: str | None,
        region: str | None,
    ) -> Event | None:
        cutoff = db_utcnow() - timedelta(hours=self.settings.article_duplicate_window_hours)
        stmt = select(Event).where(Event.last_seen_at >= cutoff).order_by(Event.last_seen_at.desc()).limit(100)
        if category:
            stmt = stmt.where(Event.category == category)
        if region:
            stmt = stmt.where(Event.region == region)
        candidates = (await self.session.scalars(stmt)).all()
        threshold = max(0.72, self.settings.title_similarity_threshold - 0.08)
        for event in candidates:
            if should_cluster_titles(title, event.title, threshold=threshold):
                return event
        return None

    @staticmethod
    def _event_slug(title: str) -> str:
        base = normalize_title(title).replace(" ", "-")[:120].strip("-") or "event"
        suffix = uuid.uuid4().hex[:10]
        return f"{base}-{suffix}"
