# News Intel Full Pipeline Report

## 1. Project Overview

News Intel is an AI-powered news intelligence platform. It fetches real-time news from Google News RSS, cleans and deduplicates articles, ranks the most important stories with AI, enriches selected stories into usable intelligence cards, stores the results in a database, and serves them to a React dashboard through FastAPI APIs.

The current public dashboard path is the controlled MVP pipeline in `backend/app/services/mvp_pipeline.py`. The repo also contains a richer event-store pipeline in `backend/app/services/ingestion_pipeline.py` and `backend/app/repositories/ingestion.py`, which stores raw snapshots, canonical articles, event clusters, event relationships, personalization, alerts, and digests.

## 2. Main Technology Stack

### Backend

- **FastAPI**: REST API server.
- **Uvicorn**: ASGI server for running FastAPI.
- **SQLAlchemy async ORM**: Database models and async queries.
- **asyncpg**: PostgreSQL async driver.
- **Alembic**: Database migrations.
- **PostgreSQL**: Main production database target.
- **Redis**: Optional cache and distributed lock layer.
- **APScheduler**: External/background ingestion scheduler.
- **httpx**: Async HTTP client for RSS, gateway, and AI calls.
- **feedparser**: Parses Google News RSS feeds.
- **python-dotenv / pydantic-settings**: Environment variable configuration.
- **cachetools**: Local cache support.
- **pytest**: Backend testing.

### AI / NLP Providers

- **OpenRouter through Cloud Command Gateway**: Primary AI synthesis/ranking/enrichment provider.
- **Google Gemini through Cloud Command Gateway**: Fallback AI provider.
- **Hugging Face Space through Cloud Command Gateway**: Sentiment, NER, and summarization support in the legacy/full intelligence path.
- **Gemini Embeddings through Cloud Command Gateway**: Used by semantic clustering/embedding services when configured.

### Frontend

- **React 19**: Main UI.
- **Vite**: Frontend build/dev server.
- **React Router**: Page routing.
- **Firebase**: User identity/auth headers.
- **axios/fetch**: API communication.
- **lucide-react**: Icons.
- **three / @react-three/fiber / @react-three/drei**: 3D/visual dashboard components.
- **d3-geo / topojson-client**: Map/geography visualization support.

## 3. High-Level Pipeline

```text
Google News RSS
    -> RSS fetch by category/topic
    -> normalize title, URL, summary, source, timestamp
    -> deduplicate articles
    -> save canonical articles in database
    -> AI rank articles
    -> queue top ranked stories for enrichment
    -> AI enrich stories
    -> save story cards and event metrics
    -> rebuild home snapshot
    -> frontend reads /api/home-snapshot and renders dashboard
```

The platform is designed so the user-facing dashboard reads from cached/saved database snapshots instead of waiting for live RSS and AI calls on every page load.

## 4. News Fetching Flow

News fetching is implemented in `backend/news_fetcher.py`.

For the MVP dashboard, the function `fetch_mvp_articles(categories, per_category)` is used. It fetches controlled categories:

- `tech`
- `education`
- `entertainment`
- `politics`

Each category maps to a Google News search query, for example:

- `tech`: global technology, AI, startups, cybersecurity, semiconductors
- `education`: universities, students, exams, online learning
- `entertainment`: movies, music, celebrities, streaming
- `politics`: elections, government, diplomacy, policy

The fetcher builds Google News RSS URLs like:

```text
https://news.google.com/rss/search?q=<encoded query>&hl=en&gl=US&ceid=US:en
```

It adds `when:1d` to bias results toward the last 24 hours. `httpx.AsyncClient` downloads the RSS feed and `feedparser` parses entries. Each article is normalized into a dictionary with:

- `title`
- `text` / summary
- `source`
- `url`
- `published`
- `category`
- `rss_query`

The fetcher also performs in-memory short TTL caching to avoid refetching the same topic too frequently.

## 5. Normalization and Deduplication

The MVP pipeline starts in `MVPNewsPipeline.run_ingestion()`.

Raw RSS items are converted into `CandidateArticle` objects. The pipeline:

- trims long titles and descriptions
- parses RSS timestamps into UTC datetimes
- normalizes URLs with `normalize_url`
- hashes canonical URLs with SHA-256
- normalizes titles with `normalize_title`
- hashes titles with `title_hash`
- creates a content hash from title and description

Deduplication happens in `store_deduped_articles()`:

- It skips duplicate URLs inside the same run.
- It skips very similar titles inside the same run.
- It checks the `articles` table by `url_hash`.
- If an existing article is found, it updates `last_seen_at`.
- It checks recent stored articles within the retention window.
- It uses `SequenceMatcher` title similarity and the configured `TITLE_SIMILARITY_THRESHOLD`.

Only clean, deduplicated articles are inserted into the `articles` table.

## 6. Database Storage

Database models are defined in `backend/app/models/news.py`.

Important MVP tables:

- **`articles`**: canonical deduplicated news articles.
- **`news_cycles`**: one ingestion run, including fetched/deduped/ranked/enriched counts.
- **`ranked_stories`**: AI-ranked article list for a cycle.
- **`enrichment_queue`**: pending articles selected for AI enrichment.
- **`stories`**: final enriched user-facing story cards.
- **`event_metrics`**: pulse/exposure time-series metrics.
- **`home_snapshots`**: cached dashboard payload served to frontend.
- **`ingestion_locks`**: prevents duplicate ingestion/enrichment jobs and stores AI circuit breaker state.

Important full event-store tables:

- **`raw_articles`**: immutable source snapshots before normalization.
- **`articles`**: canonical article records.
- **`events`**: clustered real-world events.
- **`event_articles`**: links articles to event clusters.
- **`event_relationships`**: AI-validated relationships between events.
- **`event_relationship_checks`**: cache of checked event pairs.
- **`users` / `preferences`**: personalization data.
- **`alerts` / `alert_rules`**: user alert system.
- **`daily_digests` / `digest_delivery_logs`**: digest generation and delivery tracking.
- **`scenario_runs`**: stored scenario simulation runs.

The production database URL comes from `DATABASE_URL`. If it uses PostgreSQL, the code converts it to `postgresql+asyncpg://` for SQLAlchemy async support.

## 7. AI Ranking Pipeline

After articles are saved, `rank_articles()` sends a compact JSON list of articles to AI.

The prompt asks AI to rank stories by:

- importance
- freshness
- public impact
- credibility
- category balance
- newsworthiness
- long-term relevance

The AI must return strict JSON:

```json
{
  "ranked": [
    {
      "article_index": 0,
      "rank": 1,
      "score": 0,
      "reason": "...",
      "importance": "HIGH/MEDIUM/LOW"
    }
  ]
}
```

The pipeline validates the indices, removes duplicates, caps scores from 0 to 100, and saves the ranking into `ranked_stories`.

Top ranked articles are added to `enrichment_queue` with status `PENDING`.

## 8. AI Provider Routing

AI calls are implemented in `backend/hf_client.py`.

The main provider order is:

1. **OpenRouter** through the Cloud Command Gateway.
2. **Gemini** through the Cloud Command Gateway as fallback.
3. **Hugging Face Space** for specialized NLP endpoints in the legacy/full intelligence path.

The gateway uses:

- `GATEWAY_BASE_URL`
- `GATEWAY_SECRET`
- `HF_SPACE_URL`
- `GEMINI_EMBEDDING_URL`

The MVP pipeline uses raw provider calls so it can inspect status codes. If AI quota, throttling, model-size, or empty-response errors happen, it can open an AI circuit breaker in `ingestion_locks`. This prevents repeated failing AI calls during cooldown.

## 9. AI Enrichment Pipeline

`enrich_batch()` processes a small batch from `enrichment_queue`.

For each queued article:

- mark queue row as `RUNNING`
- load the article
- send article metadata to AI
- require strict JSON output
- validate and normalize the result
- create/update a `stories` row
- create an `event_metrics` row
- mark queue row as `DONE`

The enrichment output includes:

- `display_title`
- `summary`
- `why_it_matters`
- `entities`
- `sentiment`
- `pulse_score`
- `exposure_score`
- `importance_level`
- `risk_level`

These fields are what the frontend uses to show intelligent story cards instead of plain RSS headlines.

If enrichment fails, the queue row is retried. After too many failures, it becomes `FAILED`.

## 10. Home Snapshot / Read Model

After enrichment, `rebuild_home_snapshot()` creates a dashboard-ready payload and stores it in `home_snapshots`.

The snapshot contains:

- `topStories`
- `feed`
- `categories`
- `pulse`
- `exposure`
- `graph`
- `map`
- `simulatorContext`
- `clusters`
- `articles`
- `daily_delta`
- `pulse_history`
- `world_pulse`
- `quick_glance`
- `pipeline_status`
- `next_refresh_at`

This is important because the frontend does not need to join many tables or wait for AI. It simply requests the latest active snapshot.

## 11. API Integration

The main API file is `backend/main.py`.

Important public/dashboard endpoints:

- `GET /api/home-snapshot`: returns the active dashboard snapshot.
- `GET /api/feed`: paginated feed from the snapshot.
- `GET /api/story/{story_id}`: story detail.
- `POST /api/dashboard`: manual refresh trigger.
- `GET /api/categories`: supported categories.
- `GET /api/orbit`: graph/orbit data.
- `GET /api/map-signals`: map signal data.
- `POST /api/simulate`: scenario simulation.
- `GET /health`: health check.

Important admin/scheduler endpoints:

- `POST /api/admin/ingest-now`: external scheduler trigger.
- `POST /api/admin/enrich-batch`: process enrichment queue.
- `GET /api/admin/ingestion-status`: pipeline status.
- `POST /api/admin/reset-ai-circuit`: reset AI circuit breaker.
- `POST /api/admin/cleanup`: cleanup old records.

The production-style v2 API in `backend/app/main_prod.py` includes `backend/app/api/routes.py` under `/api/v2`, with endpoints such as:

- `GET /api/v2/events`
- `GET /api/v2/articles/{article_id}`
- `GET /api/v2/dashboard-compatible`
- `GET /api/v2/orbit`

## 12. Scheduler and Background Jobs

The project is designed so ingestion runs outside the user request path.

`backend/app/workers/ingestion_worker.py` defines an external scheduler:

- hot topics every 15 minutes
- medium topics every 1 hour
- slow topics every 6 hours

It uses APScheduler and cache locks to avoid duplicate concurrent jobs.

For the active MVP dashboard, external schedulers such as Cloud Command can call:

```text
POST /api/admin/ingest-now
POST /api/admin/enrich-batch
```

This separates expensive fetch/AI work from normal dashboard reads.

## 13. Frontend Integration

Frontend API calls are implemented in `frontend/src/api.js`.

The frontend base URL is:

```js
import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
```

Firebase identity is attached using headers:

- `X-User-Id`
- `X-User-Email`

The dashboard reads:

- `GET /api/home-snapshot` for the main dashboard
- `POST /api/dashboard` for manual refresh
- `GET /api/story/{id}` for story detail
- `GET /api/orbit` for relationship/orbit views
- `GET /api/map-signals` for map views
- `POST /api/simulate` for scenario simulation

`frontend/src/lib/dashboardAdapter.js` normalizes raw API payloads into UI-friendly shapes:

- world pulse
- top shifts
- changes today
- dimensions
- quick glance cards
- alerts
- pipeline status

This adapter lets the UI remain stable even when backend payloads evolve.

## 14. Full Event-Store Pipeline

The richer pipeline is implemented in:

- `backend/app/services/ingestion_pipeline.py`
- `backend/app/repositories/ingestion.py`
- `backend/app/services/event_enrichment.py`
- `backend/app/services/event_relationships.py`
- `backend/app/services/dashboard_read_model.py`

Its flow is:

```text
fetch_news(topics, regions)
    -> resolve redirects
    -> create IncomingArticle
    -> save raw_articles snapshot
    -> find/create canonical article
    -> create article embedding
    -> find/create event cluster
    -> link article to event
    -> enrich event with AI
    -> calculate pulse/tier
    -> validate relationships between events
    -> serve event-backed dashboard payload
```

This pipeline is more advanced than the MVP path because it models stories as persistent event clusters rather than one enriched card per article.

## 15. Personalization, Alerts, Digests, and Simulation

The database and endpoints include support for:

- user preferences by category, region, and tracked entities
- watchlist/saved threads
- alerts and alert rules
- daily digest generation
- scenario simulation
- orbit/event relationship visualization
- map signals

These features build on the event and story data already stored in the database.

## 16. What Has Been Done in the Project

Completed major pieces:

- Built a FastAPI backend with real RSS ingestion.
- Added Google News RSS fetching with topic/category support.
- Added article normalization and deduplication.
- Added async SQLAlchemy database models.
- Added Alembic migrations for production schemas.
- Added AI ranking through OpenRouter/Gemini.
- Added enrichment queue and batch enrichment.
- Added AI circuit breaker for provider quota/throttling failures.
- Added `home_snapshots` read model for fast dashboard loading.
- Added scheduler/admin endpoints for external automation.
- Added React frontend with dashboard, orbit, map, alerts, simulator, and story pages.
- Added Firebase-aware request headers for user identity.
- Added event-store pipeline for raw article snapshots, canonical articles, event clustering, event enrichment, and relationships.
- Added tests for the MVP pipeline behavior.

## 17. End-to-End Example

1. Scheduler calls `POST /api/admin/ingest-now`.
2. Backend creates a `news_cycles` row.
3. Backend fetches articles from Google News RSS.
4. Articles are normalized and deduplicated.
5. Clean articles are saved to `articles`.
6. AI ranks articles by importance.
7. Ranked rows are saved to `ranked_stories`.
8. Top stories are added to `enrichment_queue`.
9. Scheduler calls `POST /api/admin/enrich-batch`.
10. Backend enriches queued stories with AI.
11. Enriched cards are saved to `stories`.
12. Pulse metrics are saved to `event_metrics`.
13. Backend rebuilds `home_snapshots`.
14. Frontend calls `GET /api/home-snapshot`.
15. React adapter normalizes payload.
16. Dashboard renders top stories, pulse, feed, categories, graph, map, and pipeline status.

## 18. Key Design Decisions

- **Cached read model**: Dashboard loads from `home_snapshots`, not from live AI calls.
- **Queue-based enrichment**: Ranking and enrichment are split to control AI cost and rate limits.
- **Circuit breaker**: Provider failures pause AI work instead of repeatedly failing.
- **Canonical article storage**: URL hashes and title similarity reduce duplicate stories.
- **Event-store expansion**: The project can evolve from article cards into persistent event intelligence.
- **External scheduler support**: Expensive work can run from Cloud Command or worker processes.

## 19. Environment Variables

Important backend environment variables:

- `DATABASE_URL`
- `REDIS_URL`
- `GATEWAY_SECRET`
- `GATEWAY_BASE_URL`
- `HF_SPACE_URL`
- `GEMINI_EMBEDDING_URL`
- `NEWSINTEL_CATEGORIES`
- `NEWSINTEL_ARTICLES_PER_CATEGORY`
- `NEWSINTEL_INGEST_INTERVAL_MINUTES`
- `NEWSINTEL_RANK_TOP_N`
- `NEWSINTEL_ENRICH_BATCH_SIZE`
- `NEWSINTEL_RETENTION_DAYS`
- `NEWSINTEL_OPENROUTER_MODEL`
- `NEWSINTEL_OPENROUTER_MODELS`
- `AI_CIRCUIT_BREAKER_COOLDOWN_MINUTES`
- feature flags such as `ENABLE_PERSONALIZATION`, `ENABLE_ALERTS`, `ENABLE_DIGESTS`

Important frontend environment variable:

- `VITE_API_URL`

## 20. Summary

News Intel is no longer just a simple news scraper. It is a full news intelligence system with ingestion, deduplication, AI ranking, queued enrichment, persistent database storage, cached dashboard snapshots, frontend integration, personalization-ready data models, alert/digest support, and an event-store architecture for deeper future intelligence features.

