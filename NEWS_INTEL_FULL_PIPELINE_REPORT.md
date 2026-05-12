# News Intel Full Technical Report

Date: 2026-05-12

Project path: `A:\projects\News-Intel`

## Two-Member Equal Division

Use this split if two members need to present or submit the report equally. The division is balanced by explanation workload, not only by section count, because some sections are much bigger than others.

### Member 1: Backend, Data Pipeline, Database, API Control

Member 1 should explain these sections:

```text
1. Executive Summary
2. What Problem News Intel Solves
3. High-Level Architecture
4. Main Runtime Flow
5. Backend Structure
6. Frontend Structure
7. News Fetching
8. Normalization and Deduplication
9. Database Design
10. Full Event-Store Tables
11. AI Ranking
12. AI Enrichment
13. Home Snapshot
14. AI Provider Routing
15. Circuit Breaker
20.1 Backend Libraries
30. Caching
31. Locks
32. Configuration
35. Testing
36. Security Notes
42. Final Architecture Diagram
```

Member 1's main speaking responsibility:

- Explain how news enters the system.
- Explain how RSS fetching works.
- Explain how duplicate articles are removed.
- Explain how articles, stories, metrics, and snapshots are stored.
- Explain how AI ranking and enrichment are controlled by the backend.
- Explain how the API avoids repeated expensive work using caching and locks.
- Explain backend libraries such as FastAPI, Uvicorn, httpx, SQLAlchemy, Alembic, Redis, APScheduler, feedparser, and pytest.
- Explain the final architecture diagram from backend point of view.

Short presentation opening for Member 1:

```text
I will explain the backend and data pipeline of News Intel. My part covers how real news is fetched from Google News RSS, cleaned, deduplicated, stored in the database, ranked by AI, enriched, cached, and finally converted into a fast dashboard snapshot for the frontend.
```

### Member 2: NLP, Models, Frontend, User Features, Deployment

Member 2 should explain these sections:

```text
16. Where NLP Is Used
17. Hugging Face Space
18. Why We Use Models and APIs
19. Why We Are Not Training Large Models Ourselves
20.2 Hugging Face Space Libraries
20.3 Frontend Libraries
21. Frontend User Experience
22. Personalization
23. Alerts and Digests
24. Semantic Clustering
25. Embedding Strategy
26. Custom Signal Rank Model
27. Ask News Intel
28. Scenario Simulator
29. Map and Orbit Views
33. CORS
34. Deployment
37. Current Strengths
38. Current Limitations
39. Why This Architecture Is Good for an MVP
40. Recommended Future Improvements
41. Simple Explanation for Presentation
43. One-Line Conclusion
```

Member 2's main speaking responsibility:

- Explain where NLP is used in the project.
- Explain summarization, sentiment analysis, named entity recognition, embeddings, ranking, and enrichment.
- Explain why pretrained models and APIs are used instead of training large models from scratch.
- Explain the Hugging Face Space and its models.
- Explain frontend libraries such as React, Vite, Firebase, React Router, Lucide React, Three.js, d3-geo, and TopoJSON.
- Explain user-facing features such as personalization, alerts, digests, ask mode, simulator, map, and orbit.
- Explain deployment, strengths, limitations, and future improvements.
- Close the presentation with the simple explanation and final conclusion.

Short presentation opening for Member 2:

```text
I will explain the intelligence and user experience part of News Intel. My part covers where NLP is used, which models and APIs power the analysis, why we use pretrained models instead of training our own large model, how the React frontend works, and how advanced features like personalization, alerts, map, orbit, and simulation are designed.
```

### Equal Split Summary

```text
Member 1 = backend pipeline + database + API control + backend libraries + testing/security
Member 2 = NLP/models + Hugging Face + frontend + user features + deployment/future scope
```

Both members should understand the whole project, but during presentation Member 1 should lead the technical backend flow and Member 2 should lead the AI/NLP plus frontend/user-experience flow.

## 1. Executive Summary

News Intel is an AI-powered news intelligence platform. It collects real news from Google News RSS, cleans and normalizes articles, removes duplicates, ranks important stories with AI, enriches selected stories into intelligence cards, stores the output in a database, and serves a fast dashboard to the frontend.

The system is not just a normal news website. A normal news website mostly displays headlines. News Intel tries to convert headlines into decision signals:

- What happened?
- Why does it matter?
- Which category does it belong to?
- Which entities are involved?
- Is it high-risk, high-opportunity, or neutral?
- How intense is the signal?
- Which stories should appear first?
- What changed compared with earlier data?

The current public dashboard is mainly powered by the controlled MVP pipeline in:

```text
backend/app/services/mvp_pipeline.py
```

The repository also contains a larger production/event-store architecture in:

```text
backend/app/services/ingestion_pipeline.py
backend/app/repositories/ingestion.py
backend/app/services/event_enrichment.py
backend/app/services/semantic_clustering.py
```

That richer layer is designed for long-term event clustering, event relationships, personalization, alerts, digests, maps, orbit graph views, and scenario simulation.

## 2. What Problem News Intel Solves

News is noisy. Many sources report the same story, headlines are duplicated, and raw news feeds do not explain what is important for a user.

News Intel solves this by building a pipeline:

```text
Raw RSS news
  -> normalized articles
  -> deduplicated articles
  -> AI-ranked stories
  -> AI-enriched story cards
  -> stored dashboard snapshot
  -> React intelligence dashboard
```

The main idea is to make the frontend fast. Users should not wait for RSS fetching and AI calls every time they open the dashboard. Instead, ingestion runs in the backend, stores results, and the dashboard reads from cached database snapshots.

## 3. High-Level Architecture

News Intel has four main parts:

1. Frontend

React/Vite single-page application. It handles login, dashboard views, map, orbit, simulator, alerts, settings, watchlist, and user interactions.

2. Backend API

FastAPI application. It exposes endpoints such as:

```text
/api/home-snapshot
/api/feed
/api/story/{story_id}
/api/ask
/api/dashboard
/api/admin/ingest-now
/api/admin/enrich-batch
/api/orbit
/api/map-signals
/api/simulate
```

3. Data layer

PostgreSQL is the main database. SQLAlchemy models define articles, stories, events, metrics, alerts, preferences, digests, scenario runs, and ingestion locks. Redis is optional for distributed cache and locks.

4. AI/NLP layer

The project uses external AI APIs and hosted models instead of training large models locally. It uses:

- OpenRouter through the Cloud Command Gateway for ranking and enrichment.
- Gemini through the Cloud Command Gateway as fallback and embeddings provider.
- Hugging Face Space for summarization, sentiment, NER, and embeddings in the legacy/full-intelligence path.
- A small local custom signal-rank model for lightweight scoring.

## 4. Main Runtime Flow

The current MVP dashboard flow is:

```text
1. Scheduler/admin trigger starts ingestion.
2. Backend fetches Google News RSS for controlled categories.
3. RSS items become CandidateArticle objects.
4. URLs and titles are normalized.
5. Duplicate articles are skipped.
6. Clean articles are saved to PostgreSQL.
7. AI ranks articles by importance.
8. Top stories are added to an enrichment queue.
9. AI enriches queued stories.
10. Story rows and event metric rows are saved.
11. Home snapshot is rebuilt.
12. Frontend calls /api/home-snapshot.
13. React renders dashboard, pulse, feed, map, and story details.
```

The frontend does not directly call RSS or model providers. It calls the backend. This is important because API keys, gateway secrets, deduplication, caching, and database writes must stay server-side.

## 5. Backend Structure

Important backend files:

```text
backend/main.py
backend/app/main_prod.py
backend/news_fetcher.py
backend/hf_client.py
backend/app/core/config.py
backend/app/core/database.py
backend/app/core/cache.py
backend/app/models/news.py
backend/app/services/mvp_pipeline.py
backend/app/services/ingestion_pipeline.py
backend/app/services/event_enrichment.py
backend/app/services/semantic_embeddings.py
backend/app/services/semantic_clustering.py
backend/app/services/dashboard_read_model.py
backend/app/services/snapshot_read_models.py
backend/app/services/scenario_simulator.py
backend/app/services/alert_engine.py
backend/app/services/digest_engine.py
backend/app/workers/ingestion_worker.py
```

`backend/main.py` is the main active API entry point used by the current deployment. It includes the MVP dashboard endpoints and many user-facing endpoints.

`backend/app/main_prod.py` is a smaller v2 production API. It includes `/api/v2/events`, `/api/v2/articles/{article_id}`, `/api/v2/dashboard-compatible`, and `/api/v2/orbit`.

`backend/news_fetcher.py` handles Google News RSS fetching.

`backend/hf_client.py` is the multi-provider AI client. It routes AI calls through the gateway to OpenRouter, Gemini, and the Hugging Face Space.

`backend/app/services/mvp_pipeline.py` is the controlled pipeline for the current dashboard.

`backend/app/models/news.py` defines the database schema.

## 6. Frontend Structure

Important frontend files:

```text
frontend/src/App.jsx
frontend/src/api.js
frontend/src/firebase.js
frontend/src/context/AuthContext.jsx
frontend/src/context/PersonalizationContext.jsx
frontend/src/pages/HomePage.jsx
frontend/src/pages/OrbitPage.jsx
frontend/src/pages/MapPage.jsx
frontend/src/pages/SimulatorPage.jsx
frontend/src/pages/StoryView.jsx
frontend/src/pages/StoriesPage.jsx
frontend/src/pages/WatchlistPage.jsx
frontend/src/pages/AlertsPage.jsx
frontend/src/pages/Settings.jsx
frontend/src/components/worldpulse/*
```

The frontend is a React app using React Router. The main user experience is a "World Pulse" style intelligence dashboard. It uses a protected login flow through Firebase Google login.

`frontend/src/api.js` centralizes backend calls. It attaches:

```text
X-User-Id
X-User-Email
```

when a Firebase user is logged in. These headers allow the backend to personalize data and recover preferences.

## 7. News Fetching

News fetching happens in:

```text
backend/news_fetcher.py
```

The project uses Google News RSS because:

- It is free.
- It does not require a news API key.
- It gives real current news.
- It returns structured RSS data.
- It can be searched by query.

For the MVP pipeline, controlled categories are:

```text
tech
education
entertainment
politics
```

Each category maps to a Google News search query:

```text
tech: global technology AI startups cybersecurity semiconductors
education: global education universities students exams online learning
entertainment: global entertainment movies music celebrities streaming
politics: global politics elections government diplomacy policy
```

The fetcher builds URLs like:

```text
https://news.google.com/rss/search?q=<query>&hl=en&gl=US&ceid=US:en
```

It adds `when:1d` to bias results toward fresh news from the last 24 hours.

Important steps:

- Uses `httpx.AsyncClient` to download RSS feeds.
- Uses `feedparser` to parse RSS.
- Extracts title, source, summary, link, published date.
- Decodes Google News redirect URLs using `googlenewsdecoder`.
- Normalizes publisher URLs using `normalize_url`.
- Caches RSS results briefly in memory to avoid repeated calls.

The output is a list of article dictionaries:

```json
{
  "title": "...",
  "text": "...",
  "source": "...",
  "url": "...",
  "google_news_url": "...",
  "published": "...",
  "category": "...",
  "rss_query": "..."
}
```

## 8. Normalization and Deduplication

Normalization and deduplication are important because RSS feeds often contain:

- repeated headlines,
- syndication copies,
- Google redirect URLs,
- tracking parameters,
- slightly different versions of the same title.

The MVP pipeline converts raw RSS items into `CandidateArticle` objects.

Each candidate contains:

```text
title
description
url
canonical_url
source
published_at
category
rss_query
content_hash
```

Deduplication happens in:

```text
MVPNewsPipeline.store_deduped_articles()
```

It checks:

- Duplicate canonical URLs inside the same run.
- Very similar titles inside the same run.
- Existing article with the same URL hash in the database.
- Similar recent articles inside the retention window.

Title similarity uses Python's `difflib.SequenceMatcher` after title normalization. The default title similarity threshold is:

```text
0.86
```

URL hashes use SHA-256. This makes database lookup efficient and avoids indexing huge URLs directly.

## 9. Database Design

The database models are in:

```text
backend/app/models/news.py
```

The project uses SQLAlchemy async ORM with PostgreSQL.

Important MVP tables:

### articles

Stores canonical deduplicated articles.

Important columns:

```text
id
url
canonical_url
url_hash
title
normalized_title
title_hash
source
published_at
first_seen_at
last_seen_at
content_hash
category
rss_query
text_preview
embedding_json
```

### news_cycles

Stores one ingestion cycle.

It records:

```text
started_at
finished_at
status
fetched_count
deduped_count
ranked_count
enriched_count
error_message
```

### ranked_stories

Stores AI ranking output for a cycle.

It records:

```text
cycle_id
article_id
rank_position
ai_score
ai_reason
importance_level
selected_for_enrichment
```

### enrichment_queue

Stores articles waiting for AI enrichment.

It records:

```text
article_id
cycle_id
status
attempts
next_attempt_at
locked_at
error_message
```

Statuses include:

```text
PENDING
RUNNING
DONE
FAILED
SKIPPED
```

### stories

Stores final user-facing intelligence cards.

Important fields:

```text
display_title
summary
why_it_matters
entities_json
sentiment
pulse_score
exposure_score
importance_level
risk_level
source_url
source_name
published_at
enriched_at
```

### event_metrics

Stores time-series scores for pulse and exposure.

### home_snapshots

Stores the cached dashboard payload served by `/api/home-snapshot`.

### ingestion_locks

Prevents duplicate ingestion/enrichment jobs and stores AI circuit breaker state.

## 10. Full Event-Store Tables

The repo also has a more advanced event-store design.

Important tables:

### raw_articles

Stores raw source snapshots before normalization. This is useful for auditability.

### events

Represents real-world story clusters.

### event_articles

Many-to-many link between events and articles.

### event_relationships

AI-validated relationships between events.

### event_relationship_checks

Caches checked event pairs so the system does not repeatedly ask AI about the same relationship.

### users and preferences

Store personalization data.

### alerts and alert_rules

Store user alerts and alert logic.

### daily_digests and digest_delivery_logs

Store generated daily summaries and delivery status.

### scenario_runs

Stores scenario simulation outputs.

## 11. AI Ranking

Ranking is done in:

```text
MVPNewsPipeline.rank_articles()
```

The system sends compact article metadata to AI:

```text
i: article index
t: title
d: description
s: source
c: category
p: published date
```

The AI is asked to rank by:

- importance,
- freshness,
- public impact,
- credibility,
- category balance,
- newsworthiness,
- long-term relevance.

The required AI output is strict JSON:

```json
{
  "ranked": [
    {
      "article_index": 0,
      "rank": 1,
      "score": 90,
      "reason": "major public impact",
      "importance": "HIGH"
    }
  ]
}
```

The backend validates the result:

- Article index must exist.
- Duplicate indexes are ignored.
- Score is clamped between 0 and 100.
- Importance is normalized.
- Results are saved to `ranked_stories`.

Only top-ranked articles are sent to the enrichment queue.

## 12. AI Enrichment

Enrichment happens in:

```text
MVPNewsPipeline.enrich_batch()
MVPNewsPipeline.enrich_one()
```

Each queued article is sent to AI with a strict instruction:

- Do not invent facts.
- Use only article metadata.
- Return minified strict JSON.
- Keep fields short.

The required shape is:

```json
{
  "display_title": "",
  "summary": "",
  "why_it_matters": "",
  "entities": [],
  "sentiment": "positive/neutral/negative/mixed",
  "pulse_score": 0,
  "exposure_score": 0,
  "importance_level": "HIGH/MEDIUM/LOW",
  "risk_level": "LOW/MEDIUM/HIGH"
}
```

The enriched result is saved into the `stories` table. A matching row is also added to `event_metrics`.

This is where raw news becomes an intelligence card.

## 13. Home Snapshot

The dashboard reads from snapshots, not live RSS.

Snapshot generation happens in:

```text
MVPNewsPipeline.rebuild_home_snapshot()
```

It creates:

```text
topStories
feed
categories
pulse
exposure
graph
map
simulatorContext
clusters
articles
daily_delta
pulse_history
world_pulse
quick_glance
pipeline_status
next_refresh_at
```

Then it stores the payload in `home_snapshots`.

The frontend reads it through:

```text
GET /api/home-snapshot
```

This design makes the app faster and more reliable because AI calls are moved away from the normal page-load path.

## 14. AI Provider Routing

AI calls are centralized in:

```text
backend/hf_client.py
```

The provider order is:

1. OpenRouter through Cloud Command Gateway.
2. Gemini through Cloud Command Gateway.
3. Hugging Face Space for specialized NLP tasks.

Important environment variables:

```text
GATEWAY_BASE_URL
GATEWAY_SECRET
HF_SPACE_URL
GEMINI_EMBEDDING_MODEL
NEWSINTEL_OPENROUTER_MODEL
NEWSINTEL_OPENROUTER_MODELS
```

The gateway is useful because the backend can call one controlled gateway instead of exposing provider API keys directly. It also makes it easier to switch providers.

## 15. Circuit Breaker

AI APIs can fail because of:

- quota limits,
- rate limits,
- temporary provider downtime,
- model token budget problems,
- empty responses,
- billing or credit errors.

The MVP pipeline has an AI circuit breaker.

If provider errors look like quota or throttle problems, the system stores a lock named:

```text
ai_circuit_breaker
```

in the `ingestion_locks` table.

While the circuit is open:

- Ranking can be deferred.
- Enrichment can be deferred.
- The system avoids repeatedly calling failing providers.

This protects the app from wasting requests and keeps failures controlled.

## 16. Where NLP Is Used

NLP means Natural Language Processing: using algorithms or models to understand text.

News Intel uses NLP in these places:

### 1. Summarization

Used in the Hugging Face Space.

Model:

```text
sshleifer/distilbart-cnn-12-6
```

Purpose:

- Condense long article text into shorter summaries.
- Help users understand stories quickly.

### 2. Sentiment Analysis

Used in the Hugging Face Space and deep-dive paths.

Model:

```text
cardiffnlp/twitter-roberta-base-sentiment-latest
```

Purpose:

- Detect whether a story is positive, neutral, negative, or mixed.
- Feed risk/opportunity presentation.
- Help calculate signal intensity.

### 3. Named Entity Recognition

Used in the Hugging Face Space and deep-dive paths.

Model:

```text
dslim/bert-base-NER
```

Purpose:

- Extract people, organizations, places, and other named entities.
- Support entity chips in the UI.
- Support tracked entities and personalization.

### 4. Embeddings

Used in semantic clustering.

Models/providers:

```text
sentence-transformers/all-MiniLM-L6-v2
Gemini embeddings
local hash embedding fallback
```

Purpose:

- Convert text into vectors.
- Compare article/event similarity.
- Decide whether two stories are about the same event.

### 5. LLM Ranking

Used in the MVP pipeline.

Purpose:

- Rank news stories by importance and impact.

### 6. LLM Enrichment

Used in the MVP pipeline and event enrichment service.

Purpose:

- Generate summaries.
- Explain why a story matters.
- Identify risk/opportunity.
- Create story graph metadata.
- Produce pulse and exposure reasoning.

### 7. Scenario Simulation

Used in:

```text
backend/app/services/scenario_simulator.py
```

Purpose:

- Analyze user-provided scenarios against current events.
- This is analysis, not prediction.

## 17. Hugging Face Space

The Hugging Face Space is in:

```text
hf_space/app.py
```

It uses Gradio to expose model-backed functions:

```text
summarize
analyze_sentiment
extract_entities
embed
health_check
```

Models loaded:

```text
sshleifer/distilbart-cnn-12-6
cardiffnlp/twitter-roberta-base-sentiment-latest
dslim/bert-base-NER
sentence-transformers/all-MiniLM-L6-v2
```

The backend calls this Space through the Cloud Command Gateway using:

```text
backend/hf_client.py
```

Why host these models separately?

- Keeps the main backend lighter.
- Avoids loading large NLP models into the FastAPI process.
- Reduces memory pressure on Render/backend deployment.
- Lets the Hugging Face Space specialize in NLP inference.
- Makes it easier to upgrade or replace NLP models independently.

## 18. Why We Use Models and APIs

News Intel uses models and APIs because news intelligence requires language understanding.

Rules alone can fetch headlines and deduplicate text, but rules cannot reliably:

- summarize complex stories,
- identify why something matters,
- compare risk and opportunity,
- rank mixed-topic news by importance,
- extract meaningful entities from messy text,
- validate ambiguous event clusters,
- answer natural-language questions about news.

Models provide this language understanding.

APIs are used because:

- Large models are expensive to host locally.
- Hosted models are faster to integrate.
- They remove GPU infrastructure requirements.
- They allow fallback between providers.
- They make the project practical for a student/demo/MVP deployment.

## 19. Why We Are Not Training Large Models Ourselves

The project does not train large NLP models from scratch because that would be inefficient and unnecessary for the current stage.

Training custom summarization, sentiment, NER, embedding, or LLM models would require:

- a large labeled dataset,
- data cleaning and annotation,
- GPUs,
- model training infrastructure,
- evaluation pipelines,
- ongoing retraining,
- safety testing,
- deployment infrastructure,
- monitoring for drift and hallucination.

For this project, the better engineering choice is to use pretrained models and APIs.

Reasons:

### 1. News changes every minute

The hard part is not teaching a model English from scratch. The hard part is fetching fresh news, deduplicating it, ranking it, enriching it, and serving it reliably.

### 2. Pretrained models already understand language

Models like BART, RoBERTa, BERT, Gemini, and OpenRouter-hosted LLMs already understand general language. We use them as building blocks.

### 3. Training data is not available at scale

To train a good news intelligence model, we would need many examples of:

- raw articles,
- correct summaries,
- correct importance rankings,
- correct risk levels,
- correct event clusters,
- correct entity labels,
- user feedback.

The current project does not have enough labeled data for that.

### 4. Training from scratch would cost more than the whole MVP

Large-model training needs expensive GPUs. The project is designed to run with normal web deployment tools.

### 5. APIs let us move faster

The project can focus on product logic:

- ingestion,
- dedupe,
- scoring,
- UI,
- personalization,
- alerts,
- snapshots,
- monitoring.

### 6. The project still has a small trainable model

There is a local custom model in:

```text
backend/app/services/custom_signal_rank.py
```

It is a tiny MLP-like signal ranker. It uses deterministic seed weights and can be trained from News Intel data through the admin endpoint:

```text
POST /api/admin/train-signal-rank
```

This is the correct scale of custom training for the project right now: small, explainable, cheap, and based on local features.

## 20. Library and Dependency Report

This section explains every important library and why it is used.

## 20.1 Backend Libraries

### fastapi

Used for the backend REST API.

Why:

- Fast async API framework.
- Easy route definitions.
- Good Pydantic integration.
- Suitable for JSON APIs.

Where:

```text
backend/main.py
backend/app/main_prod.py
backend/app/api/routes.py
```

### uvicorn

Used to run FastAPI as an ASGI server.

Why:

- Fast production-compatible Python web server.
- Standard deployment choice for FastAPI.

Where:

```text
backend/Dockerfile
README.md
```

### httpx

Used for async HTTP requests.

Why:

- Fetches Google News RSS.
- Calls OpenRouter, Gemini, and Hugging Face gateway endpoints.
- Supports async execution.

Where:

```text
backend/news_fetcher.py
backend/hf_client.py
```

### python-dotenv

Loads environment variables from `.env`.

Why:

- Keeps secrets and configuration outside code.
- Useful in local development.

Where:

```text
backend/hf_client.py
```

### pydantic-settings

Defines typed environment settings.

Why:

- Centralizes config.
- Converts env values to Python types.
- Gives defaults for local development.

Where:

```text
backend/app/core/config.py
```

### databases

Used by the older/simple `db.py` layer.

Why:

- Async database access for legacy endpoints and user preference storage.

Where:

```text
backend/db.py
backend/main.py
```

### aiosqlite

Async SQLite driver.

Why:

- Supports local/dev async database usage in older code paths.

### sqlalchemy

Main ORM for production database models.

Why:

- Defines database models.
- Supports async PostgreSQL sessions.
- Handles SQL queries safely.

Where:

```text
backend/app/models/news.py
backend/app/core/database.py
backend/app/services/*
```

### alembic

Database migration tool.

Why:

- Tracks schema changes.
- Creates and upgrades production database tables.

Where:

```text
backend/alembic.ini
backend/alembic/versions/*
```

### feedparser

Parses RSS feeds.

Why:

- Google News returns RSS XML.
- `feedparser` converts XML into Python entries.

Where:

```text
backend/news_fetcher.py
```

### newspaper3k

Article extraction library.

Why:

- Intended for extracting article text from publisher pages.
- Included for fuller article extraction, although current MVP mostly uses RSS summaries and simple paragraph extraction.

Where:

```text
backend/requirements.txt
backend/Dockerfile
```

### cachetools

In-memory caching helper.

Why:

- Helps avoid repeated expensive work.
- Current code also uses custom in-memory dictionaries and Redis cache.

### lxml_html_clean

HTML cleaning support required by article extraction libraries.

Why:

- `newspaper3k` and HTML parsing often need lxml cleaning support.

### googlenewsdecoder

Decodes Google News redirect links.

Why:

- Google News RSS often gives Google wrapper URLs.
- The platform wants real publisher URLs.

Where:

```text
backend/news_fetcher.py
```

### asyncpg

Async PostgreSQL driver for SQLAlchemy.

Why:

- Production database access.
- Works with SQLAlchemy async engine.

Where:

```text
backend/app/core/database.py
```

### psycopg2-binary

PostgreSQL driver.

Why:

- Useful for sync tooling and compatibility.
- Alembic or external tools may use it.

### apscheduler

Background scheduler.

Why:

- Runs external ingestion worker jobs on intervals.

Where:

```text
backend/app/workers/ingestion_worker.py
```

### redis

Redis client.

Why:

- Distributed cache.
- Distributed locks.
- Avoids duplicate ingestion jobs across processes.

Where:

```text
backend/app/core/cache.py
backend/app/workers/ingestion_worker.py
```

### pytest

Testing framework.

Why:

- Tests MVP pipeline behavior, deduplication, AI fallback handling, snapshot map/orbit logic, and circuit breaker detection.

Where:

```text
backend/tests/test_mvp_pipeline.py
```

## 20.2 Hugging Face Space Libraries

### transformers

Loads pretrained NLP pipelines.

Why:

- Summarization.
- Sentiment analysis.
- Named entity recognition.

Where:

```text
hf_space/app.py
```

### torch

Deep learning runtime for Hugging Face models.

Why:

- Required to run transformer models.

### gradio

Creates a simple hosted UI/API for the Hugging Face Space.

Why:

- Easy deployment for model inference.
- Provides tabs for summarization, sentiment, NER, embeddings, and health check.

### sentencepiece

Tokenizer dependency for some transformer models.

Why:

- Needed by models that use SentencePiece tokenization.

### sentence-transformers

Creates semantic embeddings.

Why:

- Converts text to vectors for similarity and clustering.

Where:

```text
hf_space/app.py
backend/app/services/semantic_embeddings.py
```

## 20.3 Frontend Libraries

### react

Main UI library.

Why:

- Component-based UI.
- State-driven rendering.
- Strong ecosystem.

Where:

```text
frontend/src/*
```

### react-dom

Renders React into the browser DOM.

Why:

- Required for browser React apps.

Where:

```text
frontend/src/main.jsx
```

### vite

Frontend build tool and dev server.

Why:

- Fast local development.
- Simple production build.

Where:

```text
frontend/vite.config.js
frontend/package.json
```

### @vitejs/plugin-react

React integration for Vite.

Why:

- Enables React JSX and fast refresh.

### react-router-dom

Client-side routing.

Why:

- Supports pages like dashboard, orbit, map, simulator, story, alerts, settings.

Where:

```text
frontend/src/App.jsx
```

### firebase

Authentication and analytics.

Why:

- Google sign-in.
- User identity.
- Frontend sends Firebase UID/email to backend.

Where:

```text
frontend/src/firebase.js
frontend/src/context/AuthContext.jsx
```

### axios

HTTP client library.

Why:

- Installed dependency. Current `frontend/src/api.js` mostly uses native `fetch`, so axios is not central in the current API client.

### lucide-react

Icon library.

Why:

- Clean UI icons for navigation, buttons, status, alerts, search, etc.

Where:

```text
frontend/src/App.jsx
frontend/src/pages/*
frontend/src/components/*
```

### three

3D rendering library.

Why:

- Supports animated/3D dashboard visuals.

Where:

```text
frontend/src/components/ThreeBackground.jsx
```

### @react-three/fiber

React renderer for Three.js.

Why:

- Lets the project write Three.js scenes as React components.

### @react-three/drei

Helper components for React Three Fiber.

Why:

- Simplifies common 3D scene patterns.

### d3-geo

Geographic projection library.

Why:

- Used for world/map visualization.

### topojson-client

TopoJSON conversion helper.

Why:

- Supports geographic map rendering with compact topology data.

### eslint and plugins

Static code checking.

Why:

- Finds common JS/React errors.
- Keeps frontend code quality stable.

## 21. Frontend User Experience

The frontend is built around a protected dashboard. The user logs in with Google, then sees:

- world pulse,
- quick glance stats,
- top shifts,
- category movement,
- transparent pipeline status,
- detailed story drawer,
- orbit view,
- map view,
- simulator,
- watchlist,
- alerts,
- settings.

The main dashboard page is:

```text
frontend/src/pages/HomePage.jsx
```

It reads backend data through:

```text
api.getPersonalizedDashboard()
api.getCachedDashboard()
```

The raw backend payload is normalized by:

```text
frontend/src/lib/dashboardAdapter.js
```

Frontend state is split into:

- authentication state in `AuthContext`,
- personalization/watchlist/local interaction state in `PersonalizationContext`,
- app-level dashboard cache and UI mode in `AppContext`.

## 22. Personalization

The project supports personalization in two layers:

1. Frontend/local personalization

Stored in local storage:

```text
ni_saved_signals
ni_tracked_signals
ni_dismissed_signals
ni_signal_engagement
ni_previous_pulse
```

2. Backend/user personalization

Stored through API endpoints:

```text
/api/user/preferences
/api/watchlist
/api/saved-threads
/api/entities
/api/dismissed-signals
/api/interactions
```

Feature flags decide whether some backend features are active:

```text
ENABLE_PERSONALIZATION
ENABLE_WATCHLIST
ENABLE_ALERTS
ENABLE_DIGESTS
ENABLE_COUNTRY_FILTERS
```

In the current MVP environment, several features can return `disabled_mvp` if flags are off.

## 23. Alerts and Digests

Alerts use:

```text
backend/app/services/alert_engine.py
```

Digest generation uses:

```text
backend/app/services/digest_engine.py
```

Database tables:

```text
alerts
alert_rules
daily_digests
digest_delivery_logs
```

These systems are designed to alert users about high-impact signals and generate daily summaries. They are feature-flagged, so they can be disabled in MVP mode.

## 24. Semantic Clustering

Semantic clustering exists in the production event-store path.

Important files:

```text
backend/app/services/semantic_embeddings.py
backend/app/services/semantic_clustering.py
backend/app/services/event_clustering.py
```

The goal is to decide whether two articles describe the same real-world event.

The system uses:

- lexical rules,
- title similarity,
- country/company/date conflict checks,
- embeddings,
- cosine similarity,
- LLM validation for ambiguous pairs.

Thresholds:

```text
MERGE_THRESHOLD = 0.86
AMBIGUOUS_THRESHOLD = 0.72
```

If similarity is very high, it merges. If similarity is low, it rejects. If similarity is ambiguous, it asks an LLM to validate whether two items describe the same event.

## 25. Embedding Strategy

Embeddings are created in:

```text
backend/app/services/semantic_embeddings.py
```

Provider order:

1. Hugging Face embedding endpoint.
2. Gemini embedding endpoint.
3. Local hash fallback.

The local fallback is:

```text
newsintel-local-hash-embedding-v1
```

It is not a true neural embedding model. It is a deterministic hash-vector fallback. Its purpose is resilience: semantic code can still run even if external embedding providers are unavailable.

This is good engineering because the system does not completely fail when embeddings APIs fail.

## 26. Custom Signal Rank Model

The project includes a small local trainable ranker:

```text
backend/app/services/custom_signal_rank.py
```

Model version:

```text
newsintel-signalrank-mlp-v1
```

It uses features such as:

```text
source_count
confidence
freshness_6h
freshness_24h
velocity
high_risk
medium_risk
high_opportunity
medium_opportunity
negative_or_mixed
entity_density
urgency_terms
technology_topic
politics_topic
education_topic
entertainment_topic
```

This model is small and explainable. It is not a replacement for the LLM. It is used to add a lightweight local ML signal score.

Why this kind of training makes sense:

- It is cheap.
- It uses project-specific data.
- It can improve ranking over time.
- It does not require GPUs.
- It is easier to debug than a large model.

Why it does not replace external LLMs:

- It cannot summarize articles.
- It cannot answer open-ended questions.
- It cannot extract nuanced reasoning.
- It cannot understand arbitrary new topics as well as a large pretrained model.

## 27. Ask News Intel

The `/api/ask` endpoint lets the user ask a natural-language question.

Flow:

1. Search stored stories/articles for relevant sources.
2. Optionally fetch fresh Google News search sources.
3. Deduplicate sources.
4. Ask AI to answer using only supplied sources.
5. Return answer and sources.

This is useful because users can ask questions like:

```text
What is happening in AI regulation today?
```

The backend should answer from real news sources, not invent unsupported facts.

## 28. Scenario Simulator

The simulator endpoint is:

```text
POST /api/simulate
```

It uses:

```text
backend/app/services/scenario_simulator.py
```

Purpose:

- Analyze a hypothetical scenario.
- Use current event context when available.
- Store the run in `scenario_runs`.

Important: scenario output is analysis, not a guaranteed prediction.

## 29. Map and Orbit Views

Map/orbit snapshot read models are built in:

```text
backend/app/services/snapshot_read_models.py
```

The map view extracts locations from story cards and entities.

The orbit view builds graph-like nodes and edges from snapshot stories.

These are visualization layers on top of the same underlying intelligence snapshot.

## 30. Caching

Caching is used at multiple levels:

### RSS cache

In `backend/news_fetcher.py`, `_news_cache` stores recent RSS results briefly.

Why:

- Avoids hammering Google News.
- Speeds repeated requests.

### AI cache

In `backend/hf_client.py`, `_cache` stores AI outputs for a short TTL.

Why:

- Avoids repeated model calls for the same prompt.
- Reduces cost and latency.

### Read cache

In `backend/app/core/cache.py`, Redis or local fallback caches JSON payloads.

Why:

- Speeds dashboard reads.
- Allows distributed cache if Redis is configured.

### Frontend cache

The frontend stores recent dashboard data in session storage/local storage.

Why:

- Makes UI feel faster.
- Helps during refreshes or temporary network issues.

## 31. Locks

The project uses locks to prevent duplicate work.

MVP pipeline locks:

```text
mvp_ingestion
mvp_enrichment
ai_circuit_breaker
```

Worker locks:

```text
ingestion-lock:<hash>
```

Locks are important because multiple scheduler/admin requests should not create duplicate ingestion runs or process the same enrichment queue at the same time.

## 32. Configuration

Main config file:

```text
backend/app/core/config.py
```

Important environment variables:

```text
DATABASE_URL
REDIS_URL
GATEWAY_BASE_URL
GATEWAY_SECRET
HF_SPACE_URL
GEMINI_EMBEDDING_MODEL
ADMIN_SECRET
INGEST_SECRET
CORS_ALLOWED_ORIGINS
DASHBOARD_CACHE_TTL_SECONDS
NEWSINTEL_CATEGORIES
NEWSINTEL_ARTICLES_PER_CATEGORY
NEWSINTEL_INGEST_INTERVAL_MINUTES
NEWSINTEL_RANK_TOP_N
NEWSINTEL_ENRICH_BATCH_SIZE
NEWSINTEL_RETENTION_DAYS
NEWSINTEL_AI_RANK_MAX_TOKENS
NEWSINTEL_AI_ENRICH_MAX_TOKENS
NEWSINTEL_OPENROUTER_MODEL
NEWSINTEL_OPENROUTER_MODELS
AI_CIRCUIT_BREAKER_COOLDOWN_MINUTES
ENABLE_HEAVY_INGESTION
ENABLE_PERSONALIZATION
ENABLE_WATCHLIST
ENABLE_ALERTS
ENABLE_DIGESTS
ENABLE_COUNTRY_FILTERS
```

The `.env.example` file documents local setup.

## 33. CORS

CORS config is in:

```text
backend/app/core/cors.py
```

Allowed origins include localhost, the News Intel domain, Render, and matching subdomains for:

```text
yogender1.me
vercel.app
onrender.com
```

CORS is important because the frontend and backend may be hosted on different domains.

## 34. Deployment

Backend Dockerfile:

```text
backend/Dockerfile
```

It uses:

```text
python:3.11-slim
```

Installs system dependencies for XML/HTML parsing:

```text
gcc
libxml2-dev
libxslt-dev
```

Installs Python requirements, downloads NLTK `punkt_tab`, copies code, exposes port 8000, runs Alembic migrations, then starts Uvicorn:

```text
alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Frontend deployment config:

```text
frontend/vercel.json
```

It rewrites:

```text
/api/*
```

to the Render backend:

```text
https://newsintel-xvhe.onrender.com/api/*
```

This lets the Vercel frontend call `/api/...` while the actual backend runs on Render.

## 35. Testing

Tests are in:

```text
backend/tests/test_mvp_pipeline.py
```

They cover:

- 20-candidate fetch contract.
- Title similarity dedupe.
- Local signal rank scoring.
- AI ranking selecting top 15.
- AI circuit breaker deferral.
- Enrichment batch size.
- Ingestion lock skip shape.
- Snapshot payload shape.
- Orbit payload from snapshot cards.
- Map extraction from story cards.
- Country map events.
- Retention window.
- Quota detection.
- Temporary provider throttle detection.
- AI JSON cleanup.
- OpenRouter token-budget handling.
- OpenRouter fallback model chain.

These tests are important because the riskiest backend behavior is around AI provider failure and pipeline consistency.

## 36. Security Notes

Secrets should stay server-side:

```text
GATEWAY_SECRET
DATABASE_URL
REDIS_URL
ADMIN_SECRET
INGEST_SECRET
SMTP_PASSWORD
```

The frontend Firebase config is public-style client config. That is normal for Firebase web apps, but Firebase security rules and backend checks still matter.

Admin endpoints should be protected by `ADMIN_SECRET`.

Ingestion endpoints should be protected by `INGEST_SECRET`.

AI provider keys should not be exposed to the browser.

## 37. Current Strengths

News Intel already has strong architecture ideas:

- Real news ingestion from RSS.
- Deduplication before AI.
- Database-backed snapshots.
- External AI provider fallback.
- AI circuit breaker.
- Redis/local cache fallback.
- Hugging Face Space separation.
- Event-store schema for future scaling.
- Personalization-ready database.
- Alerts and digest-ready database.
- Map/orbit/simulator views.
- Tests for failure handling.

## 38. Current Limitations

Important limitations:

- Google News RSS is not a guaranteed enterprise data source.
- RSS summaries can be short or incomplete.
- Some frontend endpoints exist before all backend feature flags are enabled.
- AI output depends on external provider availability and quotas.
- The MVP pipeline enriches one article as one story, while the event-store pipeline is better for grouping many articles into the same event.
- The local hash embedding fallback is resilient but not as semantically strong as real embeddings.
- Some installed dependencies are not central in the active path.
- The README describes an older model stack and may not fully match the current MVP/event-store architecture.

## 39. Why This Architecture Is Good for an MVP

This architecture is practical because it separates concerns:

- RSS fetching handles raw data.
- Deduplication handles cleanliness.
- Database handles memory and continuity.
- AI handles language intelligence.
- Snapshots handle fast reads.
- React handles user experience.
- Feature flags control advanced features.

It avoids the biggest mistake in AI apps: making every page load wait for model calls.

## 40. Recommended Future Improvements

High-value future improvements:

1. Improve source quality scoring.

Add trust scores for sources and prioritize original reporting.

2. Add pgvector.

Store embeddings in PostgreSQL with vector indexes instead of JSON arrays.

3. Improve article extraction.

Use stronger article body extraction for sources where RSS summaries are weak.

4. Add better observability.

Track:

```text
RSS fetch failures
duplicate rate
AI parse failures
AI provider latency
cache hit rate
snapshot freshness
enrichment queue depth
```

5. Train the local signal-rank model from real user interactions.

Use saved, watched, dismissed, dwell time, and click signals to improve ranking.

6. Add source citation checks.

Make AI enrichment always trace back to article titles/source URLs.

7. Add dead-letter queue for failed enrichment.

Failed queue rows should be inspectable and replayable.

8. Strengthen admin authentication.

Use signed scheduler requests or service-to-service auth.

9. Separate MVP and event-store APIs clearly.

Document which endpoints are active, legacy, or experimental.

10. Update README.

The README should match the current architecture: MVP snapshot pipeline plus event-store expansion.

## 41. Simple Explanation for Presentation

News Intel is a news intelligence platform. It collects real news from Google News RSS, removes duplicate articles, uses AI to decide which stories are important, enriches them with summaries and risk/opportunity analysis, stores the result in PostgreSQL, and shows a fast interactive dashboard in React.

We use NLP for summarization, sentiment analysis, named entity recognition, embeddings, ranking, and story enrichment.

We use pretrained models and APIs because training large language models ourselves would require huge datasets, GPUs, money, and time. For an MVP, it is smarter to use proven models through APIs and focus on the product pipeline. The project still includes a small local trainable signal-rank model for custom scoring, which is the right size for project-specific training.

## 42. Final Architecture Diagram

```text
Frontend React App
  |
  | calls /api/*
  v
FastAPI Backend
  |
  | reads cached dashboard
  v
PostgreSQL home_snapshots
  ^
  |
MVP Pipeline
  |
  | fetches
  v
Google News RSS
  |
  | normalize + dedupe
  v
articles table
  |
  | AI rank
  v
ranked_stories + enrichment_queue
  |
  | AI enrich
  v
stories + event_metrics
  |
  | rebuild snapshot
  v
home_snapshots
```

Advanced path:

```text
RSS/articles
  -> raw_articles
  -> articles
  -> semantic clustering
  -> events
  -> event_articles
  -> event enrichment
  -> event relationships
  -> dashboard read model
  -> alerts/digests/orbit/map/simulator
```

## 43. One-Line Conclusion

News Intel uses a practical AI application architecture: real-time news ingestion, clean database-backed pipelines, pretrained NLP/LLM APIs for language intelligence, lightweight local ML for scoring, and a fast React dashboard built from cached intelligence snapshots.
