import json
import logging
import re
import socket
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from typing import Awaitable, Callable

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

import hf_client
import news_fetcher
from app.core.config import Settings, get_settings
from app.models.news import (
    Article,
    EnrichmentQueue,
    EventArticle,
    EventMetric,
    HomeSnapshot,
    IngestionLock,
    NewsCycle,
    RawArticle,
    RankedStory,
    Story,
)
from app.services.text_fingerprint import content_hash, normalize_title, title_hash
from app.services.url_normalizer import normalize_url, sha256_text


logger = logging.getLogger("news-intel-mvp-pipeline")

QueueStatus = ("PENDING", "RUNNING", "DONE", "FAILED", "SKIPPED")


@dataclass(slots=True)
class CandidateArticle:
    title: str
    description: str
    url: str
    canonical_url: str
    source: str
    published_at: datetime | None
    category: str
    rss_query: str
    content_hash: str


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_rss_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    from email.utils import parsedate_to_datetime

    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def clean_ai_json(raw: str) -> dict:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


def similar_title(a: str, b: str) -> float:
    left = normalize_title(a)
    right = normalize_title(b)
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def importance_tier(pulse_score: float) -> str:
    if pulse_score >= 75:
        return "CRITICAL"
    if pulse_score >= 55:
        return "SIGNAL"
    if pulse_score >= 35:
        return "WATCH"
    return "NOISE"


def story_to_card(story: Story, rank: int = 0) -> dict:
    entities = story.entities_json if isinstance(story.entities_json, list) else []
    return {
        "id": str(story.id),
        "signal_id": str(story.id),
        "thread_id": str(story.id),
        "article_ids": [str(story.article_id)],
        "thread_title": story.display_title,
        "title": story.display_title,
        "summary": story.summary,
        "impact_line": story.why_it_matters,
        "why_it_matters": story.why_it_matters,
        "category": story.category,
        "matched_preferences": [{"id": story.category, "label": story.category.title()}],
        "entities": entities,
        "sentiment": story.sentiment,
        "risk_level": story.risk_level,
        "risk_type": "risk" if story.risk_level == "HIGH" else "neutral",
        "opportunity_level": "Medium" if story.sentiment in ("positive", "mixed") else "Low",
        "pulse_score": round(float(story.pulse_score), 2),
        "exposure_score": round(float(story.exposure_score), 2),
        "relevance_score": round(float(story.exposure_score), 2),
        "signal_tier": importance_tier(float(story.pulse_score)),
        "source_count": 1,
        "sources": [
            {
                "id": str(story.article_id),
                "title": story.display_title,
                "source": story.source_name,
                "url": story.source_url,
            }
        ],
        "story_graph": {
            "nodes": [
                {"id": "story", "label": story.display_title, "type": "event"},
                {"id": "category", "label": story.category.title(), "type": "category"},
                {"id": "source", "label": story.source_name, "type": "source"},
            ],
            "edges": [
                {"from": "story", "to": "category", "label": "classified as"},
                {"from": "story", "to": "source", "label": "reported by"},
            ],
        },
        "ai_status": "enriched",
        "ai_enriched_at": story.enriched_at.isoformat(),
        "updated_at": story.enriched_at.isoformat(),
        "last_seen_at": story.enriched_at.isoformat(),
        "published_at": story.published_at.isoformat() if story.published_at else None,
        "rank": rank,
        "pulse_breakdown": {
            "freshness": 80,
            "source_count": 1,
            "confidence": 70,
            "ai_importance": story.pulse_score,
            "user_relevance": story.exposure_score,
        },
    }


class AICircuitOpen(Exception):
    pass


class MVPNewsPipeline:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings | None = None,
        rss_fetcher: Callable[[list[str], int], Awaitable[list[dict]]] | None = None,
    ):
        self.session = session
        self.settings = settings or get_settings()
        self.rss_fetcher = rss_fetcher or news_fetcher.fetch_mvp_articles
        self.lock_owner = f"{socket.gethostname()}:{id(self)}"

    @property
    def ai_circuit_signature(self) -> str:
        return (
            f"rank:{self.settings.newsintel_ai_rank_max_tokens}:"
            f"enrich:{self.settings.newsintel_ai_enrich_max_tokens}:"
            f"models:{'|'.join(self.settings.openrouter_model_chain)}"
        )

    async def run_ingestion(self) -> dict:
        acquired = await self.acquire_lock("mvp_ingestion", minutes=max(2, self.settings.newsintel_ingest_interval_minutes))
        if not acquired:
            return {"status": "skipped", "reason": "ingestion_already_running"}

        cycle = NewsCycle(status="RUNNING", started_at=utcnow())
        self.session.add(cycle)
        await self.session.flush()

        try:
            categories = self.settings.mvp_categories
            per_category = max(1, int(self.settings.newsintel_articles_per_category))
            raw_items = await self.rss_fetcher(categories, per_category)
            candidates = self.normalize_candidates(raw_items)
            cycle.fetched_count = len(candidates)

            articles = await self.store_deduped_articles(candidates)
            cycle.deduped_count = len(articles)

            ranked = await self.rank_articles(articles)
            top_n = ranked[: max(1, int(self.settings.newsintel_rank_top_n))]
            cycle.ranked_count = len(top_n)
            await self.store_ranking_and_queue(cycle.id, top_n)

            cycle.status = "RANKED" if top_n else "NO_AI_RANKING"
            cycle.finished_at = utcnow()
            await self.session.commit()
            return {
                "status": cycle.status.lower(),
                "cycle_id": str(cycle.id),
                "fetched_count": cycle.fetched_count,
                "deduped_count": cycle.deduped_count,
                "ranked_count": cycle.ranked_count,
            }
        except AICircuitOpen as exc:
            cycle.status = "AI_DEFERRED"
            cycle.error_message = str(exc)[:1000]
            cycle.finished_at = utcnow()
            await self.session.commit()
            return {"status": "ai_deferred", "cycle_id": str(cycle.id), "error": str(exc)[:240]}
        except Exception as exc:
            logger.exception("MVP ingestion failed")
            await self.session.rollback()
            raise
        finally:
            try:
                await self.release_lock("mvp_ingestion")
            except Exception:
                await self.session.rollback()
                logger.warning("Failed to release MVP ingestion lock", exc_info=True)

    def normalize_candidates(self, raw_items: list[dict]) -> list[CandidateArticle]:
        candidates: list[CandidateArticle] = []
        for item in raw_items:
            title = (item.get("title") or "").strip()
            url = (item.get("url") or "").strip()
            if not title or not url:
                continue
            canonical_url = normalize_url(url)
            description = (item.get("text") or item.get("summary") or title).strip()
            candidates.append(
                CandidateArticle(
                    title=title[:500],
                    description=description[:1000],
                    url=url,
                    canonical_url=canonical_url,
                    source=(item.get("source") or "Unknown")[:160],
                    published_at=parse_rss_datetime(item.get("published")),
                    category=(item.get("category") or "tech").strip().lower(),
                    rss_query=item.get("rss_query") or "",
                    content_hash=content_hash(f"{title}\n{description}") or sha256_text(f"{title}\n{description}"),
                )
            )
        return candidates

    async def store_deduped_articles(self, candidates: list[CandidateArticle]) -> list[Article]:
        articles: list[Article] = []
        in_run_urls: set[str] = set()
        in_run_titles: list[str] = []
        now = utcnow()
        recent_rows = (
            await self.session.execute(
                select(Article.id, Article.title, Article.canonical_url)
                .where(Article.created_at >= now - timedelta(days=self.settings.newsintel_retention_days))
                .order_by(Article.created_at.desc())
                .limit(500)
            )
        ).all()

        for candidate in candidates:
            url_digest = sha256_text(candidate.canonical_url)
            if candidate.canonical_url in in_run_urls:
                continue
            if any(similar_title(candidate.title, seen) >= self.settings.title_similarity_threshold for seen in in_run_titles):
                continue

            existing = await self.session.scalar(select(Article).where(Article.url_hash == url_digest))
            if existing:
                existing.last_seen_at = now
                existing.category = existing.category or candidate.category
                existing.rss_query = existing.rss_query or candidate.rss_query
                articles.append(existing)
                in_run_urls.add(candidate.canonical_url)
                in_run_titles.append(candidate.title)
                continue

            if any(
                candidate.canonical_url == row.canonical_url
                or similar_title(candidate.title, row.title or "") >= self.settings.title_similarity_threshold
                for row in recent_rows
            ):
                continue

            article = Article(
                url=candidate.url,
                description=candidate.description,
                canonical_url=candidate.canonical_url,
                url_hash=url_digest,
                title=candidate.title,
                normalized_title=normalize_title(candidate.title),
                title_hash=title_hash(candidate.title),
                source=candidate.source,
                published_at=candidate.published_at,
                first_seen_at=now,
                last_seen_at=now,
                content_hash=candidate.content_hash,
                category=candidate.category,
                rss_query=candidate.rss_query,
                text_preview=candidate.description[:600],
                language="en",
                embedding_json=[],
            )
            self.session.add(article)
            articles.append(article)
            in_run_urls.add(candidate.canonical_url)
            in_run_titles.append(candidate.title)
        await self.session.flush()
        return articles

    async def rank_articles(self, articles: list[Article]) -> list[dict]:
        if not articles:
            return []
        if await self.is_ai_circuit_open():
            raise AICircuitOpen("AI circuit breaker is cooling down; ranking deferred.")

        listing = [
            {
                "i": index,
                "t": (article.title or "")[:160],
                "d": (article.description or article.text_preview or "")[:220],
                "s": (article.source or "")[:60],
                "c": article.category,
                "p": article.published_at.isoformat()[:10] if article.published_at else None,
            }
            for index, article in enumerate(articles)
        ]
        prompt = (
            "Rank real global RSS news by importance, freshness, public impact, credibility, "
            "category balance, newsworthiness, and long-term relevance. "
            "Return ONLY minified strict JSON, no markdown. Use compact reasons of max 6 words. "
            "Use each article_index at most once. Do not invent articles.\n"
            "Required shape:\n"
            '{"ranked":[{"article_index":0,"rank":1,"score":0,"reason":"...","importance":"HIGH/MEDIUM/LOW"}]}\n'
            f"Return exactly {min(self.settings.newsintel_rank_top_n, len(articles))} ranked items. "
            f"Articles use keys i=article_index,t=title,d=description,s=source,c=category,p=date:\n"
            f"{json.dumps(listing, ensure_ascii=False, separators=(',', ':'))}"
        )
        response = await self.call_ai(prompt, max_tokens=max(350, min(700, self.settings.newsintel_ai_rank_max_tokens)))
        parsed = clean_ai_json(response)
        ranked = parsed.get("ranked")
        if not isinstance(ranked, list):
            raise ValueError("AI ranking JSON did not include ranked array")

        used: set[int] = set()
        output = []
        for item in sorted(ranked, key=lambda row: int(row.get("rank") or 999)):
            index = int(item.get("article_index"))
            if index < 0 or index >= len(articles) or index in used:
                continue
            used.add(index)
            output.append(
                {
                    "article": articles[index],
                    "rank_position": len(output) + 1,
                    "ai_score": max(0, min(100, float(item.get("score") or 0))),
                    "ai_reason": str(item.get("reason") or "")[:1000],
                    "importance_level": str(item.get("importance") or "MEDIUM").upper()[:20],
                }
            )
        return output

    async def store_ranking_and_queue(self, cycle_id, ranked: list[dict]) -> None:
        for item in ranked:
            article = item["article"]
            self.session.add(
                RankedStory(
                    cycle_id=cycle_id,
                    article_id=article.id,
                    rank_position=item["rank_position"],
                    ai_score=item["ai_score"],
                    ai_reason=item["ai_reason"],
                    importance_level=item["importance_level"],
                    selected_for_enrichment=True,
                )
            )
            existing_story = await self.session.scalar(select(Story).where(Story.article_id == article.id))
            if existing_story:
                existing_story.cycle_id = cycle_id
                continue
            existing_queue = await self.session.scalar(
                select(EnrichmentQueue).where(
                    EnrichmentQueue.article_id == article.id,
                    EnrichmentQueue.cycle_id == cycle_id,
                    EnrichmentQueue.status.in_(["PENDING", "RUNNING", "DONE"]),
                )
            )
            if not existing_queue:
                self.session.add(
                    EnrichmentQueue(
                        article_id=article.id,
                        cycle_id=cycle_id,
                        status="PENDING",
                        attempts=0,
                        next_attempt_at=utcnow(),
                    )
                )
        await self.session.flush()

    async def enrich_batch(self) -> dict:
        acquired = await self.acquire_lock("mvp_enrichment", minutes=2)
        if not acquired:
            return {"status": "skipped", "reason": "enrichment_already_running"}
        try:
            if await self.is_ai_circuit_open():
                return {"status": "deferred", "reason": "ai_circuit_open", "processed": 0}
            batch_size = max(1, int(self.settings.newsintel_enrich_batch_size))
            now = utcnow()
            queue_rows = (
                await self.session.scalars(
                    select(EnrichmentQueue)
                    .where(EnrichmentQueue.status == "PENDING")
                    .where(EnrichmentQueue.attempts < 2)
                    .where((EnrichmentQueue.next_attempt_at.is_(None)) | (EnrichmentQueue.next_attempt_at <= now))
                    .order_by(EnrichmentQueue.created_at.asc())
                    .limit(batch_size)
                )
            ).all()
            if not queue_rows:
                await self.rebuild_home_snapshot()
                await self.session.commit()
                return {"status": "idle", "processed": 0}

            processed = failed = deferred = 0
            for queue_row in queue_rows:
                queue_row.status = "RUNNING"
                queue_row.locked_at = now
                queue_row.attempts += 1
                await self.session.flush()
                article = await self.session.get(Article, queue_row.article_id)
                if not article:
                    queue_row.status = "SKIPPED"
                    queue_row.error_message = "article_missing"
                    continue
                try:
                    await self.enrich_one(queue_row, article)
                    processed += 1
                except AICircuitOpen as exc:
                    queue_row.status = "PENDING"
                    queue_row.error_message = str(exc)[:1000]
                    queue_row.next_attempt_at = utcnow() + timedelta(minutes=self.settings.ai_circuit_breaker_cooldown_minutes)
                    deferred += 1
                    break
                except Exception as exc:
                    failed += 1
                    queue_row.error_message = str(exc)[:1000]
                    if queue_row.attempts >= 2:
                        queue_row.status = "FAILED"
                    else:
                        queue_row.status = "PENDING"
                        queue_row.next_attempt_at = utcnow() + timedelta(minutes=10)

            await self.session.flush()
            await self.rebuild_home_snapshot()
            await self.session.commit()
            return {"status": "success", "processed": processed, "failed": failed, "deferred": deferred}
        finally:
            await self.release_lock("mvp_enrichment")

    async def enrich_one(self, queue_row: EnrichmentQueue, article: Article) -> Story:
        if await self.is_ai_circuit_open():
            raise AICircuitOpen("AI circuit breaker is cooling down; enrichment deferred.")
        prompt = (
            "Enrich one real RSS article for News-Intel using only the metadata below. "
            "Do not invent facts. Return ONLY minified strict JSON, no markdown. "
            "Keep display_title <= 12 words, summary <= 22 words, why_it_matters <= 20 words, entities <= 6.\n"
            "Required shape:\n"
            '{"display_title":"","summary":"","why_it_matters":"","entities":[],"sentiment":"positive/neutral/negative/mixed",'
            '"pulse_score":0,"exposure_score":0,"importance_level":"HIGH/MEDIUM/LOW","risk_level":"LOW/MEDIUM/HIGH"}\n\n'
            f"ARTICLE:{json.dumps({'title': (article.title or '')[:180], 'description': (article.description or article.text_preview or '')[:260], 'source': article.source, 'category': article.category, 'published_at': article.published_at.isoformat() if article.published_at else None, 'url': article.canonical_url}, ensure_ascii=False, separators=(',', ':'))}"
        )
        parsed = clean_ai_json(await self.call_ai(prompt, max_tokens=max(320, min(650, self.settings.newsintel_ai_enrich_max_tokens))))
        return await self.upsert_story_from_payload(queue_row, article, parsed)

    async def upsert_story_from_payload(self, queue_row: EnrichmentQueue, article: Article, parsed: dict) -> Story:
        category = parsed.get("category") if parsed.get("category") in self.settings.mvp_categories else article.category
        story = await self.session.scalar(select(Story).where(Story.article_id == article.id))
        if not story:
            story = Story(article_id=article.id, cycle_id=queue_row.cycle_id, category=category or "tech")
            self.session.add(story)

        story.cycle_id = queue_row.cycle_id
        story.category = category or "tech"
        story.display_title = str(parsed.get("display_title") or article.title)[:500]
        story.summary = str(parsed.get("summary") or article.description or article.title)[:1200]
        story.why_it_matters = str(parsed.get("why_it_matters") or "")[:1200]
        entities = parsed.get("entities") if isinstance(parsed.get("entities"), list) else []
        story.entities_json = entities[:20]
        sentiment = str(parsed.get("sentiment") or "neutral").lower()
        story.sentiment = sentiment if sentiment in ("positive", "neutral", "negative", "mixed") else "neutral"
        story.pulse_score = max(0, min(100, float(parsed.get("pulse_score") or 50)))
        story.exposure_score = max(0, min(100, float(parsed.get("exposure_score") or 50)))
        story.importance_level = str(parsed.get("importance_level") or "MEDIUM").upper()[:20]
        risk = str(parsed.get("risk_level") or "LOW").upper()
        story.risk_level = risk if risk in ("LOW", "MEDIUM", "HIGH") else "LOW"
        story.source_url = article.canonical_url
        story.source_name = article.source
        story.published_at = article.published_at
        story.enriched_at = utcnow()
        await self.session.flush()

        self.session.add(
            EventMetric(
                story_id=story.id,
                cycle_id=queue_row.cycle_id,
                pulse_score=story.pulse_score,
                exposure_score=story.exposure_score,
                category=story.category,
            )
        )
        queue_row.status = "DONE"
        queue_row.locked_at = None
        queue_row.error_message = None
        cycle = await self.session.get(NewsCycle, queue_row.cycle_id)
        if cycle:
            cycle.enriched_count = int(cycle.enriched_count or 0) + 1
        return story

    async def call_ai(self, prompt: str, max_tokens: int) -> str:
        last_response: dict | None = None
        for model in self.settings.openrouter_model_chain:
            response = await hf_client.call_openrouter_raw(
                prompt,
                model=model,
                max_tokens=max_tokens,
            )
            if self.is_openrouter_size_response(response):
                retry_tokens = self.retry_token_budget(response, max_tokens)
                if retry_tokens:
                    response = await hf_client.call_openrouter_raw(
                        prompt,
                        model=model,
                        max_tokens=retry_tokens,
                    )
            if response.get("ok") and response.get("content"):
                return response["content"]
            last_response = response
            if self.is_openrouter_size_response(response):
                continue
            if self.is_quota_response(response):
                continue
            if self.is_retryable_openrouter_response(response):
                continue
            if self.is_empty_openrouter_success(response):
                continue
            break

        response = last_response or {"ok": False, "status_code": None, "body": "OpenRouter model chain did not run"}
        if self.is_quota_response(response):
            response = await hf_client.call_gemini_raw(prompt, max_tokens=max_tokens)
            if response.get("ok") and response.get("content"):
                return response["content"]
        elif not response.get("ok"):
            gemini_response = await hf_client.call_gemini_raw(prompt, max_tokens=max_tokens)
            if gemini_response.get("ok") and gemini_response.get("content"):
                return gemini_response["content"]
            response = gemini_response

        if self.is_quota_response(response):
            await self.open_ai_circuit(response)
            raise AICircuitOpen(f"AI provider quota/payment error: {response.get('status_code')}")
        if not response.get("ok") or not response.get("content"):
            raise ValueError(f"AI provider failed: {response.get('status_code')} {response.get('body', '')[:160]}")
        return response["content"]

    @staticmethod
    def is_quota_response(response: dict) -> bool:
        status = response.get("status_code")
        body = str(response.get("body") or "").lower()
        if status == 402 and "fewer max_tokens" in body:
            return False
        if status == 403 and ("permission_denied" in body or "denied access" in body):
            return True
        return status in (402, 429) or "quota" in body or "credit" in body or "payment" in body

    @staticmethod
    def is_openrouter_size_response(response: dict) -> bool:
        body = str(response.get("body") or "").lower()
        return response.get("status_code") == 402 and "fewer max_tokens" in body

    @staticmethod
    def is_retryable_openrouter_response(response: dict) -> bool:
        status = response.get("status_code")
        body = str(response.get("body") or "").lower()
        return status in (404, 408, 409, 425, 429, 500, 502, 503, 504) or "high demand" in body or "unavailable" in body

    @staticmethod
    def is_empty_openrouter_success(response: dict) -> bool:
        return response.get("provider") == "openrouter" and response.get("status_code") == 200 and not response.get("content")

    @staticmethod
    def retry_token_budget(response: dict, requested_tokens: int) -> int | None:
        body = str(response.get("body") or "")
        match = re.search(r"afford\s+(\d+)", body, flags=re.IGNORECASE)
        if not match:
            return None
        affordable = max(0, int(match.group(1)) - 32)
        retry_tokens = min(requested_tokens, affordable)
        return retry_tokens if retry_tokens >= 240 and retry_tokens < requested_tokens else None

    async def is_ai_circuit_open(self) -> bool:
        if self.session is None:
            return False
        lock = await self.session.scalar(select(IngestionLock).where(IngestionLock.lock_name == "ai_circuit_breaker"))
        if not lock:
            return False
        if not str(lock.locked_by or "").endswith(self.ai_circuit_signature):
            await self.session.delete(lock)
            await self.session.flush()
            return False
        now = utcnow()
        if not lock.locked_until or lock.locked_until <= now:
            return False
        max_cooldown = timedelta(minutes=self.ai_circuit_cooldown_minutes())
        if lock.locked_until - now > max_cooldown + timedelta(seconds=30):
            lock.locked_until = now - timedelta(seconds=1)
            await self.session.flush()
            return False
        return True

    def ai_circuit_cooldown_minutes(self) -> int:
        return max(
            1,
            min(
                int(self.settings.ai_circuit_breaker_cooldown_minutes or 10),
                max(1, int(self.settings.newsintel_ingest_interval_minutes or 10)),
            ),
        )

    async def open_ai_circuit(self, response: dict) -> None:
        if self.session is None:
            return
        until = utcnow() + timedelta(minutes=self.ai_circuit_cooldown_minutes())
        existing = await self.session.scalar(select(IngestionLock).where(IngestionLock.lock_name == "ai_circuit_breaker"))
        lock_owner = f"quota:{response.get('provider')}:{self.ai_circuit_signature}"
        if existing:
            existing.locked_until = until
            existing.locked_by = lock_owner
        else:
            self.session.add(IngestionLock(lock_name="ai_circuit_breaker", locked_until=until, locked_by=lock_owner))
        await self.session.flush()

    async def lock_status(self) -> dict:
        rows = (
            await self.session.scalars(
                select(IngestionLock).where(
                    IngestionLock.lock_name.in_(["mvp_ingestion", "mvp_enrichment", "ai_circuit_breaker"])
                )
            )
        ).all()
        now = utcnow()
        return {
            lock.lock_name: {
                "open": bool(lock.locked_until and lock.locked_until > now),
                "locked_until": lock.locked_until.isoformat() if lock.locked_until else None,
                "locked_by": lock.locked_by,
            }
            for lock in rows
        }

    async def acquire_lock(self, name: str, minutes: int) -> bool:
        if self.session is None:
            return True
        now = utcnow()
        lock = await self.session.scalar(select(IngestionLock).where(IngestionLock.lock_name == name))
        if lock and lock.locked_until > now:
            return False
        until = now + timedelta(minutes=minutes)
        if lock:
            lock.locked_until = until
            lock.locked_by = self.lock_owner
        else:
            self.session.add(IngestionLock(lock_name=name, locked_until=until, locked_by=self.lock_owner))
        await self.session.commit()
        return True

    async def release_lock(self, name: str) -> None:
        if self.session is None:
            return
        lock = await self.session.scalar(select(IngestionLock).where(IngestionLock.lock_name == name))
        if lock and lock.locked_by == self.lock_owner:
            lock.locked_until = utcnow() - timedelta(seconds=1)
            await self.session.commit()

    async def latest_cycle(self) -> NewsCycle | None:
        return await self.session.scalar(select(NewsCycle).order_by(NewsCycle.started_at.desc()).limit(1))

    async def latest_content_cycle(self) -> NewsCycle | None:
        return await self.session.scalar(
            select(NewsCycle)
            .join(RankedStory, RankedStory.cycle_id == NewsCycle.id)
            .join(Story, Story.article_id == RankedStory.article_id)
            .order_by(NewsCycle.started_at.desc())
            .limit(1)
        )

    async def rebuild_home_snapshot(self) -> dict:
        await self.session.execute(update(HomeSnapshot).where(HomeSnapshot.active.is_(True)).values(active=False))
        latest_cycle = await self.latest_cycle()
        content_cycle = await self.latest_content_cycle()
        snapshot_cycle = content_cycle or latest_cycle
        story_rows = []
        if snapshot_cycle:
            story_rows = (
                await self.session.execute(
                    select(Story, RankedStory.rank_position)
                    .join(RankedStory, RankedStory.article_id == Story.article_id)
                    .where(RankedStory.cycle_id == snapshot_cycle.id)
                    .order_by(RankedStory.rank_position.asc())
                    .limit(60)
                )
            ).all()
        stories = [row[0] for row in story_rows]
        rank_by_story_id = {row[0].id: row[1] for row in story_rows}
        cards = [story_to_card(story, rank_by_story_id.get(story.id, index + 1)) for index, story in enumerate(stories)]
        metrics = (
            await self.session.execute(
                select(EventMetric.category, EventMetric.pulse_score, EventMetric.exposure_score, EventMetric.created_at)
                .where(EventMetric.created_at >= utcnow() - timedelta(days=self.settings.newsintel_retention_days))
                .order_by(EventMetric.created_at.asc())
            )
        ).all()
        categories = {category: [] for category in self.settings.mvp_categories}
        for card in cards:
            categories.setdefault(card["category"], []).append(card)

        pulse = [
            {
                "category": row.category,
                "pulse_score": round(float(row.pulse_score), 2),
                "created_at": row.created_at.isoformat(),
            }
            for row in metrics
        ]
        exposure = [
            {
                "category": row.category,
                "exposure_score": round(float(row.exposure_score), 2),
                "created_at": row.created_at.isoformat(),
            }
            for row in metrics
        ]
        graph = [
            {"id": card["id"], "title": card["thread_title"], "category": card["category"], "pulse": card["pulse_score"]}
            for card in cards[:15]
        ]
        category_intensity = []
        for category in self.settings.mvp_categories:
            values = [card["pulse_score"] for card in categories.get(category, [])]
            category_intensity.append(
                {
                    "id": f"global:{category}",
                    "name": f"Global {category.title()}",
                    "mode": "global_category",
                    "category": category,
                    "intensity": round(sum(values) / len(values), 2) if values else 0,
                    "event_count": len(values),
                }
            )
        now = utcnow()
        world_pulse = round(sum(card["pulse_score"] for card in cards[:5]) / max(len(cards[:5]), 1), 2) if cards else None
        if world_pulse is None:
            world_pulse_label = None
        elif world_pulse >= 76:
            world_pulse_label = "High Pressure"
        elif world_pulse >= 56:
            world_pulse_label = "Elevated"
        elif world_pulse >= 31:
            world_pulse_label = "Normal"
        else:
            world_pulse_label = "Calm"
        active_regions = len({region for region in ["global"] if region})
        critical_count = len([card for card in cards if card.get("signal_tier") == "CRITICAL"])
        pipeline_health = await self.status()
        payload = {
            "lastUpdated": now.isoformat(),
            "cycleId": str(snapshot_cycle.id) if snapshot_cycle else "",
            "latestCycleId": str(latest_cycle.id) if latest_cycle else "",
            "topStories": cards[:3],
            "feed": cards,
            "categories": categories,
            "pulse": pulse,
            "exposure": exposure,
            "graph": graph,
            "map": category_intensity,
            "simulatorContext": [
                {
                    "id": card["id"],
                    "title": card["thread_title"],
                    "summary": card["summary"],
                    "category": card["category"],
                    "pulse_score": card["pulse_score"],
                }
                for card in cards[:10]
            ],
            "clusters": cards,
            "articles": [source for card in cards for source in card["sources"]],
            "topics_used": self.settings.mvp_categories,
            "regions_used": ["global"],
            "sources_count": len({source["source"] for card in cards for source in card["sources"]}),
            "generated_at": now.isoformat(),
            "cached_at": now.isoformat(),
            "refresh_type": "cached_mvp_snapshot",
            "pipeline_status": {
                "news": "cached_mvp_snapshot",
                "source_of_truth": "home_snapshots,stories,event_metrics",
                "latest_cycle": pipeline_health.get("latest_cycle"),
                "content_cycle": {
                    "id": str(snapshot_cycle.id),
                    "status": snapshot_cycle.status,
                    "started_at": snapshot_cycle.started_at.isoformat(),
                    "finished_at": snapshot_cycle.finished_at.isoformat() if snapshot_cycle.finished_at else None,
                }
                if snapshot_cycle
                else None,
                "queue": pipeline_health.get("queue"),
                "ai_circuit_open": pipeline_health.get("ai_circuit_open"),
                "locks": pipeline_health.get("locks"),
            },
            "daily_delta": self.category_deltas(metrics),
            "pulse_history": {"history": pulse},
            "world_pulse": world_pulse,
            "global_pulse": world_pulse,
            "world_pulse_label": world_pulse_label,
            "quick_glance": [
                {
                    "id": "countries",
                    "label": "Countries in Focus",
                    "value": active_regions,
                    "delta": f"{active_regions} live",
                    "deltaColor": "#7ee7c4",
                },
                {
                    "id": "signals",
                    "label": "Signals Tracked",
                    "value": len(cards),
                    "delta": f"{len(cards)} live",
                    "deltaColor": "#7ee7c4",
                },
                {
                    "id": "alerts",
                    "label": "High Impact Alerts",
                    "value": critical_count,
                    "delta": f"{critical_count} critical" if critical_count else None,
                    "deltaColor": "#ff9ba9",
                },
                {
                    "id": "sources",
                    "label": "Sources Monitored",
                    "value": len({source["source"] for card in cards for source in card["sources"]}),
                    "delta": "Live",
                    "deltaColor": "#7ee7c4",
                },
            ],
            "exposure_score": round(sum(card["exposure_score"] for card in cards[:5]) / max(len(cards[:5]), 1), 2) if cards else 50,
            "next_refresh_at": (now + timedelta(minutes=2)).isoformat(),
        }
        self.session.add(
            HomeSnapshot(
                cycle_id=snapshot_cycle.id if snapshot_cycle else None,
                payload_json=payload,
                active=True,
                created_at=now,
                expires_at=now + timedelta(minutes=self.settings.newsintel_ingest_interval_minutes),
            )
        )
        await self.session.flush()
        return payload

    def category_deltas(self, metrics) -> list[dict]:
        output = []
        for category in self.settings.mvp_categories:
            rows = [row for row in metrics if row.category == category]
            current = rows[-1].pulse_score if rows else None
            previous = rows[-2].pulse_score if len(rows) > 1 else None
            delta = float(current - previous) if current is not None and previous is not None else None
            direction = "Rising" if delta is not None and delta > 1 else "Cooling" if delta is not None and delta < -1 else "Stable"
            severity = "High" if delta is not None and abs(delta) >= 8 else "Medium" if delta is not None and abs(delta) >= 2 else "Stable"
            output.append(
                {
                    "topic": category,
                    "label": category.title(),
                    "current": round(float(current), 2) if current is not None else None,
                    "previous": round(float(previous), 2) if previous is not None else None,
                    "delta": round(delta, 2) if delta is not None else None,
                    "has_baseline": current is not None and previous is not None,
                    "direction": direction,
                    "severity_label": severity,
                    "reason": f"Live movement across {len(rows)} metric points.",
                }
            )
        return output

    async def latest_snapshot(self) -> dict:
        content_cycle = await self.latest_content_cycle()
        content_cycle_id = content_cycle.id if content_cycle else None
        snapshot = await self.session.scalar(
            select(HomeSnapshot).where(HomeSnapshot.active.is_(True)).order_by(HomeSnapshot.created_at.desc()).limit(1)
        )
        if snapshot and isinstance(snapshot.payload_json, dict):
            if content_cycle_id and snapshot.cycle_id != content_cycle_id:
                return await self.rebuild_home_snapshot()
            pipeline_status = snapshot.payload_json.get("pipeline_status")
            if not isinstance(pipeline_status, dict) or "queue" not in pipeline_status:
                return await self.rebuild_home_snapshot()
            return snapshot.payload_json
        return await self.rebuild_home_snapshot()

    async def feed(self, cursor: int = 0, limit: int = 3) -> dict:
        payload = await self.latest_snapshot()
        feed = payload.get("feed") if isinstance(payload.get("feed"), list) else []
        start = max(0, cursor)
        end = start + max(1, min(limit, 20))
        return {"items": feed[start:end], "cursor": start, "next_cursor": end if end < len(feed) else None}

    async def cleanup(self) -> dict:
        cutoff = utcnow() - timedelta(days=self.settings.newsintel_retention_days)
        deleted = {}
        for model, key in [
            (EventMetric, "event_metrics"),
            (Story, "stories"),
            (RankedStory, "ranked_stories"),
            (EnrichmentQueue, "enrichment_queue"),
            (HomeSnapshot, "home_snapshots"),
        ]:
            result = await self.session.execute(delete(model).where(model.created_at < cutoff))
            deleted[key] = int(result.rowcount or 0)
        article_result = await self.session.execute(
            delete(Article)
            .where(Article.created_at < cutoff)
            .where(Article.category.in_(self.settings.mvp_categories))
            .where(Article.id.not_in(select(RawArticle.article_id).where(RawArticle.article_id.is_not(None))))
            .where(Article.id.not_in(select(EventArticle.article_id)))
        )
        deleted["articles"] = int(article_result.rowcount or 0)
        await self.session.execute(
            update(HomeSnapshot)
            .where(HomeSnapshot.id.not_in(select(HomeSnapshot.id).where(HomeSnapshot.active.is_(True)).order_by(HomeSnapshot.created_at.desc()).limit(1)))
            .values(active=False)
        )
        await self.session.commit()
        return {"status": "success", "cutoff": cutoff.isoformat(), "deleted": deleted}

    async def status(self) -> dict:
        latest_cycle = await self.session.scalar(select(NewsCycle).order_by(NewsCycle.started_at.desc()).limit(1))
        pending = await self.session.scalar(select(func.count(EnrichmentQueue.id)).where(EnrichmentQueue.status == "PENDING"))
        running = await self.session.scalar(select(func.count(EnrichmentQueue.id)).where(EnrichmentQueue.status == "RUNNING"))
        done = await self.session.scalar(select(func.count(EnrichmentQueue.id)).where(EnrichmentQueue.status == "DONE"))
        ai_open = await self.is_ai_circuit_open()
        return {
            "latest_cycle": {
                "id": str(latest_cycle.id),
                "status": latest_cycle.status,
                "started_at": latest_cycle.started_at.isoformat(),
                "finished_at": latest_cycle.finished_at.isoformat() if latest_cycle.finished_at else None,
                "fetched_count": latest_cycle.fetched_count,
                "deduped_count": latest_cycle.deduped_count,
                "ranked_count": latest_cycle.ranked_count,
                "enriched_count": latest_cycle.enriched_count,
                "error_message": latest_cycle.error_message,
            }
            if latest_cycle
            else None,
            "queue": {"pending": int(pending or 0), "running": int(running or 0), "done": int(done or 0)},
            "ai_circuit_open": ai_open,
            "locks": await self.lock_status(),
            "categories": self.settings.mvp_categories,
            "articles_per_category": self.settings.newsintel_articles_per_category,
            "rank_top_n": self.settings.newsintel_rank_top_n,
            "enrich_batch_size": self.settings.newsintel_enrich_batch_size,
            "retention_days": self.settings.newsintel_retention_days,
        }
