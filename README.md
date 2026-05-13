# NewsIntel

NewsIntel is a real-time news intelligence platform. It does not simply display headlines. It collects current news, cleans it, removes duplicates, ranks the strongest signals, enriches selected stories with AI, stores the result as a fast dashboard snapshot, and gives the frontend a ready-to-render intelligence view.

The product idea is simple: raw news is noisy, repeated, and hard to compare. NewsIntel turns that noise into structured signals:

- what happened
- why it matters
- which topic or region it belongs to
- which organizations, people, places, or products are involved
- how strong the pulse is
- whether the story is mostly risk, opportunity, neutral, or mixed
- what changed today compared with previous snapshots
- which stories deserve the top positions on the dashboard

The current public dashboard is driven by a controlled MVP pipeline. The repository also contains a larger event-store architecture for deeper clustering, map/orbit views, personalization, alerts, digests, and scenario simulation. Both follow the same philosophy: fetch real news, preserve traceability to sources, do expensive AI work in the backend, cache read models, and keep the frontend fast.

## High-Level Flow

```text
Google News RSS
  -> query generation by topic
  -> RSS parsing
  -> publisher URL decoding
  -> article normalization
  -> duplicate filtering
  -> database storage
  -> AI ranking
  -> enrichment queue
  -> AI story enrichment
  -> pulse/exposure metrics
  -> cached dashboard snapshot
  -> React dashboard
```

The frontend never calls RSS feeds or AI providers directly. It asks the backend for cached intelligence. That keeps API secrets private, prevents every page load from triggering model calls, and makes the dashboard much faster.

## Data Collection

NewsIntel uses Google News RSS as the live source layer. For each controlled topic, the backend builds search queries that bias toward current events. The core MVP topics are:

- tech
- education
- entertainment
- politics

Each topic maps to a richer query. For example, a broad topic such as `tech` becomes a search phrase around technology, AI, startups, cybersecurity, and semiconductors. This gives better coverage than searching only the word "tech".

RSS gives headline, source, summary, published time, and a Google News link. Google News links often point to a redirect wrapper, so NewsIntel attempts to decode them into the original publisher URL. That matters because the canonical publisher URL is used for deduplication, source display, and user trust.

## Normalization

Raw RSS entries are converted into structured candidate articles. Normalization makes later ranking and storage reliable.

The pipeline cleans each article by:

- trimming empty titles and URLs
- decoding HTML entities
- collapsing repeated whitespace
- truncating extremely long fields to predictable limits
- extracting or fallback-building a short text preview
- converting publish dates into timezone-aware UTC timestamps
- assigning a controlled category
- creating a canonical URL
- creating hashes for URL, title, and content

The important design choice is that the pipeline does not trust raw feed strings as stable identifiers. URLs can include tracking parameters, titles can contain source suffixes, and summaries can contain markup. Hashing normalized fields gives the database a safer way to detect repeated material.

## Filtering And Deduplication

News is highly repetitive. Many publishers syndicate or rewrite the same story, and RSS searches often return overlapping results. NewsIntel filters duplicates in several layers.

URL-level filtering:

- canonical URLs are normalized
- tracking noise is removed
- URL hashes are compared
- if the URL already exists, the existing row is updated instead of inserting a duplicate

Title-level filtering:

- titles are lowercased and normalized
- punctuation and unstable whitespace are removed
- title hashes are stored
- fuzzy similarity checks compare the new title against recently seen titles

In-run filtering:

- the same ingestion run keeps an in-memory set of URLs already accepted
- it also keeps recently accepted titles
- if a new candidate is too similar to something already accepted in the same run, it is skipped

Recent-history filtering:

- the database is queried for recent articles within the retention window
- new candidates are compared against the recent set
- a high title-similarity ratio is treated as a duplicate even if the URL differs

This is why the dashboard can show fewer, stronger stories instead of many versions of the same headline.

## Ranking

After deduplication, the pipeline asks an AI provider to rank the remaining articles. The prompt is intentionally strict: it sends compact article metadata and asks for strict minified JSON, not prose.

The ranking model considers:

- importance
- freshness
- public impact
- source credibility
- category balance
- newsworthiness
- long-term relevance

The output contains an article index, rank position, score, short reason, and importance label. The backend validates the JSON before trusting it:

- article indexes must point to real fetched articles
- the same article cannot be used twice
- scores are clamped to the 0-100 range
- invalid or missing fields are normalized
- only the configured top stories are selected for enrichment

The ranking step is intentionally separate from enrichment. Ranking is a cheaper triage step. Only selected stories enter the more expensive enrichment queue.

## Enrichment

Enrichment converts a selected article into a structured intelligence card. The AI receives only article metadata and is instructed not to invent facts. The backend expects strict JSON with:

- display title
- summary
- why it matters
- entities
- sentiment
- pulse score
- exposure score
- importance level
- risk level

The backend then validates and clamps the result:

- pulse and exposure stay between 0 and 100
- sentiment must be positive, neutral, negative, or mixed
- risk must be low, medium, or high
- category is kept inside the allowed topic set
- entity arrays are capped
- source URL and source name remain tied to the original article

This produces the cards shown in the dashboard, story detail view, top shifts, map, orbit, and simulator context.

## Pulse, Exposure, And Daily Change

NewsIntel separates multiple scores instead of using one vague "importance" number.

Pulse score:

Pulse measures story intensity. It is the dashboard's main signal number. It is influenced by AI importance, risk level, urgency, freshness, and expected public impact.

Exposure score:

Exposure estimates how relevant or visible the story is to the current user/profile context. A story can be globally important but less exposed to a user's selected focus.

ML signal score:

A small local neural model adds a lightweight machine-learning score. It does not replace the LLM. It adds a fast local signal based on structured features such as source count, confidence, freshness, velocity, risk, opportunity, sentiment, entity density, urgency terms, and category.

Daily delta:

The backend stores event metrics over time. The dashboard compares recent category scores with previous values and produces "What Changed Today." This is how the interface can say that tech rose, education cooled, or politics stayed stable.

World Pulse:

The dashboard aggregates top story pulse values into a global pressure number. It is intentionally based on stored/enriched stories, not on a live browser calculation. The browser only renders the result.

## Snapshot Read Model

The dashboard is fast because it reads a snapshot. A snapshot is a prebuilt JSON structure containing:

- top stories
- feed cards
- category groups
- pulse history
- exposure history
- map intensity
- orbit graph inputs
- simulator context
- quick glance counts
- pipeline health
- queue state
- AI circuit state

This avoids a slow pattern where the frontend waits for RSS fetching, deduplication, ranking, enrichment, and multiple model calls every time a user opens the page.

## AI Provider Strategy

NewsIntel uses hosted models and APIs instead of training large language models from scratch. That is the practical choice for an MVP because live news intelligence needs reliability, current provider quality, and fast iteration more than custom pretraining.

The provider strategy has layers:

- OpenRouter through the Cloud Command Gateway for ranking and enrichment
- Gemini through the same gateway as fallback and for embeddings
- Hugging Face Space for hosted NLP utilities
- local deterministic fallback for embeddings
- local lightweight signal-rank neural model for fast scoring

The backend has a circuit breaker around AI provider failures. If quota, billing, throttle, or repeated provider errors occur, the system does not fabricate fake stories. It opens a cooldown window, keeps the latest persisted snapshot available, and reports provider status through the dashboard.

## Hugging Face NLP Models

The Hugging Face Space hosts several pretrained NLP models. These models are used in the legacy/full-intelligence path and supporting NLP functions. The MVP dashboard mainly uses the controlled ranking/enrichment pipeline, but the hosted NLP stack explains the project's NLP layer and supports expansion.

### DistilBART For Summarization

Model:

```text
sshleifer/distilbart-cnn-12-6
```

Task:

```text
summarization
```

BART is a sequence-to-sequence transformer. It has an encoder and a decoder.

Internally:

- the tokenizer splits article text into subword tokens
- token IDs enter the encoder
- self-attention lets every token attend to other tokens in the input
- the encoder builds contextual representations of the article
- the decoder generates a shorter sequence one token at a time
- each generated token depends on the input representation and previously generated tokens
- beam/search-style decoding chooses a likely concise summary

DistilBART is a distilled version of BART. Distillation means a smaller student model is trained to imitate a larger teacher model. The benefit is lower CPU and memory cost while keeping useful summarization quality. That is important for a free or low-cost hosted inference environment.

Why it is useful:

- news articles are long
- dashboard cards need short summaries
- generated summaries are more readable than raw RSS snippets
- truncation and max/min output limits keep inference predictable

### RoBERTa For Sentiment

Model:

```text
cardiffnlp/twitter-roberta-base-sentiment-latest
```

Task:

```text
sentiment-analysis
```

RoBERTa is a BERT-style encoder-only transformer. It reads the whole text at once and produces contextual token embeddings. For sentiment, a classification head sits on top of the encoder output.

Internally:

- the text is tokenized into subword units
- each token receives a token embedding and position embedding
- transformer layers repeatedly apply self-attention and feed-forward networks
- self-attention lets the model connect words like "rises", "falls", "lawsuit", "profit", or "warning" with surrounding context
- the final pooled representation goes into a classifier
- the classifier outputs probabilities for labels such as positive, neutral, and negative

Why RoBERTa instead of a simple word list:

- "shares fall after record profit warning" is not handled well by naive keyword counting
- context changes sentiment meaning
- negation matters
- news wording is subtle
- probability scores give confidence, not only a label

NewsIntel uses sentiment as one input to risk/opportunity presentation, map tension, and story analysis. Sentiment is not treated as truth by itself; it is one signal among many.

### BERT For Named Entity Recognition

Model:

```text
dslim/bert-base-NER
```

Task:

```text
ner
```

BERT is an encoder-only transformer trained to understand context in both directions. For named entity recognition, every token is classified into an entity category or non-entity.

Internally:

- the tokenizer splits text into WordPiece tokens
- some words may become multiple subword pieces
- BERT builds contextual embeddings for each token
- a token-classification layer predicts tags such as person, organization, location, or miscellaneous entity
- adjacent entity tokens are grouped into complete names
- low-quality or duplicate entities are filtered

Example:

```text
"Nvidia and OpenAI announced a partnership in the United States."
```

BERT can identify:

- Nvidia as an organization
- OpenAI as an organization
- United States as a location

Why BERT is useful here:

- entities become clickable or trackable intelligence objects
- entity density is useful for signal ranking
- map/orbit views need organizations, people, and places
- Ask NewsIntel can retrieve relevant stored stories by matching question terms against entities and story text

### MiniLM Embeddings For Semantic Similarity

Model:

```text
sentence-transformers/all-MiniLM-L6-v2
```

Task:

```text
semantic embeddings
```

An embedding model converts text into a vector. Similar meanings produce vectors that point in similar directions. NewsIntel can compare vectors with cosine similarity.

Internally:

- text is tokenized
- the transformer builds contextual token vectors
- pooling combines token vectors into one sentence/document vector
- the vector is normalized
- cosine similarity compares two vectors

Why embeddings matter:

- two headlines can describe the same event with different words
- lexical matching alone misses paraphrases
- semantic clustering can group related articles into one event
- map/orbit/simulator features need relationships between stories

The system also has a local hash-vector embedding fallback. It is not a neural semantic model. It creates deterministic normalized vectors from tokens, bigrams, and topic aliases. The point is resilience: if external embedding providers are unavailable, the semantic pipeline can still run in a degraded but stable mode.

## Local Signal-Rank Model

NewsIntel includes a small local multilayer perceptron for signal ranking. It is intentionally small and explainable.

Input features include:

- source count
- confidence
- freshness within 6 hours
- freshness within 24 hours
- velocity
- high-risk flag
- medium-risk flag
- high-opportunity flag
- medium-opportunity flag
- negative or mixed sentiment flag
- entity density
- urgency terms
- topic flags for tech, politics, education, and entertainment

Internal functioning:

- features are normalized into numbers between 0 and 1
- a hidden layer applies weighted sums plus bias
- ReLU keeps positive activations and suppresses negative ones
- the output layer produces a logit
- sigmoid converts the logit to a probability
- probability becomes a 0-100 score
- score maps to tiers such as critical, signal, watch, or noise

Why this exists:

- it is fast and local
- it can run even when LLM providers are down
- its features are inspectable
- it can later be trained from user interactions and editorial feedback
- it complements the LLM instead of pretending to replace it

## Ask NewsIntel

Ask NewsIntel answers questions using the stored news context. It searches stored stories and source material, builds a compact context, and asks an AI provider for a grounded answer. The answer can include sources so the user can trace where the response came from.

The important rule is that Ask mode should use stored/current project data as context. It is not meant to be a disconnected chatbot.

## Map, Orbit, Alerts, And Simulation

The richer parts of NewsIntel use the same structured story data:

- map views use country/region and category intensity
- orbit views use stories as nodes and relationships as edges
- alerts use thresholds, severity, and user rules
- digests summarize stored intelligence over a day
- simulator asks "what if" questions against existing signal context

These features depend on the backend preserving structured fields such as entities, categories, pulse scores, risk levels, opportunity levels, source URLs, and timestamps.

## Caching And Performance

NewsIntel is designed around cache-first reading.

Backend performance choices:

- dashboard GET reads a cached snapshot
- expensive refresh work runs through explicit refresh or scheduler triggers
- article NLP results are cached
- AI provider responses are cached briefly
- Redis can store shared cache across instances
- database locks prevent duplicate ingestion/enrichment jobs
- AI circuit breaker prevents repeated failing provider calls

Frontend performance choices:

- React renders precomputed dashboard data
- Vite builds a small production bundle
- dashboard data is normalized once before rendering
- images are lazy loaded
- cards use stable sizing to reduce layout shift
- expensive visual effects are throttled
- top dashboard sections mount in small waves so the first screen appears quickly

## Main Libraries And Why They Are Used

### Backend

FastAPI:

FastAPI provides async HTTP endpoints, request validation, OpenAPI support, and clean dependency injection. It fits a pipeline-heavy backend because endpoints can trigger async network/database work without blocking the whole process.

Uvicorn:

Uvicorn runs the FastAPI app as an ASGI server. It supports async request handling and is suitable for deployment on common Python hosting platforms.

httpx:

httpx is used for async HTTP calls to RSS sources, gateway providers, and model endpoints. Async HTTP lets the backend fetch many sources or call providers without serial blocking.

feedparser:

feedparser handles RSS parsing. RSS feeds are inconsistent, so using a mature parser is safer than manually parsing XML.

googlenewsdecoder:

Google News often returns redirect URLs. This helper attempts to resolve them to publisher URLs, improving deduplication and source transparency.

SQLAlchemy:

SQLAlchemy is the ORM/data layer. It gives typed models, query construction, relationships, and transaction control while still allowing efficient database reads.

Alembic:

Alembic handles schema migrations. NewsIntel stores many structured tables, so schema changes need to be versioned instead of edited manually.

PostgreSQL, asyncpg, and psycopg2:

PostgreSQL is used for durable production data. asyncpg supports async runtime access. psycopg2 remains useful for migration/admin compatibility in some environments.

Redis:

Redis is optional but useful for cross-process cache and lock behavior. It helps when the backend runs on more than one instance.

APScheduler:

APScheduler can trigger recurring ingestion or maintenance work. This allows background refresh patterns instead of user-only refreshes.

Pydantic and pydantic-settings:

Pydantic validates request bodies, response shapes, and runtime settings. It keeps environment-driven configuration predictable.

cachetools:

cachetools provides lightweight in-process TTL caching for quick repeated reads and provider response reuse.

pytest:

pytest verifies pipeline behavior, deduplication, provider fallback, snapshot construction, and circuit-breaker logic.

### NLP And Model Hosting

transformers:

The Hugging Face Transformers library loads pretrained BART, RoBERTa, and BERT pipelines. It avoids writing model inference code from scratch.

torch:

PyTorch is the deep-learning runtime underneath the transformer models.

sentence-transformers:

Sentence Transformers provides high-quality embedding models with a simple encode API.

sentencepiece:

Some transformer tokenizers depend on SentencePiece tokenization, especially models that use subword segmentation.

Gradio:

Gradio exposes the Hugging Face Space as a simple hosted model service with interactive tabs and callable endpoints.

### Frontend

React:

React renders the single-page dashboard and keeps UI state predictable.

Vite:

Vite gives fast local development and optimized production builds.

React Router:

React Router handles dashboard, story, orbit, map, simulator, alerts, settings, and other client-side routes.

Firebase:

Firebase handles authentication identity in the frontend. The backend receives user identity headers for profile-aware features.

Lucide React:

Lucide provides consistent icons without custom SVG clutter.

Three.js and React Three Fiber:

These support advanced visual scenes where needed. The current dashboard keeps heavy rendering controlled so visuals do not block data work.

d3-geo and topojson-client:

These support geography calculations and map rendering. They are used to convert geographic data into visual coordinates.

## Why The System Does Not Train A Large Model From Scratch

Training a custom summarization, sentiment, NER, embedding, or large reasoning model would require:

- huge labeled datasets
- expensive GPUs
- long training time
- evaluation pipelines
- safety testing
- ongoing retraining as news changes

For this project, the better engineering choice is to use pretrained models and provider APIs, then focus custom work on the news pipeline:

- fetching fresh data
- filtering duplicates
- preserving sources
- ranking stories
- validating AI output
- caching snapshots
- making the dashboard fast
- building product-specific scoring

The project still has a custom ML component: the local signal-rank model. It is small enough to understand and train from project data later.

## Reliability Principles

NewsIntel follows several reliability rules:

- do not invent stories when providers fail
- keep the latest good snapshot available
- validate AI JSON before storing it
- clamp model scores into safe ranges
- preserve source URLs
- deduplicate before enrichment
- separate ranking from enrichment
- keep expensive work off the frontend path
- expose queue and circuit status to the dashboard

## Current Limitations

The MVP pipeline enriches selected articles individually. The larger event-store path is better for grouping many articles into the same real-world event.

Embedding fallback is resilient but weaker than true neural embeddings.

Provider limits can delay fresh ranking or enrichment.

RSS coverage depends on Google News query behavior and publisher availability.

Some advanced features are feature-flagged or operate in MVP-compatible mode until the production event-store path is fully enabled.

## Quick Start

Backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Important environment values:

```text
DATABASE_URL=postgresql+asyncpg://...
GATEWAY_SECRET=...
GATEWAY_BASE_URL=https://cloud-command.onrender.com/api/gateway
INGEST_SECRET=...
NEWSINTEL_CATEGORIES=tech,education,entertainment,politics
NEWSINTEL_ARTICLES_PER_CATEGORY=5
NEWSINTEL_RANK_TOP_N=15
NEWSINTEL_ENRICH_BATCH_SIZE=3
DASHBOARD_CACHE_TTL_SECONDS=600
```

Frontend API base:

```text
VITE_API_URL=http://127.0.0.1:8000
```

## One-Line Summary

NewsIntel is a database-backed AI news pipeline that turns live RSS headlines into deduplicated, ranked, enriched, source-traceable intelligence signals and serves them through a fast React dashboard.
