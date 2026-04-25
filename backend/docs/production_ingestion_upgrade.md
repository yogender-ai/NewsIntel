# News Intel Production Ingestion Upgrade

This upgrade adds the production ingestion spine next to the existing MVP API.
The old `main.py` can continue serving the current frontend while `/app/main_prod.py`
and the worker are adopted route by route.

## Folder Structure

```text
backend/
  app/
    main_prod.py                 # FastAPI v2 app, no scheduler in lifespan
    api/routes.py                # Redis-backed read endpoints
    core/config.py               # env settings
    core/database.py             # async SQLAlchemy engine/session
    core/cache.py                # Redis JSON cache
    models/news.py               # production PostgreSQL schema
    repositories/ingestion.py    # transactional raw/article/event writes
    services/
      url_normalizer.py          # canonical URL + tracking param stripping
      redirect_resolver.py       # follows publisher redirects
      text_fingerprint.py        # title/content fingerprints + similarity
      ingestion_pipeline.py      # fetch -> normalize -> persist -> dedupe
    workers/ingestion_worker.py  # external scheduler process
  alembic/
    env.py
    versions/20260425_0001_production_ingestion_schema.py
  alembic.ini
```

## Schema

Core tables:

- `raw_articles`: every source snapshot exactly as fetched, with raw payload/html.
- `articles`: canonical deduplicated article rows with permanent UUIDs.
- `events`: clustered real-world story/event rows.
- `event_articles`: many-to-many links between events and articles.
- `users`: durable user identity mapped from Firebase/external auth.
- `preferences`: user topics, regions, tracked entities, refresh policy.
- `alerts`: user-facing alerts linked to events.

Important production invariants:

- Never expose per-fetch IDs to the frontend.
- `articles.id` is the permanent UUID for an article.
- `events.id` is the permanent UUID for a story cluster.
- `raw_articles` is append-only audit evidence.
- LLM summaries must reference `events` and `event_articles`, not raw RSS items.

## Migration Plan

1. Provision Postgres and Redis.

```bash
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/newsintel
REDIS_URL=redis://HOST:6379/0
```

2. Install new backend dependencies.

```bash
pip install -r requirements.txt
```

3. Run migrations.

```bash
alembic upgrade head
```

4. Run ingestion once in staging.

```bash
WORKER_MODE=once INGEST_TOPICS=ai,tech,markets INGEST_REGIONS=global python -m app.workers.ingestion_worker
```

5. Start the production API separately.

```bash
uvicorn app.main_prod:app --host 0.0.0.0 --port 8000
```

6. Start the scheduler as a separate process/container.

```bash
WORKER_MODE=scheduler python -m app.workers.ingestion_worker
```

7. Point one frontend page or internal admin page at `/api/v2/events`.

8. Once event quality is proven, migrate the dashboard pipeline from temporary
   RSS IDs to `events.id` and `articles.id`.

## Dedupe Rules

The ingestion repository currently dedupes by:

1. Canonical URL hash.
2. Title similarity inside a configurable publish-time window.
3. Persistent raw snapshots tied back to the canonical article.

Recommended next hardening:

- Add source-specific canonical URL rules for Reuters, Bloomberg, CNBC, etc.
- Add SimHash or MinHash for article body similarity.
- Add embedding-based event clustering using pgvector.
- Add a `canonical_url_aliases` table for redirect churn.
- Add source trust scores and syndication detection.

## Redis Cache Rules

Redis replaces in-process feed cache for production read models.

Use keys like:

```text
events:v2:{category}:{region}:{limit}
dashboard:v2:{user_id}
event:{event_id}
```

Invalidate on worker writes:

```text
events:v2:*
dashboard:v2:{affected_user_id}
event:{event_id}
```

Do not put ingestion truth in Redis. Redis is cache only. Postgres is source of truth.

## Scheduler Rules

The scheduler must not run in FastAPI lifespan.

Run it as:

- separate Render background worker
- separate Docker container
- Kubernetes CronJob/Deployment
- systemd timer
- managed scheduler invoking `WORKER_MODE=once`

Default cadence:

- hot topics: every 15 minutes
- medium topics: hourly
- slow topics: every 6 hours

The dashboard should show "No major update" when no new event or meaningful
event update exists. Do not manufacture freshness.

## Best Practices

- Store raw article payloads before any LLM touches the data.
- Treat LLM output as interpretation, not truth.
- Validate all LLM article/event IDs against Postgres.
- Keep `published_at`, `first_seen_at`, and `last_seen_at` separate.
- Alert only on event deltas, not every refresh.
- Add metrics for duplicate rate, stale rate, source failures, worker duration,
  Redis hit rate, and LLM parse failures.
- Use UTC everywhere.
- Add dead-letter handling for failed fetches.
- Add row-level retention policy for raw HTML if storage grows too fast.

## Phase 5.5 Cutover Status

The existing `/api/dashboard` and `/api/personalized-dashboard` endpoints now
consume the event-backed read model. The old RSS article-thread builder remains
in the codebase only for comparison and rollback during the migration window;
it is no longer on the active dashboard request path.

Single source of truth after cutover:

- `events`: drives visible signals, story continuity, pulse source inputs, and
  future heatmap inputs.
- `event_articles`: drives source coverage, story chain evidence, clustering
  continuity, and previous-news linking.
- `raw_articles`: audit evidence only; never directly drives dashboard cards.

Side-by-side comparison is handled by
`app.services.dashboard_read_model.compare_dashboard_payloads`, which reports:

- signal count differences
- event clustering differences
- shared-title pulse differences
- missing/added signals between legacy and event-backed payloads

Expected quality improvement:

- Story continuity improves because stable `event.id` replaces temporary per-fetch
  article IDs.
- Previous-news linking improves because `event_articles` preserves historical
  source coverage.
- Causal chain quality improves only to the extent that event clustering is
  correct; causal inference still must remain evidence-bound and should not be
  treated as a model-generated fact.
