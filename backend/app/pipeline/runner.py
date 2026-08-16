from __future__ import annotations

import asyncio
import logging
import secrets
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.events import publish
from app.core.database import AsyncSessionLocal
from app.core.redis import RedisClient
from app.models.base import utcnow
from app.models.news import Article
from app.models.pipeline_run import PipelineRun
from app.models.signal import Signal, SignalRelationship
from app.models.snapshot import PulseSample, Snapshot
from app.pipeline.clean.dedupe import dedupe_articles
from app.pipeline.clean.normalize import to_clean_article
from app.pipeline.enrich.hf import enrich_hf
from app.pipeline.enrich.llm import enrich_llm
from app.pipeline.fetch.images import filter_items_with_images
from app.pipeline.fetch.rss import fetch_all_sources
from app.pipeline.signals.relationships import build_edges
from app.pipeline.signals.score import score_item
from app.pipeline.snapshot.builder import build_snapshot_payload
from app.pipeline.types import EnrichedArticle, StageStat
from app.repositories.articles import recent_for_dedupe
from app.repositories.signals import list_live_imaged, relationships_for
from app.services.text_fingerprint import normalize_title

logger = logging.getLogger("newsintel-runner")

LOCK_KEY = "newsintel:lock:ingest"
COOLDOWN_KEY = "newsintel:cooldown:ingest"
REFRESH_KEY = "newsintel:refresh:requested"
ACTIVE_KEY = "newsintel:job:active"
LATEST_KEY = "newsintel:job:latest"
SNAPSHOT_KEY = "newsintel:snapshot:home"
LOCK_TTL = 600
COOLDOWN_TTL = 55 * 60


def _spawn_pipeline(redis: RedisClient, run_id: UUID, trigger: str) -> None:
    async def _run() -> None:
        try:
            await run_pipeline(redis, run_id=run_id, trigger=trigger)
        except RuntimeError as exc:
            if str(exc) != "lock_held":
                logger.exception("pipeline kick failed")
        except Exception:
            logger.exception("pipeline kick failed")

    asyncio.create_task(_run())


def _job_payload(run: PipelineRun) -> dict:
    stats = run.stats or {}
    return {
        "id": str(run.id),
        "status": run.status,
        "trigger": run.trigger,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "fetched": stats.get("fetched", 0),
        "rejected_no_image": stats.get("rejected_no_image", 0),
        "accepted": stats.get("accepted", 0),
        "deduped": stats.get("deduped", 0),
        "hf_ok": stats.get("hf_ok", 0),
        "llm_ok": stats.get("llm_ok", 0),
        "signals": stats.get("signals", 0),
        "stages": run.stages or [],
        "error": run.error,
    }


async def write_job(redis: RedisClient, run: PipelineRun) -> None:
    payload = _job_payload(run)
    await redis.set_json(f"newsintel:job:{run.id}", payload, ttl_seconds=24 * 3600)
    await redis.set(LATEST_KEY, str(run.id), ttl_seconds=24 * 3600)
    if run.status in {"queued", "running"}:
        await redis.set(ACTIVE_KEY, str(run.id), ttl_seconds=15 * 60)
    else:
        current = await redis.get(ACTIVE_KEY)
        if current == str(run.id):
            await redis.delete(ACTIVE_KEY)


async def enqueue_run(session: AsyncSession, redis: RedisClient, trigger: str, *, force: bool = False) -> tuple[PipelineRun, str]:
    if not redis.available:
        run = PipelineRun(id=uuid4(), status="queued", trigger=trigger, stats={}, stages=[])
        session.add(run)
        await session.commit()
        await session.refresh(run)
        _spawn_pipeline(redis, run.id, trigger)
        return run, "queued"
    active = await redis.get(ACTIVE_KEY)
    if active:
        existing = await session.get(PipelineRun, UUID(active))
        if existing:
            return existing, "already_running"
    if not force and await redis.get(COOLDOWN_KEY):
        latest_id = await redis.get(LATEST_KEY)
        if latest_id:
            existing = await session.get(PipelineRun, UUID(latest_id))
            if existing:
                return existing, "skipped"
    run = PipelineRun(id=uuid4(), status="queued", trigger=trigger, stats={}, stages=[])
    session.add(run)
    await session.commit()
    await session.refresh(run)
    await redis.set(REFRESH_KEY, str(run.id), ttl_seconds=15 * 60)
    await write_job(redis, run)
    _spawn_pipeline(redis, run.id, trigger)
    return run, "queued"


async def _stage(name: str, fn):
    started = datetime.now(timezone.utc)
    result = await fn()
    finished = datetime.now(timezone.utc)
    if isinstance(result, tuple) and result and isinstance(result[-1], StageStat):
        return result
    stat = StageStat(
        name=name,
        started_at=started.isoformat(),
        finished_at=finished.isoformat(),
        elapsed_ms=int((finished - started).total_seconds() * 1000),
        counts=result if isinstance(result, dict) else {},
    )
    return result, stat


async def run_pipeline(redis: RedisClient, run_id: UUID | None = None, trigger: str = "schedule") -> PipelineRun:
    settings = get_settings()
    token = secrets.token_urlsafe(16)
    if redis.available and not await redis.set_nx(LOCK_KEY, token, LOCK_TTL):
        logger.info("pipeline.skip lock_held")
        raise RuntimeError("lock_held")

    session: AsyncSession | None = None
    run: PipelineRun | None = None
    try:
        session = AsyncSessionLocal()
        if run_id:
            run = await session.get(PipelineRun, run_id)
        if not run:
            run = PipelineRun(id=run_id or uuid4(), status="running", trigger=trigger, stats={}, stages=[])
            session.add(run)
        run.status = "running"
        run.started_at = utcnow()
        await session.commit()
        await write_job(redis, run)
        await redis.expire_if_owner(LOCK_KEY, token, LOCK_TTL)

        publish("stage", name="fetch", status="running", run_id=str(run.id))
        raw_items, fetch_stat = await fetch_all_sources(redis)
        run.stages.append(asdict(fetch_stat))
        publish("stage", name="fetch", status="done", counts={"fetched": len(raw_items)}, run_id=str(run.id))
        await redis.expire_if_owner(LOCK_KEY, token, LOCK_TTL)

        publish("stage", name="images", status="running", run_id=str(run.id))
        started = datetime.now(timezone.utc)
        accepted_pairs, rejected = await filter_items_with_images(raw_items, redis)
        finished = datetime.now(timezone.utc)
        image_stat = StageStat(
            name="images",
            started_at=started.isoformat(),
            finished_at=finished.isoformat(),
            elapsed_ms=int((finished - started).total_seconds() * 1000),
            counts={"accepted_images": len(accepted_pairs), "rejected_no_image": rejected},
        )
        run.stages.append(asdict(image_stat))
        logger.info("image.done accepted=%s rejected=%s", len(accepted_pairs), rejected)
        publish("stage", name="images", status="done", counts={"accepted": len(accepted_pairs), "rejected": rejected}, run_id=str(run.id))

        cleaned = [to_clean_article(item, image_url) for item, image_url in accepted_pairs]
        recent = await recent_for_dedupe(session, days=settings.newsintel_retention_days)
        unique, dropped = dedupe_articles(cleaned, recent)
        publish("stage", name="dedupe", status="done", counts={"unique": len(unique), "dropped": dropped}, run_id=str(run.id))
        run.stages.append(
            asdict(
                StageStat(
                    name="dedupe",
                    started_at=datetime.now(timezone.utc).isoformat(),
                    finished_at=datetime.now(timezone.utc).isoformat(),
                    elapsed_ms=0,
                    counts={"unique": len(unique), "dropped": dropped},
                )
            )
        )

        persisted: list[EnrichedArticle] = []
        now = utcnow()
        for clean in unique:
            article = await session.scalar(select(Article).where(Article.url_hash == clean.url_hash))
            if not article:
                article = Article(
                    canonical_url=clean.canonical_url,
                    url=clean.canonical_url,
                    url_hash=clean.url_hash,
                    title=clean.title,
                    normalized_title=normalize_title(clean.title),
                    title_hash=clean.title_hash,
                    source=clean.source_name,
                    source_id=clean.source_id,
                    source_name=clean.source_name,
                    category=clean.category,
                    description=clean.summary,
                    text_preview=clean.summary[:600],
                    image_url=clean.image_url,
                    published_at=clean.published_at,
                    first_seen_at=now,
                    last_seen_at=now,
                    hf_json={},
                    embedding_json=[],
                    language="en",
                )
                session.add(article)
                await session.flush()
            else:
                article.last_seen_at = now
                article.image_url = clean.image_url
                article.source_id = clean.source_id
                article.source_name = clean.source_name
                article.category = article.category or clean.category
                article.description = clean.summary
            persisted.append(EnrichedArticle(article=clean, article_id=article.id, display_title=clean.title, llm_summary=clean.summary))
        await session.commit()

        publish("stage", name="hf", status="running", run_id=str(run.id))
        await enrich_hf(persisted, redis)
        hf_ok = sum(1 for item in persisted if item.hf_status == "ok")
        publish("stage", name="hf", status="done", counts={"hf_ok": hf_ok}, run_id=str(run.id))
        run.stages.append({"name": "hf", "counts": {"hf_ok": hf_ok, "hf_failed": len(persisted) - hf_ok}})
        await redis.expire_if_owner(LOCK_KEY, token, LOCK_TTL)

        publish("stage", name="llm", status="running", run_id=str(run.id))
        await enrich_llm(persisted, redis)
        llm_ok = sum(1 for item in persisted if item.llm_status == "ok")
        publish("stage", name="llm", status="done", counts={"llm_ok": llm_ok}, run_id=str(run.id))
        run.stages.append({"name": "llm", "counts": {"llm_ok": llm_ok, "llm_failed": len(persisted) - llm_ok}})
        publish("stage", name="signals", status="running", run_id=str(run.id))
        await redis.expire_if_owner(LOCK_KEY, token, LOCK_TTL)

        signals: list[Signal] = []
        index_to_signal: dict[int, UUID] = {}
        for index, item in enumerate(persisted):
            scored = score_item(item)
            article = await session.get(Article, item.article_id)
            if article:
                article.hf_json = {
                    "entities": [{"name": e.name, "type": e.type, "score": e.score} for e in item.entities],
                    "sentiment_label": item.sentiment_label,
                    "sentiment_score": item.sentiment_score,
                    "all_scores": item.all_scores,
                    "model_ids": {"ner": "dslim/bert-base-NER", "sentiment": "cardiffnlp/twitter-roberta-base-sentiment-latest"},
                }
                article.llm_json = {
                    "display_title": item.display_title,
                    "summary": item.llm_summary,
                    "why_it_matters": item.why_it_matters,
                    "importance": item.llm_importance,
                    "importance_reason": item.llm_importance_reason,
                }
                article.llm_status = item.llm_status
            existing = await session.scalar(select(Signal).where(Signal.article_id == item.article_id))
            if existing:
                signal = existing
            else:
                signal = Signal(article_id=item.article_id, run_id=run.id, image_url=item.article.image_url, source_name=item.article.source_name, source_url=item.article.canonical_url, title=item.display_title or item.article.title, summary=item.llm_summary or item.article.summary, category=item.article.category)
                session.add(signal)
                await session.flush()
            signal.run_id = run.id
            signal.category = item.article.category
            signal.title = item.display_title or item.article.title
            signal.summary = item.llm_summary or item.article.summary
            signal.why_it_matters = item.why_it_matters
            signal.image_url = item.article.image_url
            signal.source_name = item.article.source_name
            signal.source_url = item.article.canonical_url
            signal.entities = [{"name": e.name, "type": e.type, "score": e.score} for e in item.entities]
            signal.sentiment = item.sentiment_label
            signal.sentiment_score = item.sentiment_score
            signal.pulse = scored["pulse"]
            signal.exposure = scored["exposure"]
            signal.importance = scored["importance"]
            signal.pulse_breakdown = scored["pulse_breakdown"]
            signal.published_at = item.article.published_at
            signal.enriched_at = utcnow()
            signals.append(signal)
            index_to_signal[index] = signal.id
        await session.flush()

        seen_article_ids = {item.article_id for item in persisted if item.article_id}
        promoted = 0
        for clean in cleaned:
            article = await session.scalar(select(Article).where(Article.url_hash == clean.url_hash))
            if not article or article.id in seen_article_ids or not clean.image_url:
                continue
            article.last_seen_at = now
            article.image_url = clean.image_url
            existing = await session.scalar(select(Signal).where(Signal.article_id == article.id))
            if existing:
                existing.image_url = clean.image_url
                existing.run_id = run.id
                existing.published_at = existing.published_at or clean.published_at
                signals.append(existing)
                seen_article_ids.add(article.id)
                continue
            created = Signal(
                article_id=article.id,
                run_id=run.id,
                image_url=clean.image_url,
                source_name=clean.source_name or article.source_name or "source",
                source_url=clean.canonical_url,
                title=article.title or clean.title,
                summary=article.description or clean.summary or "",
                category=article.category or clean.category,
                published_at=article.published_at or clean.published_at,
            )
            session.add(created)
            await session.flush()
            signals.append(created)
            seen_article_ids.add(article.id)
            promoted += 1
        if promoted:
            logger.info("pipeline.promoted existing articles into signals count=%s", promoted)

        edges = build_edges(persisted, index_to_signal)
        for signal in signals:
            await session.execute(delete(SignalRelationship).where(SignalRelationship.source_id == signal.id))
        for edge in edges:
            session.add(edge)

        seen_ids = {signal.id for signal in signals}
        for existing in await list_live_imaged(session, 40):
            if existing.id not in seen_ids and existing.image_url:
                signals.append(existing)
                seen_ids.add(existing.id)
        if edges or seen_ids:
            extra_edges = await relationships_for(session, list(seen_ids))
            known = {(edge.source_id, edge.target_id, edge.rel_type) for edge in edges}
            for edge in extra_edges:
                key = (edge.source_id, edge.target_id, edge.rel_type)
                if key not in known:
                    edges.append(edge)
                    known.add(key)

        imaged = [signal for signal in signals if signal.image_url]
        if not imaged:
            run.status = "partial"
            run.finished_at = utcnow()
            run.stats = {
                "fetched": len(raw_items),
                "rejected_no_image": rejected,
                "accepted": len(accepted_pairs),
                "deduped": len(unique),
                "hf_ok": hf_ok,
                "llm_ok": llm_ok,
                "signals": 0,
                "kept_previous_snapshot": True,
            }
            await session.commit()
            await write_job(redis, run)
            logger.info("pipeline.end kept previous snapshot; no imaged signals this cycle")
            return run

        await session.execute(update(Snapshot).where(Snapshot.active.is_(True)).values(active=False))
        by_cat: dict[str, list[float]] = {}
        for signal in imaged:
            by_cat.setdefault(signal.category, []).append(signal.pulse)
        pulse_history = []
        for category, values in by_cat.items():
            avg = round(sum(values) / len(values), 2)
            session.add(PulseSample(run_id=run.id, category=category, pulse=avg))
            pulse_history.append({"category": category, "pulse_score": avg, "created_at": utcnow().isoformat()})

        category_counts = {category: len(by_cat.get(category, [])) for category in settings.mvp_categories}
        partial = any(count < 4 for count in category_counts.values())
        stats = {
            "fetched": len(raw_items),
            "rejected_no_image": rejected,
            "accepted": len(accepted_pairs),
            "deduped": len(unique),
            "hf_ok": hf_ok,
            "llm_ok": llm_ok,
            "signals": len(imaged),
            "categories": category_counts,
        }
        pipeline_status = {
            "news": "live",
            "source_of_truth": "snapshots,signals",
            "queue": {"accepted": len(unique), "signals": len(imaged), "running": 0, "pending": 0},
            "ai_circuit_open": bool(await redis.get("newsintel:circuit:ai")),
            "stages": run.stages,
            "latest_cycle": {"status": "partial" if partial else "succeeded"},
        }
        run.stages.append(
            asdict(
                StageStat(
                    name="signals",
                    started_at=datetime.now(timezone.utc).isoformat(),
                    finished_at=datetime.now(timezone.utc).isoformat(),
                    elapsed_ms=0,
                    counts={"signals": len(imaged)},
                )
            )
        )
        publish("stage", name="signals", status="done", counts={"signals": len(imaged)}, run_id=str(run.id))
        publish("stage", name="snapshot", status="running", run_id=str(run.id))
        payload = build_snapshot_payload(
            run_id=run.id,
            signals=imaged,
            relationships=edges,
            pipeline_status=pipeline_status,
            pulse_history=pulse_history,
        )
        snapshot = Snapshot(
            run_id=run.id,
            payload_json=payload,
            active=True,
            created_at=utcnow(),
            expires_at=utcnow() + timedelta(minutes=settings.newsintel_ingest_interval_minutes),
        )
        session.add(snapshot)
        run.status = "partial" if partial else "succeeded"
        run.finished_at = utcnow()
        run.stats = stats
        await session.commit()
        await redis.set_json(SNAPSHOT_KEY, payload, ttl_seconds=settings.dashboard_cache_ttl_seconds)
        publish(
            "snapshot",
            status=run.status,
            signals=len(imaged),
            fetched=len(raw_items),
            accepted=len(accepted_pairs),
            run_id=str(run.id),
        )
        await redis.set(COOLDOWN_KEY, str(run.id), ttl_seconds=COOLDOWN_TTL)
        await redis.delete(REFRESH_KEY)
        await write_job(redis, run)
        logger.info("pipeline.end status=%s signals=%s elapsed_ms=%s", run.status, len(signals), int(((run.finished_at - run.started_at).total_seconds() * 1000)))
        return run
    except Exception as exc:
        logger.exception("pipeline.fail")
        if session and run:
            run.status = "failed"
            run.error = str(exc)[:1000]
            run.finished_at = utcnow()
            await session.commit()
            await write_job(redis, run)
        raise
    finally:
        await redis.delete_if_owner(LOCK_KEY, token)
        if session:
            await session.close()


async def maybe_run_from_queue(redis: RedisClient) -> PipelineRun | None:
    if await redis.get(COOLDOWN_KEY) or await redis.get(LOCK_KEY):
        return None
    requested = await redis.get(REFRESH_KEY)
    run_id = UUID(requested) if requested else None
    return await run_pipeline(redis, run_id=run_id, trigger="user_refresh" if run_id else "schedule")
